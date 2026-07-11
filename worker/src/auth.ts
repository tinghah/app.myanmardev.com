import { jwtVerify } from 'jose';
import type { Env } from './env';

// Google's public keys for Firebase JWT verification
const GOOGLE_CERTS_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

// Cache the public keys
let cachedKeys: Record<string, CryptoKey> | null = null;
let keysExpiry = 0;

async function getGooglePublicKeys(): Promise<Record<string, CryptoKey>> {
  const now = Date.now();
  if (cachedKeys && now < keysExpiry) return cachedKeys;

  const res = await fetch(GOOGLE_CERTS_URL);
  const certs = await res.json() as Record<string, string>;
  const maxAge = res.headers.get('cache-control');
  const maxAgeSec = maxAge ? parseInt(maxAge.match(/max-age=(\d+)/)?.[1] || '3600') : 3600;

  cachedKeys = {};
  for (const [kid, pem] of Object.entries(certs)) {
    cachedKeys[kid] = await crypto.subtle.importKey(
      'spki',
      pemToSpki(pem),
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    );
  }
  keysExpiry = now + maxAgeSec * 1000;
  return cachedKeys;
}

function pemToSpki(pem: string): ArrayBuffer {
  const binary = atob(pem.replace(/-----[^-]+-----/g, '').replace(/\s/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

export async function verifyFirebaseToken(
  env: Env,
  authHeader: string | null,
): Promise<{ uid: string; email: string }> {
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Missing or invalid Authorization header');
  }

  const token = authHeader.slice(7);

  // Quick decode to get the kid
  const header = JSON.parse(atob(token.split('.')[0]));
  const kid = header.kid;

  if (!kid) throw new Error('Token missing kid header');

  const keys = await getGooglePublicKeys();
  const key = keys[kid];

  if (!key) {
    // Refresh keys and try again
    cachedKeys = null;
    const freshKeys = await getGooglePublicKeys();
    const freshKey = freshKeys[kid];
    if (!freshKey) throw new Error('Unknown token key ID');
  }

  try {
    const { payload } = await jwtVerify(token, keys[kid] || key, {
      issuer: `https://securetoken.google.com/${env.FIREBASE_PROJECT_ID}`,
      audience: env.FIREBASE_PROJECT_ID,
    });

    const uid = payload.user_id || payload.sub;
    if (!uid) throw new Error('Token missing user ID');

    return { uid: uid as string, email: (payload.email as string) || '' };
  } catch (err) {
    throw new Error(`Token verification failed: ${err instanceof Error ? err.message : 'unknown'}`);
  }
}

// --- Firestore REST API helpers ---

export async function getUserTokens(env: Env, uid: string, authHeader: string): Promise<number> {
  const url = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/users/${uid}`;

  const res = await fetch(url, {
    headers: {
      Authorization: authHeader,
    },
  });
  if (!res.ok) {
    throw new Error('Failed to fetch user profile');
  }

  const doc = await res.json() as {
    fields?: {
      tokenBalance?: { integerValue?: string };
      tokens?: { integerValue?: string };
    };
  };
  return parseInt(
    doc.fields?.tokenBalance?.integerValue ||
      doc.fields?.tokens?.integerValue ||
      '0',
  );
}

export async function deductTokens(
  env: Env,
  uid: string,
  authHeader: string,
  amount: number,
): Promise<number> {
  // For the MVP, we'll handle token deduction client-side through Firestore
  // The Worker validates the action, and the client updates the token balance
  // In production, use a service account for server-side writes
  const current = await getUserTokens(env, uid, authHeader);
  if (current < amount) {
    throw new Error(`Insufficient tokens: have ${current}, need ${amount}`);
  }
  return current - amount;
}

export async function isAdmin(env: Env, uid: string, authHeader: string): Promise<boolean> {
  const url = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/users/${uid}`;

  const res = await fetch(url, {
    headers: {
      Authorization: authHeader,
    },
  });
  if (!res.ok) return false;

  const doc = await res.json() as { fields?: { isAdmin?: { booleanValue?: boolean } } };
  return doc.fields?.isAdmin?.booleanValue === true;
}
