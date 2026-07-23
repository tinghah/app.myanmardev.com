import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { getDB } from './firebase';

export interface Product {
  id?: string;
  name: string;
  slug: string;
  description: string;
  features: string[];
  priceUSD: number;
  priceMMK: number;
  tokenCost: number;
  status: 'live' | 'comingsoon';
  category: string;
  icon: string;
  sortOrder: number;
  duration?: number; // months, default 6
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export async function getAllProducts(): Promise<Product[]> {
  const db = getDB();
  const productsRef = collection(db, 'products');
  const q = query(productsRef, orderBy('sortOrder', 'asc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => {
    const data = doc.data();
    // Map database fields to Product interface (handle legacy field names)
    return {
      id: doc.id,
      name: data.name || data.title || '',
      slug: data.slug || '',
      description: data.description || data['description '] || '',
      features: data.features || [],
      priceUSD: data.priceUSD || 0,
      priceMMK: data.priceMMK || 0,
      tokenCost: data.tokenCost || data.tokenPrice || 10,
      status: data.status || (data.active ? 'live' : 'comingsoon'),
      category: data.category || '',
      icon: data.icon || data['icon    '] || '📦',
      sortOrder: data.sortOrder || 0,
      duration: data.duration || 6,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    } as Product;
  });
}

export async function getLiveProducts(): Promise<Product[]> {
  const all = await getAllProducts();
  return all.filter((p) => p.status === 'live');
}

export async function getProduct(id: string): Promise<Product | null> {
  const db = getDB();
  const docRef = doc(db, 'products', id);
  const snap = await getDoc(docRef);
  if (snap.exists()) {
    const data = snap.data();
    return {
      id: snap.id,
      name: data.name || data.title || '',
      slug: data.slug || '',
      description: data.description || data['description '] || '',
      features: data.features || [],
      priceUSD: data.priceUSD || 0,
      priceMMK: data.priceMMK || 0,
      tokenCost: data.tokenCost || data.tokenPrice || 10,
      status: data.status || (data.active ? 'live' : 'comingsoon'),
      category: data.category || '',
      icon: data.icon || data['icon    '] || '📦',
      sortOrder: data.sortOrder || 0,
      duration: data.duration || 6,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    } as Product;
  }
  return null;
}

export async function createProduct(product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const db = getDB();
  const productsRef = collection(db, 'products');
  const docRef = await addDoc(productsRef, {
    ...product,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  return docRef.id;
}

export async function updateProduct(id: string, updates: Partial<Product>): Promise<void> {
  const db = getDB();
  const docRef = doc(db, 'products', id);
  await updateDoc(docRef, {
    ...updates,
    updatedAt: Timestamp.now(),
  });
}

export async function deleteProduct(id: string): Promise<void> {
  const db = getDB();
  const docRef = doc(db, 'products', id);
  await deleteDoc(docRef);
}
