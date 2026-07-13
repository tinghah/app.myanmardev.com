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
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export async function getAllProducts(): Promise<Product[]> {
  const db = getDB();
  const productsRef = collection(db, 'products');
  const q = query(productsRef, orderBy('sortOrder', 'asc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Product[];
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
    return { id: snap.id, ...snap.data() } as Product;
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
