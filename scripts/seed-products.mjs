#!/usr/bin/env node

/**
 * Seed default products into Firestore
 *
 * Usage:
 *   node scripts/seed-products.mjs
 *
 * Requires .env file with PUBLIC_FIREBASE_API_KEY and PUBLIC_FIREBASE_PROJECT_ID
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// --- Parse .env ---
function loadEnv() {
  try {
    const envPath = resolve(ROOT, '.env');
    const content = readFileSync(envPath, 'utf-8');
    const env = {};
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) continue;
      const key = trimmed.slice(0, eqIndex).trim();
      let value = trimmed.slice(eqIndex + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      env[key] = value;
    }
    return env;
  } catch (err) {
    console.error('Failed to load .env file:', err.message);
    process.exit(1);
  }
}

const products = [
  {
    name: 'Subdomain Registration',
    slug: 'subdomain',
    description: 'Get your own .myanmardev.com subdomain instantly. Point it to GitHub Pages, Vercel, Netlify, or any hosting.',
    features: [
      'Instant DNS propagation (~30s)',
      'Free SSL certificate auto-provisioned',
      'GitHub Pages, Vercel, Netlify ready',
      'Custom CNAME & A records',
      'Ownership TXT verification',
    ],
    priceUSD: 2.50,
    priceMMK: 10000,
    tokenCost: 10,
    status: 'live',
    category: 'dns',
    icon: '🌐',
    sortOrder: 1,
  },
  {
    name: 'Website Builder',
    slug: 'website-builder',
    description: 'Professional website templates with one-click deploy to your subdomain.',
    features: [
      'Professional templates',
      'One-click deploy to subdomain',
      'Responsive & SEO optimized',
      'Custom content editor',
      'Analytics dashboard',
    ],
    priceUSD: 5.00,
    priceMMK: 20000,
    tokenCost: 20,
    status: 'comingsoon',
    category: 'hosting',
    icon: '🖥️',
    sortOrder: 2,
  },
  {
    name: 'Developer Portfolio',
    slug: 'portfolio',
    description: 'Auto-sync from GitHub repos with live demo links and contribution graphs.',
    features: [
      'Auto-sync from GitHub repos',
      'Live demo links & project stats',
      'Contribution graph display',
      'Custom subdomain support',
      'Auto-updates on git push',
    ],
    priceUSD: 3.00,
    priceMMK: 12000,
    tokenCost: 15,
    status: 'comingsoon',
    category: 'portfolio',
    icon: '👨‍💻',
    sortOrder: 3,
  },
];

// Convert a JS value to Firestore REST API format
function toFirestoreValue(value) {
  if (value === null || value === undefined) {
    return { nullValue: null };
  }
  if (typeof value === 'boolean') {
    return { booleanValue: value };
  }
  if (typeof value === 'number') {
    if (Number.isInteger(value)) {
      return { integerValue: value };
    }
    return { doubleValue: value };
  }
  if (typeof value === 'string') {
    // Check if it looks like a timestamp
    if (value instanceof Date || (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value))) {
      return { timestampValue: typeof value === 'string' ? value : value.toISOString() };
    }
    return { stringValue: value };
  }
  if (Array.isArray(value)) {
    return {
      arrayValue: {
        values: value.map((v) => toFirestoreValue(v)),
      },
    };
  }
  if (typeof value === 'object') {
    const fields = {};
    for (const [k, v] of Object.entries(value)) {
      fields[k] = toFirestoreValue(v);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(value) };
}

async function setDocument(projectId, apiKey, collection, docId, data) {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collection}/${docId}?key=${apiKey}`;

  const fields = {};
  for (const [key, value] of Object.entries(data)) {
    fields[key] = toFirestoreValue(value);
  }

  const response = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  });

  const result = await response.json();
  if (result.error) {
    throw new Error(`Failed to set ${collection}/${docId}: ${result.error.message}`);
  }
  return result;
}

async function seed() {
  const env = loadEnv();
  const projectId = env.PUBLIC_FIREBASE_PROJECT_ID;
  const apiKey = env.PUBLIC_FIREBASE_API_KEY;

  if (!projectId || !apiKey) {
    console.error('Missing PUBLIC_FIREBASE_PROJECT_ID or PUBLIC_FIREBASE_API_KEY in .env');
    process.exit(1);
  }

  console.log(`Seeding ${products.length} products to Firestore...`);

  for (const product of products) {
    const now = new Date().toISOString();
    await setDocument(projectId, apiKey, 'products', product.slug, {
      ...product,
      createdAt: now,
      updatedAt: now,
    });
    console.log(`  + ${product.name} (${product.slug}) [${product.status}]`);
  }

  console.log(`Done. Seeded ${products.length} products.`);
}

seed().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
