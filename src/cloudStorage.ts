import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  initializeFirestore,
  getFirestore,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
} from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';
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

// Initialize Cloud Firestore using the provisioned database ID.
// Auto-detect falls back to long-polling only when WebSockets are blocked (proxies, iframes).
let firestoreDb: any;
try {
  firestoreDb = initializeFirestore(app, {
    experimentalAutoDetectLongPolling: true,
    ignoreUndefinedProperties: true,
  }, (firebaseConfig as any).firestoreDatabaseId);
} catch (e) {
  // If already initialized (e.g. during fast refresh/re-import), reuse the existing instance
  firestoreDb = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId);
}

export const db = firestoreDb;


// ---------------------------------------------------------------------------
// Firestore does NOT allow arrays directly inside arrays. Sales and inventory
// are arrays of tuples, so every write used to fail with "Nested arrays are not
// supported" and the app silently stayed in local/offline mode.
// Fix: wrap any array that sits directly inside another array as { __a: [...] }
// on write, and unwrap on read. Legacy/unwrapped data is still read correctly.
// ---------------------------------------------------------------------------
const WRAP_KEY = '__a';

export function encodeForCloud(value: any, insideArray = false): any {
  if (Array.isArray(value)) {
    const items = value.map((v) => encodeForCloud(v, true));
    return insideArray ? { [WRAP_KEY]: items } : items;
  }
  if (value && typeof value === 'object') {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) {
      if (v !== undefined) out[k] = encodeForCloud(v, false);
    }
    return out;
  }
  return value;
}

export function decodeFromCloud(value: any): any {
  if (Array.isArray(value)) return value.map(decodeFromCloud);
  if (value && typeof value === 'object') {
    const keys = Object.keys(value);
    if (keys.length === 1 && keys[0] === WRAP_KEY && Array.isArray(value[WRAP_KEY])) {
      return value[WRAP_KEY].map(decodeFromCloud);
    }
    const out: Record<string, any> = {};
    for (const k of keys) out[k] = decodeFromCloud(value[k]);
    return out;
  }
  return value;
}

// Best-effort anonymous sign-in. Never blocks sync if Auth is not enabled.
let authReady: Promise<void> | null = null;
function ensureAuth(): Promise<void> {
  if (!authReady) {
    authReady = (async () => {
      try {
        const auth = getAuth(app);
        if (!auth.currentUser) await signInAnonymously(auth);
      } catch (e) {
        console.info('Anonymous auth unavailable, continuing unauthenticated:', (e as any)?.code || e);
      }
    })();
  }
  return authReady;
}

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
    await ensureAuth();
    const storeDoc = doc(db, STORE_PATH, STORE_DOC_ID);
    const snapshot = await getDoc(storeDoc);
    if (snapshot.exists()) {
      return decodeFromCloud(snapshot.data());
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
    await ensureAuth();
    const storeDoc = doc(db, STORE_PATH, STORE_DOC_ID);
    const sanitized = encodeForCloud(JSON.parse(JSON.stringify(data)));
    sanitized.updatedAt = new Date().toISOString();
    await setDoc(storeDoc, sanitized, { merge: true });
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
    // One immediate retry on transient network glitch
    try {
      await new Promise((res) => setTimeout(res, 500));
      await ensureAuth();
      const storeDoc = doc(db, STORE_PATH, STORE_DOC_ID);
      const sanitized = encodeForCloud(JSON.parse(JSON.stringify(data)));
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
  callback: (data: any, meta?: { fromCache: boolean }) => void,
  onError?: (err: any) => void
): () => void {
  const path = `${STORE_PATH}/${STORE_DOC_ID}`;
  const storeDoc = doc(db, STORE_PATH, STORE_DOC_ID);

  ensureAuth();
  const unsubscribe = onSnapshot(
    storeDoc,
    (snapshot) => {
      if (snapshot.exists()) {
        callback(decodeFromCloud(snapshot.data()), { fromCache: snapshot.metadata.fromCache });
      }
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
      if (onError) onError(error);
    }
  );

  return unsubscribe;
}
