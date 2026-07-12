import { doc, getDoc, setDoc, updateDoc, increment, Timestamp, deleteField } from 'firebase/firestore';
import { getDB } from './firebase';

// ─── User Profile Types ─────────────────────────────────

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  provider: 'google' | 'github' | 'unknown';
  githubUsername?: string;
  tokenBalance: number;
  createdAt: Timestamp;
  lastLoginAt: Timestamp;
}

// ─── Detect Provider from Firebase User ─────────────────

function detectProvider(user: any): 'google' | 'github' | 'unknown' {
  // Check providerData array first (most reliable)
  for (const p of user.providerData || []) {
    if (p?.providerId === 'google.com') return 'google';
    if (p?.providerId === 'github.com') return 'github';
  }
  // Fallback: check email domain hints
  if (user.email?.endsWith('@gmail.com')) return 'google';
  return 'unknown';
}

// ─── Extract GitHub Username ──────────────────────────────

function extractGithubUsername(user: any): string | null {
  for (const p of user.providerData || []) {
    if (p?.providerId === 'github.com') {
      // GitHub sets reloadUserInfo with screenName
      if (user.reloadUserInfo?.screenName) return user.reloadUserInfo.screenName;
      // Sometimes the displayName is the username
      if (p.displayName) return p.displayName.toLowerCase().replace(/\s+/g, '');
      // email@github.com format (rare)
      if (p.email?.endsWith('@github.com')) return p.email.replace('@github.com', '');
    }
  }
  return null;
}

// ─── Sanitize: strip any undefined values from object ────

function stripUndefined<T extends Record<string, any>>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined && v !== null)
  ) as T;
}

// ─── User Profile Functions ─────────────────────────────

/**
 * Create or update user profile in Firestore on login.
 * Never calls setDoc/updateDoc with undefined values.
 */
export async function createOrUpdateUserProfile(user: any): Promise<UserProfile> {
  const db = getDB();
  const userRef = doc(db, 'users', user.uid);
  const userSnap = await getDoc(userRef);

  const now = Timestamp.now();
  const provider = detectProvider(user);
  const githubUsername = provider === 'github' ? extractGithubUsername(user) : null;

  if (userSnap.exists()) {
    // Update only safe, non-undefined fields
    const updateData: Record<string, any> = stripUndefined({
      lastLoginAt: now,
      displayName: user.displayName || '',
      photoURL: user.photoURL || '',
      // Only update githubUsername if we found one
      ...(githubUsername ? { githubUsername } : {}),
    });

    await updateDoc(userRef, updateData);

    const existing = userSnap.data() as UserProfile;
    return { ...existing, ...updateData };
  } else {
    // Create new user — strip all undefined / null before writing
    const newProfile = stripUndefined({
      uid: user.uid,
      email: user.email || '',
      displayName: user.displayName || '',
      photoURL: user.photoURL || '',
      provider,
      tokenBalance: 0,
      createdAt: now,
      lastLoginAt: now,
      // Only include githubUsername if we have one
      ...(githubUsername ? { githubUsername } : {}),
    }) as UserProfile;

    await setDoc(userRef, newProfile);
    return newProfile;
  }
}

/**
 * Get user profile from Firestore
 */
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const db = getDB();
  const userRef = doc(db, 'users', uid);
  const userSnap = await getDoc(userRef);

  if (userSnap.exists()) {
    return userSnap.data() as UserProfile;
  }
  return null;
}

/**
 * Update user token balance (atomic increment)
 */
export async function updateTokenBalance(uid: string, amount: number): Promise<void> {
  const db = getDB();
  const userRef = doc(db, 'users', uid);
  await updateDoc(userRef, {
    tokenBalance: increment(amount),
  });
}

/**
 * Deduct tokens from user balance (returns false if insufficient)
 */
export async function deductTokens(uid: string, amount: number): Promise<boolean> {
  const profile = await getUserProfile(uid);
  if (!profile || profile.tokenBalance < amount) {
    return false;
  }
  await updateTokenBalance(uid, -amount);
  return true;
}

/**
 * Get GitHub username from user (public helper)
 */
export function getGitHubUsername(user: any): string | null {
  return extractGithubUsername(user);
}

/**
 * Legacy: Check if GitHub user is approved (kept for backward compatibility)
 */
export async function isApproved(username: string): Promise<boolean> {
  const db = getDB();
  const ref = doc(db, 'approved_users', username.toLowerCase());
  const snap = await getDoc(ref);
  return snap.exists();
}
