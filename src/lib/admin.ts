import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  increment,
  query,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { getDB, getAuthInstance } from './firebase';
import type { UserProfile } from './auth';
import type { Order } from './orders';
import type { RedeemCode } from './redeem';

// ─── User Management ─────────────────────────────────────

export async function getAllUsers(): Promise<UserProfile[]> {
  const db = getDB();
  const usersRef = collection(db, 'users');
  const q = query(usersRef, orderBy('createdAt', 'desc'));

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => doc.data() as UserProfile);
}

/**
 * Disable a user (sets disabled field to true)
 */
export async function disableUser(uid: string): Promise<void> {
  const db = getDB();
  const userRef = doc(db, 'users', uid);
  await updateDoc(userRef, { disabled: true });
}

/**
 * Enable a user (sets disabled field to false)
 */
export async function enableUser(uid: string): Promise<void> {
  const db = getDB();
  const userRef = doc(db, 'users', uid);
  await updateDoc(userRef, { disabled: false });
}

/**
 * Delete a user document from Firestore
 */
export async function deleteUser(uid: string): Promise<void> {
  const db = getDB();
  const userRef = doc(db, 'users', uid);
  await deleteDoc(userRef);
}

/**
 * Add tokens to a user (admin manual topup)
 */
export async function addUserTokens(uid: string, amount: number): Promise<void> {
  const db = getDB();
  const userRef = doc(db, 'users', uid);
  await updateDoc(userRef, {
    tokens: increment(amount),
  });
}

/**
 * Set or remove admin role for a user via the Worker service account.
 * This bypasses Firestore security rules that block client-side isAdmin writes.
 */
export async function setUserRole(uid: string, isAdmin: boolean): Promise<void> {
  const auth = getAuthInstance();
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');

  const token = await user.getIdToken();
  const API_URL = import.meta.env.PUBLIC_WORKER_API_URL || 'http://localhost:8787';

  const res = await fetch(`${API_URL}/api/admin/set-admin-role`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ uid, isAdmin }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || 'Failed to set admin role');
  }
}

// ─── Order Management ────────────────────────────────────

export async function getAllOrders(): Promise<Order[]> {
  const db = getDB();
  const ordersRef = collection(db, 'orders');
  const q = query(ordersRef, orderBy('createdAt', 'desc'));

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Order[];
}

// ─── Redeem Code Management ──────────────────────────────

export async function getAllCodes(): Promise<RedeemCode[]> {
  const db = getDB();
  const codesRef = collection(db, 'redeemCodes');
  const q = query(codesRef, orderBy('createdAt', 'desc'));

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    ...doc.data(),
    code: doc.id,
  })) as RedeemCode[];
}

export async function createRedeemCode(
  code: string,
  tokenAmount: number,
  maxUses: number,
  validityDays: number,
  createdBy: string
): Promise<void> {
  const db = getDB();
  const codeUpper = code.trim().toUpperCase();
  const codeRef = doc(db, 'redeemCodes', codeUpper);

  const now = Timestamp.now();
  let expiresAt: Timestamp | null = null;
  if (validityDays > 0) {
    expiresAt = Timestamp.fromMillis(now.toMillis() + validityDays * 24 * 60 * 60 * 1000);
  }

  const newCode: Omit<RedeemCode, 'code'> = {
    tokenAmount,
    maxUses,
    currentUses: 0,
    usedBy: [],
    expiresAt,
    createdAt: now,
    createdBy,
  };

  await setDoc(codeRef, newCode);
}

export async function disableCode(code: string): Promise<void> {
  const db = getDB();
  const codeRef = doc(db, 'redeemCodes', code.toUpperCase());
  
  // Set maxUses to currentUses to effectively disable it
  // Or could just set an expired date, but matching currentUses is safer
  const snapshot = await getDocs(query(collection(db, 'redeemCodes')));
  const targetDoc = snapshot.docs.find(d => d.id === code.toUpperCase());
  if (targetDoc) {
    const data = targetDoc.data();
    await updateDoc(codeRef, {
      maxUses: data.currentUses
    });
  }
}
