import { initializeApp, getApps, getApp } from 'firebase/app';
import { getDatabase, ref, get, set, onValue } from 'firebase/database';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDFECXpMU-iTNCv47cd23pn_TXszPzDCDO",
  authDomain: "djidasma.firebaseapp.com",
  databaseURL: "https://djidasma-default-rtdb.firebaseio.com",
  projectId: "djidasma",
  storageBucket: "djidasma.appspot.com",
};

// Initialize Firebase (prevent re-initializing if already active)
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const db = getDatabase(app);
const storeRef = ref(db, 'store_data');

/**
 * 1. Fetch latest store data once
 */
export async function fetchCloudData() {
  try {
    const snapshot = await get(storeRef);
    if (snapshot.exists()) {
      return snapshot.val();
    }
    return null;
  } catch (err) {
    console.error('Firebase read error:', err);
    return null;
  }
}

/**
 * 2. Save store data directly to Firebase
 */
export async function saveCloudData(data: any) {
  try {
    await set(storeRef, data);
    return true;
  } catch (err) {
    console.error('Firebase save error:', err);
    return false;
  }
}

/**
 * 3. Real-time live listener (auto-syncs between devices without page refresh)
 */
export function subscribeToCloudData(callback: (data: any) => void) {
  return onValue(
    storeRef,
    (snapshot) => {
      if (snapshot.exists()) {
        callback(snapshot.val());
      }
    },
    (error) => {
      console.error('Firebase subscription error:', error);
    }
  );
}
