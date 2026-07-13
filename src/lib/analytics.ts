import { getAuthInstance } from './firebase';

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
}
