import { verifyFirebaseToken, getUserTokens, isAdmin, deductTokens, refundTokens, getAdminAccessToken } from './auth';
import { checkDnsRecord, createDnsRecord, deleteDnsRecord, findDnsRecordId } from './cloudflare-dns';
import type { Env } from './env';

const SUBDOMAIN_COST = 10;

// Hardcoded super admin emails — same list as src/lib/auth.ts
const SUPER_ADMINS = [
  'myanmardevadmin@gmail.com',
  'ting.pouchen@gmail.com',
];

// --- CORS ---

function corsHeaders(origin: string | null): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
  };
}

function json(data: unknown, status = 200, origin: string | null = null): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  });
}

// --- Subdomain validation ---

function isValidSubdomain(name: string): boolean {
  return /^(?!-)[a-z0-9-]{3,63}(?<!-)$/.test(name);
}

function isValidTarget(target: string, type: 'A' | 'CNAME'): boolean {
  if (type === 'A') {
    return /^(\d{1,3}\.){3}\d{1,3}$/.test(target);
  }
  return /^[a-z0-9.-]+\.[a-z]{2,}$/.test(target);
}

// --- Blockchain verification (TRON / BSC) ---

async function verifyUsdtTransaction(
  txHash: string,
  expectedAmount: number,
): Promise<{ valid: boolean; actualAmount: number }> {
  // Try TRON (TRC-20) via TronScan API
  try {
    const res = await fetch(
      `https://apilist.tronscanapi.com/api/transaction-info?hash=${txHash}`,
    );
    if (res.ok) {
      const data = await res.json() as Record<string, unknown>;
      if (data.contractRet === 'SUCCESS' && typeof data.amount === 'number') {
        return { valid: data.amount >= expectedAmount, actualAmount: data.amount };
      }
    }
  } catch {
    // Fall through to BSC
  }

  // Try BSC (BEP-20) via BscScan API
  try {
    const res = await fetch(
      `https://api.bscscan.com/api?module=proxy&action=eth_getTransactionByHash&txhash=${txHash}`,
    );
    if (res.ok) {
      const data = await res.json() as Record<string, unknown>;
      const result = data.result as Record<string, unknown> | undefined;
      if (result?.value) {
        const amount = parseInt(result.value as string, 16) / 1e6;
        return { valid: amount >= expectedAmount, actualAmount: amount };
      }
    }
  } catch {
    // Both failed
  }

  throw new Error('Could not verify transaction. Check the TxHash and try again.');
}

// --- Router ---

async function handleRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;
  const origin = request.headers.get('Origin');

  // CORS preflight
  if (method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  try {
    // Health check
    if (path === '/api/health' && method === 'GET') {
      return json({ status: 'ok' }, 200, origin);
    }

    // Get products (public)
    if (path === '/api/products' && method === 'GET') {
      const dbToken = await getAdminAccessToken(env);
      const productsUrl = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/products`;
      const res = await fetch(productsUrl, {
        headers: { Authorization: `Bearer ${dbToken}` },
      });
      if (!res.ok) return json({ error: 'Failed to fetch products' }, 500, origin);

      const data = await res.json() as { documents?: any[] };
      const products = (data.documents || []).map((doc: any) => {
        const fields = doc.fields || {};
        return {
          id: doc.name?.split('/').pop(),
          name: fields.name?.stringValue || '',
          slug: fields.slug?.stringValue || '',
          description: fields.description?.stringValue || '',
          features: fields.features?.arrayValue?.values?.map((v: any) => v.stringValue) || [],
          priceUSD: fields.priceUSD?.doubleValue || 0,
          priceMMK: fields.priceMMK?.integerValue || 0,
          tokenCost: fields.tokenCost?.integerValue || 10,
          status: fields.status?.stringValue || 'comingsoon',
          category: fields.category?.stringValue || '',
          icon: fields.icon?.stringValue || '',
          sortOrder: fields.sortOrder?.integerValue || 0,
        };
      });

      products.sort((a: any, b: any) => (a.sortOrder || 0) - (b.sortOrder || 0));
      return json({ products }, 200, origin);
    }

    // Authenticated endpoints
    const authHeader = request.headers.get('Authorization');
    const { uid } = await verifyFirebaseToken(env, authHeader);
    const bearerToken = authHeader || '';

    // Check subdomain availability
    if (path === '/api/check-subdomain' && method === 'GET') {
      const subdomain = url.searchParams.get('subdomain')?.toLowerCase();
      if (!subdomain || !isValidSubdomain(subdomain)) {
        return json({ error: 'Invalid subdomain format' }, 400, origin);
      }
      const available = await checkDnsRecord(env, subdomain);
      return json({ available }, 200, origin);
    }

    // Create subdomain
    if (path === '/api/create-subdomain' && method === 'POST') {
      const body = await request.json() as { subdomain?: string; target?: string };
      const subdomain = body.subdomain?.toLowerCase();
      const target = body.target;

      if (!subdomain || !isValidSubdomain(subdomain)) {
        return json({ error: 'Invalid subdomain format' }, 400, origin);
      }
      if (!target) {
        return json({ error: 'Target is required' }, 400, origin);
      }

      const type = /^(\d{1,3}\.){3}\d{1,3}$/.test(target) ? 'A' : 'CNAME';
      if (!isValidTarget(target, type)) {
        return json({ error: `Invalid ${type} target` }, 400, origin);
      }

      // Check token balance
      const tokens = await getUserTokens(env, uid, bearerToken);
      if (tokens < SUBDOMAIN_COST) {
        return json(
          { error: `Insufficient tokens: have ${tokens}, need ${SUBDOMAIN_COST}` },
          402,
          origin,
        );
      }

      // Check availability
      const available = await checkDnsRecord(env, subdomain);
      if (!available) {
        return json({ error: 'Subdomain already taken' }, 409, origin);
      }

      // Deduct tokens securely on the server
      await deductTokens(env, uid, bearerToken, SUBDOMAIN_COST);

      // Create DNS record
      let recordId: string;
      try {
        recordId = await createDnsRecord(env, subdomain, target, type);
      } catch (err) {
        return json({ error: 'Failed to create DNS record' }, 500, origin);
      }

      // Create TXT record for ownership verification — rollback on failure
      let txtRecordId: string;
      try {
        txtRecordId = await createDnsRecord(env, subdomain, `v=myanmardev-owner=${uid}`, 'TXT');
      } catch (err) {
        // Rollback: delete the CNAME/A record and refund tokens
        try { await deleteDnsRecord(env, recordId); } catch {}
        try { await refundTokens(env, uid, SUBDOMAIN_COST); } catch {}
        return json({ error: 'Failed to create ownership record. DNS record rolled back.' }, 500, origin);
      }

      // Return success
      return json({ success: true, recordId, txtRecordId, tokensDeducted: SUBDOMAIN_COST }, 200, origin);
    }

    // Delete subdomain
    if (path === '/api/delete-subdomain' && method === 'POST') {
      const body = await request.json() as { subdomain?: string };
      const subdomain = body.subdomain?.toLowerCase();

      if (!subdomain || !isValidSubdomain(subdomain)) {
        return json({ error: 'Invalid subdomain format' }, 400, origin);
      }

      const recordId = await findDnsRecordId(env, subdomain);
      if (!recordId) {
        return json({ error: 'Subdomain not found' }, 404, origin);
      }

      // Verify ownership via TXT record
      const name = `${subdomain}.${env.DOMAIN_NAME}`;
      const cfRes = await fetch(
        `https://api.cloudflare.com/client/v4/zones/${env.CLOUDFLARE_ZONE_ID}/dns_records?name=${name}&type=TXT`,
        { headers: { Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`, 'Content-Type': 'application/json' } },
      );
      const cfData = await cfRes.json() as { result?: { id: string; content: string }[] };
      const txtRecord = cfData.result?.find((r) => r.content?.includes(uid));
      if (!txtRecord) {
        return json({ error: 'You do not own this subdomain' }, 403, origin);
      }

      await deleteDnsRecord(env, recordId);
      return json({ success: true }, 200, origin);
    }

    // ─── Admin: Set admin role (bypasses Firestore rules via service account) ───
    // Only hardcoded super admins can call this. Uses the FIREBASE_CLIENT_EMAIL
    // service account to write isAdmin directly, bypassing Firestore security rules.
    if (path === '/api/admin/set-admin-role' && method === 'POST') {
      const { email: callerEmail } = await verifyFirebaseToken(env, authHeader);

      // Verify caller is a hardcoded super admin
      const callerIsSuperAdmin = SUPER_ADMINS.includes(callerEmail.toLowerCase());
      if (!callerIsSuperAdmin) {
        return json({ error: 'Only super admins can set admin roles' }, 403, origin);
      }

      const body = await request.json() as { uid?: string; isAdmin?: boolean };
      const targetUid = body.uid;
      const isAdminValue = body.isAdmin;

      if (!targetUid || typeof isAdminValue !== 'boolean') {
        return json({ error: 'uid (string) and isAdmin (boolean) are required' }, 400, origin);
      }

      // Use the service account to write isAdmin directly to Firestore
      const adminToken = await getAdminAccessToken(env);
      const url = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/users/${targetUid}`;

      const res = await fetch(`${url}?updateMask.fieldPaths=isAdmin`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fields: {
            isAdmin: { booleanValue: isAdminValue },
          },
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        return json({ error: 'Failed to set admin role: ' + err }, 500, origin);
      }

      return json({ success: true, uid: targetUid, isAdmin: isAdminValue }, 200, origin);
    }

    // ─── Admin: Topup tokens ────────────────────────────────────────
    if (path === '/api/admin/topup-tokens' && method === 'POST') {
      const body = await request.json() as { uid?: string; amount?: number };
      if (!body.uid || !body.amount || body.amount < 1) {
        return json({ error: 'uid and amount (>=1) required' }, 400, origin);
      }
      const adminToken = await getAdminAccessToken(env);
      const url = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents:commit`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          writes: [{
            transform: {
              document: `projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/users/${body.uid}`,
              fieldTransforms: [{ fieldPath: 'tokens', increment: { integerValue: body.amount.toString() } }],
            },
          }],
        }),
      });
      if (!res.ok) return json({ error: 'Failed to topup tokens: ' + await res.text() }, 500, origin);
      return json({ success: true }, 200, origin);
    }

    // ─── Admin: Create redeem code ──────────────────────────────────
    if (path === '/api/admin/create-redeem-code' && method === 'POST') {
      const body = await request.json() as { code?: string; tokenAmount?: number; maxUses?: number; validityDays?: number; createdBy?: string };
      if (!body.code || !body.tokenAmount) return json({ error: 'code and tokenAmount required' }, 400, origin);
      const adminToken = await getAdminAccessToken(env);
      const codeUpper = body.code.trim().toUpperCase();
      const now = new Date().toISOString();
      let expiresAt: string | null = null;
      if (body.validityDays && body.validityDays > 0) {
        expiresAt = new Date(Date.now() + body.validityDays * 86400000).toISOString();
      }
      const url = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/redeemCodes/${codeUpper}`;
      const fields: Record<string, any> = {
        tokenAmount: { integerValue: body.tokenAmount.toString() },
        maxUses: { integerValue: (body.maxUses || 100).toString() },
        currentUses: { integerValue: '0' },
        usedBy: { arrayValue: { values: [] } },
        createdAt: { timestampValue: now },
        createdBy: { stringValue: body.createdBy || 'admin' },
      };
      if (expiresAt) fields.expiresAt = { timestampValue: expiresAt };
      const res = await fetch(url, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields }),
      });
      if (!res.ok) return json({ error: 'Failed to create code: ' + await res.text() }, 500, origin);
      return json({ success: true, code: codeUpper }, 200, origin);
    }

    // ─── Admin: Get all users ───────────────────────────────────────
    if (path === '/api/admin/all-users' && method === 'GET') {
      const adminToken = await getAdminAccessToken(env);
      const url = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/users?orderBy=createdAt&direction=DESC`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${adminToken}` } });
      if (!res.ok) return json({ error: 'Failed to fetch users' }, 500, origin);
      const data = await res.json() as { documents?: any[] };
      const users = (data.documents || []).map((doc: any) => {
        const f = doc.fields || {};
        return {
          uid: doc.name?.split('/').pop(),
          email: f.email?.stringValue || '',
          displayName: f.displayName?.stringValue || '',
          photoURL: f.photoURL?.stringValue || '',
          provider: f.provider?.stringValue || 'unknown',
          githubUsername: f.githubUsername?.stringValue || '',
          tokens: parseInt(f.tokens?.integerValue || '0'),
          isAdmin: f.isAdmin?.booleanValue || false,
          disabled: f.disabled?.booleanValue || false,
          createdAt: f.createdAt?.timestampValue || null,
          lastLoginAt: f.lastLoginAt?.timestampValue || null,
        };
      });
      return json({ users }, 200, origin);
    }

    // ─── Admin: Get all orders ──────────────────────────────────────
    if (path === '/api/admin/all-orders' && method === 'GET') {
      const adminToken = await getAdminAccessToken(env);
      const url = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/orders?orderBy=createdAt&direction=DESC`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${adminToken}` } });
      if (!res.ok) return json({ error: 'Failed to fetch orders' }, 500, origin);
      const data = await res.json() as { documents?: any[] };
      const orders = (data.documents || []).map((doc: any) => {
        const f = doc.fields || {};
        return {
          id: doc.name?.split('/').pop(),
          userId: f.userId?.stringValue || '',
          userEmail: f.userEmail?.stringValue || '',
          type: f.type?.stringValue || '',
          status: f.status?.stringValue || '',
          tokenAmount: parseInt(f.tokenAmount?.integerValue || '0'),
          tokensUsed: parseInt(f.tokensUsed?.integerValue || '0'),
          priceUSD: parseFloat(f.priceUSD?.doubleValue || '0'),
          paymentMethod: f.paymentMethod?.stringValue || '',
          createdAt: f.createdAt?.timestampValue || null,
          details: f.details?.mapValue?.fields ? Object.fromEntries(
            Object.entries(f.details.mapValue.fields).map(([k, v]: [string, any]) => [k, v.stringValue || v.integerValue || v.booleanValue || ''])
          ) : {},
        };
      });
      return json({ orders }, 200, origin);
    }

    // ─── Admin: Get all redeem codes ────────────────────────────────
    if (path === '/api/admin/all-codes' && method === 'GET') {
      const adminToken = await getAdminAccessToken(env);
      const url = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/redeemCodes?orderBy=createdAt&direction=DESC`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${adminToken}` } });
      if (!res.ok) return json({ error: 'Failed to fetch codes' }, 500, origin);
      const data = await res.json() as { documents?: any[] };
      const codes = (data.documents || []).map((doc: any) => {
        const f = doc.fields || {};
        return {
          code: doc.name?.split('/').pop(),
          tokenAmount: parseInt(f.tokenAmount?.integerValue || '0'),
          maxUses: parseInt(f.maxUses?.integerValue || '0'),
          currentUses: parseInt(f.currentUses?.integerValue || '0'),
          usedBy: f.usedBy?.arrayValue?.values?.map((v: any) => v.stringValue) || [],
          expiresAt: f.expiresAt?.timestampValue || null,
          createdAt: f.createdAt?.timestampValue || null,
          createdBy: f.createdBy?.stringValue || '',
        };
      });
      return json({ codes }, 200, origin);
    }

    // ─── Admin: Get analytics ───────────────────────────────────────
    if (path === '/api/admin/analytics' && method === 'GET') {
      const adminToken = await getAdminAccessToken(env);
      const base = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents`;
      const [usersRes, ordersRes, codesRes] = await Promise.all([
        fetch(`${base}/users`, { headers: { Authorization: `Bearer ${adminToken}` } }),
        fetch(`${base}/orders`, { headers: { Authorization: `Bearer ${adminToken}` } }),
        fetch(`${base}/redeemCodes`, { headers: { Authorization: `Bearer ${adminToken}` } }),
      ]);
      const usersData = await usersRes.json() as { documents?: any[] };
      const ordersData = await ordersRes.json() as { documents?: any[] };
      const codesData = await codesRes.json() as { documents?: any[] };
      const users = usersData.documents || [];
      const orders = ordersData.documents || [];
      const codes = codesData.documents || [];
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
      const totalTokens = users.reduce((s: number, d: any) => s + parseInt(d.fields?.tokens?.integerValue || '0'), 0);
      const pendingOrders = orders.filter((d: any) => d.fields?.status?.stringValue === 'pending').length;
      const completedOrders = orders.filter((d: any) => d.fields?.status?.stringValue === 'completed' || d.fields?.status?.stringValue === 'approved').length;
      const revenue = orders.filter((d: any) => d.fields?.type?.stringValue === 'token_purchase' && (d.fields?.status?.stringValue === 'completed' || d.fields?.status?.stringValue === 'approved'))
        .reduce((s: number, d: any) => s + parseFloat(d.fields?.priceUSD?.doubleValue || '0'), 0);
      return json({
        totalUsers: users.length,
        usersToday: users.filter((d: any) => d.fields?.createdAt?.timestampValue >= todayStart).length,
        usersThisWeek: users.filter((d: any) => d.fields?.createdAt?.timestampValue >= weekAgo).length,
        totalTokensInCirculation: totalTokens,
        totalOrders: orders.length,
        pendingOrders,
        completedOrders,
        totalRevenue: revenue,
        totalCodes: codes.length,
        activeCodes: codes.filter((d: any) => {
          const exp = d.fields?.expiresAt?.timestampValue;
          const uses = parseInt(d.fields?.currentUses?.integerValue || '0');
          const max = parseInt(d.fields?.maxUses?.integerValue || '0');
          return (!exp || exp > now.toISOString()) && uses < max;
        }).length,
      }, 200, origin);
    }

    // ─── Admin: Disable/Enable/Delete user ──────────────────────────
    if (path === '/api/admin/update-user' && method === 'POST') {
      const body = await request.json() as { uid?: string; action?: string; value?: any };
      if (!body.uid || !body.action) return json({ error: 'uid and action required' }, 400, origin);
      const adminToken = await getAdminAccessToken(env);
      const url = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/users/${body.uid}`;
      if (body.action === 'delete') {
        const res = await fetch(url, { method: 'DELETE', headers: { Authorization: `Bearer ${adminToken}` } });
        if (!res.ok) return json({ error: 'Failed to delete user' }, 500, origin);
        return json({ success: true }, 200, origin);
      }
      const fieldPath = body.action;
      const fieldValue = body.value;
      let field: any;
      if (typeof fieldValue === 'boolean') field = { booleanValue: fieldValue };
      else if (typeof fieldValue === 'number') field = { integerValue: fieldValue.toString() };
      else field = { stringValue: String(fieldValue) };
      const res = await fetch(`${url}?updateMask.fieldPaths=${fieldPath}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: { [fieldPath]: field } }),
      });
      if (!res.ok) return json({ error: 'Failed to update user: ' + await res.text() }, 500, origin);
      return json({ success: true }, 200, origin);
    }

    // Verify USDT transaction
    if (path === '/api/verify-usdt' && method === 'POST') {
      const body = await request.json() as { txHash?: string };
      const txHash = body.txHash;

      if (!txHash || txHash.length < 10) {
        return json({ error: 'Invalid transaction hash' }, 400, origin);
      }

      const result = await verifyUsdtTransaction(txHash, 1);

      if (result.valid) {
        const tokensToAdd = Math.floor(result.actualAmount);
        return json({ success: true, tokens: tokensToAdd }, 200, origin);
      }

      return json({ error: 'Transaction not valid or amount too low' }, 400, origin);
    }

    // Admin endpoints
    const admin = await isAdmin(env, uid, bearerToken);
    if (!admin) {
      return json({ error: 'Admin access required' }, 403, origin);
    }

    if (path === '/api/admin/approve-payment' && method === 'POST') {
      return json({ success: true }, 200, origin);
    }

    if (path === '/api/admin/reject-payment' && method === 'POST') {
      return json({ success: true }, 200, origin);
    }

    return json({ error: 'Not found' }, 404, origin);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    const status = message.includes('Insufficient') ? 402 : 500;
    return json({ error: message }, status, origin);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return handleRequest(request, env);
  },
};
