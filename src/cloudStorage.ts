import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  getDocFromServer,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {},
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  return errInfo;
}

// Initialize Firebase App
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Cloud Firestore using provisioned database ID
export const db = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId);

const STORE_PATH = 'store_state';
const STORE_DOC_ID = 'dasmarinas';

// Test connection on boot
export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase client appears offline:', error.message);
    }
    return false;
  }
}

// Trigger initial test
testConnection().catch(() => {});

/**
 * 1. Fetch latest store data once from Firestore
 */
export async function fetchCloudData(): Promise<any | null> {
  const path = `${STORE_PATH}/${STORE_DOC_ID}`;
  try {
    const storeDoc = doc(db, STORE_PATH, STORE_DOC_ID);
    const snapshot = await getDoc(storeDoc);
    if (snapshot.exists()) {
      return snapshot.data();
    }
    return null;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
    return null;
  }
}

/**
 * 2. Save store data directly to Cloud Firestore
 */
export async function saveCloudData(data: any): Promise<boolean> {
  const path = `${STORE_PATH}/${STORE_DOC_ID}`;
  try {
    const storeDoc = doc(db, STORE_PATH, STORE_DOC_ID);
    // Sanitize data (remove undefined, serialize arrays)
    const sanitized = JSON.parse(JSON.stringify(data));
    sanitized.updatedAt = new Date().toISOString();
    await setDoc(storeDoc, sanitized, { merge: true });
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
    return false;
  }
}

/**
 * 3. Real-time live listener (auto-syncs between store devices without page refresh)
 */
export function subscribeToCloudData(callback: (data: any) => void): () => void {
  const path = `${STORE_PATH}/${STORE_DOC_ID}`;
  const storeDoc = doc(db, STORE_PATH, STORE_DOC_ID);

  const unsubscribe = onSnapshot(
    storeDoc,
    (snapshot) => {
      if (snapshot.exists()) {
        callback(snapshot.data());
      }
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );

  return unsubscribe;
}
