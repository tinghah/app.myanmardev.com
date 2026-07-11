import { getAuthInstance } from './firebase';

interface CheckResponse {
  available: boolean;
  subdomain: string;
  domain: string;
  message: string;
}

interface CreateResponse {
  success: boolean;
  subdomain: string;
  domain: string;
  record: {
    type: string;
    name: string;
    content: string;
  };
  message: string;
}

interface ErrorResponse {
  success: false;
  error: string;
}

const API_URL = import.meta.env.PUBLIC_WORKER_API_URL || 'http://localhost:8787';
const DEFAULT_DOMAIN = 'myanmardev.com';

async function authHeaders(): Promise<HeadersInit> {
  const token = await getAuthInstance().currentUser?.getIdToken();

  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/** Get list of available domains */
export async function getDomains(): Promise<string[]> {
  return [DEFAULT_DOMAIN];
}

/** Check if a subdomain is available */
export async function checkSubdomain(subdomain: string, domain: string): Promise<CheckResponse> {
  const res = await fetch(`${API_URL}/api/check-subdomain?subdomain=${encodeURIComponent(subdomain)}`, {
    method: 'GET',
    headers: await authHeaders(),
  });

  if (!res.ok) {
    const err: ErrorResponse = await res.json();
    return { available: false, subdomain, domain, message: err.error || 'DNS check failed' };
  }

  const data = await res.json() as { available: boolean };
  return {
    available: data.available,
    subdomain,
    domain,
    message: data.available ? 'Subdomain is available' : 'Subdomain is already taken',
  };
}

/** Create a CNAME record for the subdomain */
export async function createSubdomain(params: {
  subdomain: string;
  domain: string;
  platform: string;
  sourceUrl: string;
}): Promise<CreateResponse> {
  const target = resolveTarget(params.platform, params.sourceUrl);
  const res = await fetch(`${API_URL}/api/create-subdomain`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ subdomain: params.subdomain, target }),
  });

  if (!res.ok) {
    const err: ErrorResponse = await res.json();
    throw new Error(err.error || 'DNS creation failed');
  }

  const data = await res.json() as { success: boolean; recordId: string };
  return {
    success: data.success,
    subdomain: `${params.subdomain}.${params.domain}`,
    domain: params.domain,
    record: {
      type: isIpAddress(target) ? 'A' : 'CNAME',
      name: `${params.subdomain}.${params.domain}`,
      content: target,
    },
    message: `Created DNS record ${data.recordId}`,
  };
}

function resolveTarget(platform: string, sourceUrl: string): string {
  const value = sourceUrl.trim().toLowerCase();

  if (platform === 'github') return `${value}.github.io`;
  if (platform === 'vercel') return 'cname.vercel-dns.com';
  if (platform === 'netlify') return `${value}.netlify.app`;
  return value;
}

function isIpAddress(value: string): boolean {
  return /^(\d{1,3}\.){3}\d{1,3}$/.test(value);
}
