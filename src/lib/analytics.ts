import { getAuthInstance, getDB } from './firebase';
import { collection, getDocs, query, orderBy, where } from 'firebase/firestore';

export interface AnalyticsData {
  totalUsers: number;
  usersToday: number;
  usersThisWeek: number;
  totalTokensInCirculation: number;
  totalTokensRedeemed: number;
  totalTokensSpent: number;
  totalOrders: number;
  pendingOrders: number;
  completedOrders: number;
  totalRevenue: number;
  totalCodes: number;
  activeCodes: number;
  totalRedemptions: number;
  recentOrders: any[];
  recentUsers: any[];
}

const API_URL = import.meta.env.PUBLIC_WORKER_API_URL || 'http://localhost:8787';

export async function getAnalytics(): Promise<AnalyticsData> {
  try {
    // Try worker API first
    const user = getAuthInstance().currentUser;
    if (!user) throw new Error('Not authenticated');
    const token = await user.getIdToken();

    const res = await fetch(`${API_URL}/api/admin/analytics`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to fetch analytics' }));
      throw new Error(err.error || 'Failed to fetch analytics');
    }

    const data = await res.json();
    return {
      ...data,
      totalTokensRedeemed: 0,
      totalTokensSpent: 0,
      totalRedemptions: 0,
      recentOrders: [],
      recentUsers: [],
    };
  } catch (workerError) {
    // Fallback to direct Firestore access
    console.warn('Worker API failed, falling back to Firestore:', workerError);
    return await getAnalyticsFromFirestore();
  }
}

async function getAnalyticsFromFirestore(): Promise<AnalyticsData> {
  const db = getDB();
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo = new Date(Date.now() - 7 * 86400000);

  // Fetch all collections
  const [usersSnap, ordersSnap, codesSnap] = await Promise.all([
    getDocs(collection(db, 'users')),
    getDocs(collection(db, 'orders')),
    getDocs(collection(db, 'redeemCodes')),
  ]);

  const users = usersSnap.docs;
  const orders = ordersSnap.docs;
  const codes = codesSnap.docs;

  // Calculate user stats
  const totalUsers = users.length;
  const usersToday = users.filter(doc => {
    const data = doc.data();
    const createdAt = data.createdAt?.toDate?.() || (data.createdAt ? new Date(data.createdAt) : null);
    return createdAt && createdAt >= todayStart;
  }).length;
  const usersThisWeek = users.filter(doc => {
    const data = doc.data();
    const createdAt = data.createdAt?.toDate?.() || (data.createdAt ? new Date(data.createdAt) : null);
    return createdAt && createdAt >= weekAgo;
  }).length;

  // Calculate token stats
  const totalTokensInCirculation = users.reduce((sum, doc) => {
    return sum + (doc.data().tokens || 0);
  }, 0);

  // Calculate order stats
  const totalOrders = orders.length;
  const pendingOrders = orders.filter(doc => doc.data().status === 'pending').length;
  const completedOrders = orders.filter(doc =>
    doc.data().status === 'completed' || doc.data().status === 'approved'
  ).length;
  const totalRevenue = orders
    .filter(doc => doc.data().type === 'token_purchase' &&
      (doc.data().status === 'completed' || doc.data().status === 'approved'))
    .reduce((sum, doc) => sum + (doc.data().priceUSD || 0), 0);

  // Calculate code stats
  const totalCodes = codes.length;
  const activeCodes = codes.filter(doc => {
    const data = doc.data();
    const expiresAt = data.expiresAt?.toDate?.() || (data.expiresAt ? new Date(data.expiresAt) : null);
    const currentUses = data.currentUses || 0;
    const maxUses = data.maxUses || 100;
    return (!expiresAt || expiresAt > now) && currentUses < maxUses;
  }).length;

  // Get recent orders and users
  const recentOrders = orders
    .sort((a, b) => {
      const aTime = a.data().createdAt?.toDate?.() || new Date(0);
      const bTime = b.data().createdAt?.toDate?.() || new Date(0);
      return bTime - aTime;
    })
    .slice(0, 5)
    .map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

  const recentUsers = users
    .sort((a, b) => {
      const aTime = a.data().createdAt?.toDate?.() || new Date(0);
      const bTime = b.data().createdAt?.toDate?.() || new Date(0);
      return bTime - aTime;
    })
    .slice(0, 5)
    .map(doc => ({
      uid: doc.id,
      ...doc.data(),
    }));

  return {
    totalUsers,
    usersToday,
    usersThisWeek,
    totalTokensInCirculation,
    totalTokensRedeemed: 0,
    totalTokensSpent: 0,
    totalOrders,
    pendingOrders,
    completedOrders,
    totalRevenue,
    totalCodes,
    activeCodes,
    totalRedemptions: 0,
    recentOrders,
    recentUsers,
  };
}
