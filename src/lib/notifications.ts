import { getDB } from './firebase';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  limit as firestoreLimit,
  type Unsubscribe,
} from 'firebase/firestore';

export interface Notification {
  id: string;
  type: string;
  message: string;
  timestamp: string;
  read: boolean;
  metadata?: Record<string, string>;
}

/**
 * Subscribe to a user's notifications (real-time).
 * Returns an unsubscribe function.
 */
export function subscribeToNotifications(
  userId: string,
  callback: (notifications: Notification[]) => void,
  maxItems = 50,
): Unsubscribe {
  const db = getDB();
  const q = query(
    collection(db, 'notifications', userId, 'items'),
    orderBy('timestamp', 'desc'),
    firestoreLimit(maxItems),
  );

  return onSnapshot(q, (snapshot) => {
    const notifications = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as Notification[];
    callback(notifications);
  });
}

/**
 * Mark a single notification as read.
 */
export async function markAsRead(userId: string, notificationId: string): Promise<void> {
  const db = getDB();
  const ref = doc(db, 'notifications', userId, 'items', notificationId);
  await updateDoc(ref, { read: true });
}

/**
 * Mark all notifications as read.
 */
export async function markAllAsRead(userId: string, notifications: Notification[]): Promise<void> {
  const db = getDB();
  const unread = notifications.filter((n) => !n.read);
  await Promise.all(
    unread.map((n) => {
      const ref = doc(db, 'notifications', userId, 'items', n.id);
      return updateDoc(ref, { read: true });
    }),
  );
}
