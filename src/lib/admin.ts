import { getAuthInstance } from './firebase';
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

// ─── User Management ─────────────────────────────────────────

export async function getAllUsers(): Promise<UserProfile[]> {
  const { users } = await workerAdminGet('/api/admin/all-users');
  return users;
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
  const { orders } = await workerAdminGet('/api/admin/all-orders');
  return orders;
}

// ─── Redeem Code Management ──────────────────────────────────

export async function getAllCodes(): Promise<RedeemCode[]> {
  const { codes } = await workerAdminGet('/api/admin/all-codes');
  return codes;
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
