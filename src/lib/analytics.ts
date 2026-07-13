import { collection, getDocs, query, where, orderBy, Timestamp } from 'firebase/firestore';
import { getDB } from './firebase';
import type { UserProfile } from './auth';
import type { Order, TokenOrder } from './orders';
import type { RedeemCode } from './redeem';

export interface AnalyticsData {
  // Users
  totalUsers: number;
  usersToday: number;
  usersThisWeek: number;

  // Tokens
  totalTokensInCirculation: number;
  totalTokensRedeemed: number;
  totalTokensSpent: number;

  // Orders
  totalOrders: number;
  pendingOrders: number;
  completedOrders: number;
  totalRevenue: number;

  // Redeem Codes
  totalCodes: number;
  activeCodes: number;
  totalRedemptions: number;

  // Recent activity
  recentOrders: Order[];
  recentUsers: UserProfile[];
}

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

function timestampToDate(ts: any): Date {
  if (!ts) return new Date(0);
  if (ts.toDate) return ts.toDate();
  if (ts.seconds) return new Date(ts.seconds * 1000);
  return new Date(ts);
}

export async function getAnalytics(): Promise<AnalyticsData> {
  const db = getDB();

  // Fetch all collections in parallel
  const [usersSnap, ordersSnap, codesSnap] = await Promise.all([
    getDocs(collection(db, 'users')),
    getDocs(collection(db, 'orders')),
    getDocs(collection(db, 'redeemCodes')),
  ]);

  // Process users
  const users = usersSnap.docs.map(d => d.data() as UserProfile);
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = daysAgo(7);

  const totalUsers = users.length;
  const usersToday = users.filter(u => {
    const created = timestampToDate(u.createdAt);
    return created >= todayStart;
  }).length;
  const usersThisWeek = users.filter(u => {
    const created = timestampToDate(u.createdAt);
    return created >= weekStart;
  }).length;

  // Process tokens
  const totalTokensInCirculation = users.reduce((sum, u) => sum + (u.tokens || 0), 0);

  // Process orders
  const orders = ordersSnap.docs.map(d => ({ id: d.id, ...d.data() }) as Order);
  const totalOrders = orders.length;

  const pendingOrders = orders.filter(o => o.status === 'pending').length;
  const completedOrders = orders.filter(o => o.status === 'completed' || o.status === 'approved').length;

  const totalRevenue = orders
    .filter(o => o.type === 'token_purchase' && (o.status === 'completed' || o.status === 'approved'))
    .reduce((sum, o) => sum + (('priceUSD' in o) ? o.priceUSD : 0), 0);

  const totalTokensRedeemed = orders
    .filter(o => o.type === 'token_purchase' && (o.status === 'completed' || o.status === 'approved'))
    .reduce((sum, o) => sum + (('tokenAmount' in o) ? o.tokenAmount : 0), 0);

  const totalTokensSpent = orders
    .filter(o => o.type === 'subdomain' || o.type === 'website' || o.type === 'portfolio')
    .reduce((sum, o) => sum + (('tokensUsed' in o) ? o.tokensUsed : 0), 0);

  // Process redeem codes
  const codes = codesSnap.docs.map(d => d.data() as RedeemCode);
  const totalCodes = codes.length;
  const activeCodes = codes.filter(c => {
    const expired = c.expiresAt && c.expiresAt.toMillis() < Date.now();
    const exhausted = c.currentUses >= c.maxUses;
    return !expired && !exhausted;
  }).length;
  const totalRedemptions = codes.reduce((sum, c) => sum + c.currentUses, 0);

  // Recent activity (last 10)
  const recentOrders = orders
    .sort((a, b) => {
      const dateA = timestampToDate(a.createdAt);
      const dateB = timestampToDate(b.createdAt);
      return dateB.getTime() - dateA.getTime();
    })
    .slice(0, 10);

  const recentUsers = users
    .sort((a, b) => {
      const dateA = timestampToDate(a.lastLoginAt);
      const dateB = timestampToDate(b.lastLoginAt);
      return dateB.getTime() - dateA.getTime();
    })
    .slice(0, 10);

  return {
    totalUsers,
    usersToday,
    usersThisWeek,
    totalTokensInCirculation,
    totalTokensRedeemed,
    totalTokensSpent,
    totalOrders,
    pendingOrders,
    completedOrders,
    totalRevenue,
    totalCodes,
    activeCodes,
    totalRedemptions,
    recentOrders,
    recentUsers,
  };
}
