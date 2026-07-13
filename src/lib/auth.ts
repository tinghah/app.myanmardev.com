import { doc, getDoc, setDoc, updateDoc, increment, Timestamp, deleteField } from 'firebase/firestore';
import { getDB } from './firebase';

// ─── User Profile Types ─────────────────────────────────

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  provider: 'google' | 'github' | 'google, github' | 'unknown';
  githubUsername?: string;
  tokens: number;
  isAdmin?: boolean;
  disabled?: boolean;
  createdAt: Timestamp;
  lastLoginAt: Timestamp;
}

// ─── Super Admin ──────────────────────────────────────────

const SUPER_ADMINS = [
  'myanmardevadmin@gmail.com',
  'ting.pouchen@gmail.com'
];

export function isSuperAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return SUPER_ADMINS.includes(email.toLowerCase());
}

// ─── Detect Provider from Firebase User ─────────────────

function detectProvider(user: any): 'google' | 'github' | 'google, github' | 'unknown' {
  let hasGoogle = false;
  let hasGithub = false;
  for (const p of user.providerData || []) {
    if (p?.providerId === 'google.com') hasGoogle = true;
    if (p?.providerId === 'github.com') hasGithub = true;
  }
  if (hasGoogle && hasGithub) return 'google, github';
  if (hasGoogle) return 'google';
  if (hasGithub) return 'github';
  
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
  // Ensure provider is never undefined
  const provider = detectProvider(user) || 'unknown';
  const githubUsername = (provider === 'github' || provider === 'google, github') ? extractGithubUsername(user) : null;

  if (userSnap.exists()) {
    const existing = userSnap.data() as UserProfile;
    
    // Update only safe, non-undefined fields
    const updateData: Record<string, any> = {
      lastLoginAt: now,
      provider: provider,
    };
    
    // DO NOT try to write isAdmin to Firestore during update, as security rules block it.
    // Instead, we dynamically inject it in memory for super admins below.
    if (user.displayName) updateData.displayName = user.displayName;
    if (user.photoURL) updateData.photoURL = user.photoURL;
    if (githubUsername) updateData.githubUsername = githubUsername;

    await updateDoc(userRef, updateData);

    const profileToReturn = { ...existing, ...updateData };
    if (isSuperAdmin(user.email)) {
      profileToReturn.isAdmin = true;
    }
    return profileToReturn;
  } else {
    // Create new user — assign fields explicitly to avoid any undefined
    const newProfile: Record<string, any> = {
      uid: user.uid,
      email: user.email || '',
      displayName: user.displayName || '',
      photoURL: user.photoURL || '',
      provider: provider,
      tokens: 0,
      isAdmin: isSuperAdmin(user.email),
      createdAt: now,
      lastLoginAt: now,
    };
    if (githubUsername) {
      newProfile.githubUsername = githubUsername;
    }

    await setDoc(userRef, newProfile);
    return newProfile as UserProfile;
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
    const profile = userSnap.data() as UserProfile;
    if (isSuperAdmin(profile.email)) {
      profile.isAdmin = true;
    }
    return profile;
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
    tokens: increment(amount),
  });
}

/**
 * Deduct tokens from user balance (returns false if insufficient)
 */
export async function deductTokens(uid: string, amount: number): Promise<boolean> {
  const profile = await getUserProfile(uid);
  if (!profile || profile.tokens < amount) {
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
