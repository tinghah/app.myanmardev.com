import { getAuthInstance, getDB } from './firebase';
import { collection, getDocs, query, orderBy, doc, getDoc } from 'firebase/firestore';
import type { UserProfile } from './auth';
import type { Order } from './orders';
import type { RedeemCode } from './redeem';

// ─── Worker API Helper ──────────────────────────────────────

const API_URL = import.meta.env.PUBLIC_WORKER_API_URL || 'http://localhost:8787';

async function workerAdminGet(path: string): Promise<any> {
  const user = getAuthInstance().currentUser;
  if (!user) throw new Error('Not authenticated');
  const token = await user.getIdToken();
  const res = await fetch(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

async function workerAdminPost(path: string, body: any): Promise<any> {
  const user = getAuthInstance().currentUser;
  if (!user) throw new Error('Not authenticated');
  const token = await user.getIdToken();
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

// ─── Firestore Direct Access (for read operations) ──────────

function mapFirestoreUser(doc: any): UserProfile {
  const data = doc.data();
  return {
    uid: doc.id,
    email: data.email || '',
    displayName: data.displayName || '',
    photoURL: data.photoURL || '',
    provider: data.provider || 'unknown',
    githubUsername: data.githubUsername || '',
    tokens: data.tokens || 0,
    isAdmin: data.isAdmin || false,
    disabled: data.disabled || false,
    createdAt: data.createdAt,
    lastLoginAt: data.lastLoginAt,
  } as UserProfile;
}

// ─── User Management ─────────────────────────────────────────

export async function getAllUsers(): Promise<UserProfile[]> {
  try {
    // Try worker API first
    const { users } = await workerAdminGet('/api/admin/all-users');
    return users;
  } catch (workerError) {
    // Fallback to direct Firestore access
    console.warn('Worker API failed, falling back to Firestore:', workerError);
    const db = getDB();
    const usersRef = collection(db, 'users');
    const q = query(usersRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(mapFirestoreUser);
  }
}

export async function disableUser(uid: string): Promise<void> {
  await workerAdminPost('/api/admin/update-user', { uid, action: 'disabled', value: true });
}

export async function enableUser(uid: string): Promise<void> {
  await workerAdminPost('/api/admin/update-user', { uid, action: 'disabled', value: false });
}

export async function deleteUser(uid: string): Promise<void> {
  await workerAdminPost('/api/admin/update-user', { uid, action: 'delete' });
}

export async function addUserTokens(uid: string, amount: number): Promise<void> {
  await workerAdminPost('/api/admin/topup-tokens', { uid, amount });
}

export async function setUserRole(uid: string, isAdmin: boolean): Promise<void> {
  await workerAdminPost('/api/admin/set-admin-role', { uid, isAdmin });
}

// ─── Order Management ────────────────────────────────────────

export async function getAllOrders(): Promise<Order[]> {
  try {
    // Try worker API first
    const { orders } = await workerAdminGet('/api/admin/all-orders');
    return orders;
  } catch (workerError) {
    // Fallback to direct Firestore access
    console.warn('Worker API failed, falling back to Firestore:', workerError);
    const db = getDB();
    const ordersRef = collection(db, 'orders');
    const q = query(ordersRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as Order[];
  }
}

// ─── Redeem Code Management ──────────────────────────────────

export async function getAllCodes(): Promise<RedeemCode[]> {
  try {
    // Try worker API first
    const { codes } = await workerAdminGet('/api/admin/all-codes');
    return codes;
  } catch (workerError) {
    // Fallback to direct Firestore access
    console.warn('Worker API failed, falling back to Firestore:', workerError);
    const db = getDB();
    const codesRef = collection(db, 'redeemCodes');
    const q = query(codesRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      code: doc.id,
      ...doc.data(),
    })) as RedeemCode[];
  }
}

export async function createRedeemCode(
  code: string,
  tokenAmount: number,
  maxUses: number,
  validityDays: number,
  createdBy: string
): Promise<void> {
  await workerAdminPost('/api/admin/create-redeem-code', {
    code, tokenAmount, maxUses, validityDays, createdBy,
  });
}

export async function disableCode(code: string): Promise<void> {
  await workerAdminPost('/api/admin/create-redeem-code', {
    code, tokenAmount: 0, maxUses: 0, validityDays: 0, createdBy: 'disable',
  });
}
