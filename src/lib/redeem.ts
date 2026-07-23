import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  runTransaction,
  arrayUnion,
  increment,
  Timestamp,
} from 'firebase/firestore';
import { getDB } from './firebase';

// ─── Redeem Code Types ──────────────────────────────────

export interface RedeemCode {
  code: string;
  tokenAmount: number;
  maxUses: number;
  currentUses: number;
  usedBy: string[];
  expiresAt: Timestamp | null;
  createdAt: Timestamp;
  createdBy: string;
  description?: string;
}

export interface RedeemResult {
  success: boolean;
  tokens?: number;
  error?: string;
}

// ─── Redeem Functions ────────────────────────────────────

/**
 * Redeem a code for tokens.
 *
 * Validation + code update + token addition run inside a single Firestore
 * transaction so two concurrent requests cannot double-redeem the same code.
 * The redemption history record is written *outside* the transaction because
 * it is non-critical and a failure there should not roll back the tokens.
 */
export async function redeemCode(userId: string, code: string): Promise<RedeemResult> {
  const db = getDB();
  const codeUpper = code.trim().toUpperCase();

  try {
    const tokenAmount = await runTransaction(db, async (transaction) => {
      const codeRef = doc(db, 'redeemCodes', codeUpper);
      const codeSnap = await transaction.get(codeRef);

      if (!codeSnap.exists()) {
        throw new Error('Invalid redeem code');
      }

      const codeData = codeSnap.data() as RedeemCode;

      if (codeData.expiresAt && codeData.expiresAt.toMillis() < Date.now()) {
        throw new Error('This code has expired');
      }

      if (codeData.currentUses >= codeData.maxUses) {
        throw new Error('This code has been fully redeemed');
      }

      if (codeData.usedBy.includes(userId)) {
        throw new Error('You have already redeemed this code');
      }

      // Atomic updates inside the transaction
      transaction.update(codeRef, {
        currentUses: increment(1),
        usedBy: arrayUnion(userId),
      });

      const userRef = doc(db, 'users', userId);
      transaction.update(userRef, {
        tokens: increment(codeData.tokenAmount),
      });

      return codeData.tokenAmount;
    });

    // Record redemption history outside the transaction (non-critical)
    const redeemHistoryRef = doc(db, 'userRedeems', userId);
    const redeemHistorySnap = await getDoc(redeemHistoryRef);

    if (redeemHistorySnap.exists()) {
      await updateDoc(redeemHistoryRef, {
        redeems: arrayUnion({
          code: codeUpper,
          tokens: tokenAmount,
          redeemedAt: Timestamp.now(),
        }),
      });
    } else {
      await setDoc(redeemHistoryRef, {
        userId,
        redeems: [{
          code: codeUpper,
          tokens: tokenAmount,
          redeemedAt: Timestamp.now(),
        }],
      });
    }

    return { success: true, tokens: tokenAmount };
  } catch (err: any) {
    console.error('Redeem failed:', err);
    // Surface the domain-specific validation messages to the caller
    const message: string = err.message || 'Failed to redeem code. Please try again.';
    const knownErrors = [
      'Invalid redeem code',
      'This code has expired',
      'This code has been fully redeemed',
      'You have already redeemed this code',
    ];
    if (knownErrors.includes(message)) {
      return { success: false, error: message };
    }
    return { success: false, error: 'Failed to redeem code. Please try again.' };
  }
}

/**
 * Get redeem code details (for admin)
 */
export async function getRedeemCodeDetails(code: string): Promise<RedeemCode | null> {
  const db = getDB();
  const codeRef = doc(db, 'redeemCodes', code.toUpperCase());
  const codeSnap = await getDoc(codeRef);

  if (codeSnap.exists()) {
    return codeSnap.data() as RedeemCode;
  }
  return null;
}

/**
 * Check if a user has already redeemed a specific code
 */
export async function hasUserRedeemedCode(userId: string, code: string): Promise<boolean> {
  const db = getDB();
  const codeRef = doc(db, 'redeemCodes', code.toUpperCase());
  const codeSnap = await getDoc(codeRef);

  if (codeSnap.exists()) {
    const codeData = codeSnap.data() as RedeemCode;
    return codeData.usedBy.includes(userId);
  }
  return false;
}
