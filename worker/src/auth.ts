import { jwtVerify, SignJWT, importPKCS8 } from 'jose';
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
      tokens?: { integerValue?: string };
    };
  };
  return parseInt(
    doc.fields?.tokens?.integerValue || '0',
  );
}

export async function getAdminAccessToken(env: Env): Promise<string> {
  if (!env.FIREBASE_CLIENT_EMAIL || !env.FIREBASE_PRIVATE_KEY) {
    throw new Error('Server misconfigured: missing FIREBASE_CLIENT_EMAIL or FIREBASE_PRIVATE_KEY');
  }

  const privateKey = await importPKCS8(env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'), 'RS256');

  const jwt = await new SignJWT({
    iss: env.FIREBASE_CLIENT_EMAIL,
    sub: env.FIREBASE_CLIENT_EMAIL,
    aud: 'https://oauth2.googleapis.com/token',
    scope: 'https://www.googleapis.com/auth/datastore'
  })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(privateKey);

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to get Google OAuth token: ${errorText}`);
  }

  const data = await res.json() as { access_token: string };
  return data.access_token;
}

export async function deductTokens(
  env: Env,
  uid: string,
  authHeader: string,
  amount: number,
): Promise<number> {
  const current = await getUserTokens(env, uid, authHeader);
  if (current < amount) {
    throw new Error(`Insufficient tokens: have ${current}, need ${amount}`);
  }

  const adminToken = await getAdminAccessToken(env);
  const url = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents:commit`;

  const reqBody = {
    writes: [
      {
        transform: {
          document: `projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/users/${uid}`,
          fieldTransforms: [
            {
              fieldPath: 'tokens',
              increment: { integerValue: (-amount).toString() }
            }
          ]
        }
      }
    ]
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(reqBody),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to deduct tokens: ${errorText}`);
  }

  // Post-increment balance check: read the balance again to detect race conditions.
  // If balance went negative (another request spent the same tokens concurrently),
  // immediately refund to prevent underflow.
  const newBalance = await getUserTokens(env, uid, `Bearer ${adminToken}`);
  if (newBalance < 0) {
    await refundTokens(env, uid, amount);
    throw new Error('Insufficient tokens: concurrent purchase detected, balance was insufficient.');
  }

  return current - amount;
}

export async function refundTokens(
  env: Env,
  uid: string,
  amount: number,
): Promise<void> {
  const adminToken = await getAdminAccessToken(env);
  const url = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents:commit`;
  const reqBody = {
    writes: [{
      transform: {
        document: `projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/users/${uid}`,
        fieldTransforms: [{
          fieldPath: 'tokens',
          increment: { integerValue: amount.toString() }
        }]
      }
    }]
  };
  await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(reqBody),
  });
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
