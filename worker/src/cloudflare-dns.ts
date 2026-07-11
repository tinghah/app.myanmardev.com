import type { Env } from './env';

const CF_API = 'https://api.cloudflare.com/client/v4';

interface CfResponse<T = unknown> {
  success: boolean;
  errors: { code: number; message: string }[];
  result: T;
  result_info?: { total_count: number };
}

async function cfRequest<T>(
  env: Env,
  path: string,
  options: RequestInit = {},
): Promise<CfResponse<T>> {
  const res = await fetch(`${CF_API}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
      ...options.headers,
    },
  });

  const data = await res.json<CfResponse<T>>();

  if (!data.success) {
    const msg = data.errors?.[0]?.message || 'Cloudflare API error';
    throw new Error(msg);
  }

  return data;
}

export async function checkDnsRecord(
  env: Env,
  subdomain: string,
): Promise<boolean> {
  const name = `${subdomain}.${env.DOMAIN_NAME}`;
  const data = await cfRequest(env, `/zones/${env.CLOUDFLARE_ZONE_ID}/dns_records?name=${name}`);
  return (data.result_info?.total_count ?? 0) === 0;
}

export async function createDnsRecord(
  env: Env,
  subdomain: string,
  target: string,
  type: 'A' | 'CNAME',
): Promise<string> {
  const name = `${subdomain}.${env.DOMAIN_NAME}`;

  const data = await cfRequest<{ id: string }>(
    env,
    `/zones/${env.CLOUDFLARE_ZONE_ID}/dns_records`,
    {
      method: 'POST',
      body: JSON.stringify({
        type,
        name,
        content: target,
        ttl: 1, // auto
        proxied: type === 'CNAME',
      }),
    },
  );

  return data.result.id;
}

export async function deleteDnsRecord(
  env: Env,
  cloudflareRecordId: string,
): Promise<void> {
  await cfRequest(
    env,
    `/zones/${env.CLOUDFLARE_ZONE_ID}/dns_records/${cloudflareRecordId}`,
    { method: 'DELETE' },
  );
}

export async function findDnsRecordId(
  env: Env,
  subdomain: string,
): Promise<string | null> {
  const name = `${subdomain}.${env.DOMAIN_NAME}`;
  const data = await cfRequest<{ id: string }[]>(
    env,
    `/zones/${env.CLOUDFLARE_ZONE_ID}/dns_records?name=${name}`,
  );

  const records = data.result as unknown as { id: string }[];
  return records.length > 0 ? records[0].id : null;
}
