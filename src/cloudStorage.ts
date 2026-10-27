import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  initializeFirestore,
  getFirestore,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
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

// Initialize Cloud Firestore using provisioned database ID with experimentalForceLongPolling
// CRITICAL: experimentalForceLongPolling forces HTTPS long-polling instead of WebSockets,
// preventing 'client is offline' / 'unreachable' errors caused by sandboxed iframes or WebSocket blocks.
let firestoreDb: any;
try {
  firestoreDb = initializeFirestore(app, {
    experimentalForceLongPolling: true,
    ignoreUndefinedProperties: true,
  }, (firebaseConfig as any).firestoreDatabaseId);
} catch (e) {
  // If already initialized (e.g. during fast refresh/re-import), reuse the existing instance
  firestoreDb = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId);
}

export const db = firestoreDb;

const STORE_PATH = 'store_state';
const STORE_DOC_ID = 'dasmarinas';

// Test connection on boot
export async function testConnection(): Promise<boolean> {
  try {
    const storeDoc = doc(db, STORE_PATH, STORE_DOC_ID);
    const snap = await getDoc(storeDoc);
    return snap.exists();
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase client appears offline:', error.message);
    } else {
      console.warn('Firebase connection test error:', error);
    }
    return false;
  }
}

// Trigger initial test
testConnection().catch(() => {});

/**
 * 1. Fetch latest store data once from Firestore
 * Returns data if found, null if document doesn't exist, throws on network/unreachable error
 */
export async function fetchCloudData(): Promise<any | null> {
  const path = `${STORE_PATH}/${STORE_DOC_ID}`;
  try {
    const storeDoc = doc(db, STORE_PATH, STORE_DOC_ID);
    const snapshot = await getDoc(storeDoc);
    if (snapshot.exists()) {
      return snapshot.data();
    }
    return null; // document genuinely not created yet
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
    throw err; // Allow callers to know this was a network/offline error
  }
}

/**
 * 2. Save store data directly to Cloud Firestore with retry
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
    // One immediate retry on transient network glitch
    try {
      await new Promise((res) => setTimeout(res, 500));
      const storeDoc = doc(db, STORE_PATH, STORE_DOC_ID);
      const sanitized = JSON.parse(JSON.stringify(data));
      sanitized.updatedAt = new Date().toISOString();
      await setDoc(storeDoc, sanitized, { merge: true });
      return true;
    } catch (retryErr) {
      handleFirestoreError(retryErr, OperationType.WRITE, path);
      return false;
    }
  }
}

/**
 * 3. Real-time live listener (auto-syncs between store devices without page refresh)
 */
export function subscribeToCloudData(
  callback: (data: any) => void,
  onError?: (err: any) => void
): () => void {
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
      if (onError) onError(error);
    }
  );

  return unsubscribe;
}
