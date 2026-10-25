// Define the shape of your DJI Store Tracking Data
export interface DjiStoreBackup {
  sales: any[];
  tasks: Record<string, any>;
  leads: Record<string, any>;
  final: Record<string, any>;
  goal: number;
  pm: Record<string, number>;
}

const BIN_ID = import.meta.env.VITE_JSONBIN_BIN_ID;
const API_KEY = import.meta.env.VITE_JSONBIN_KEY;

/**
 * Downloads the latest store backup from JSONBin
 */
export async function fetchCloudData(): Promise<DjiStoreBackup | null> {
  if (!BIN_ID || !API_KEY) {
    console.warn("JSONBin credentials missing. Check Vercel Environment Variables.");
    return null;
  }

  try {
    // Add cache: 'no-store' to ensure devices don't serve stale cached responses
    const res = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}/latest`, {
      method: 'GET',
      headers: {
        'X-Master-Key': API_KEY,
      },
      cache: 'no-store',
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`JSONBin fetch error (${res.status}): ${errorText}`);
    }

    const json = await res.json();
    return json.record as DjiStoreBackup;
  } catch (err) {
    console.error('Error reading cloud data:', err);
    return null;
  }
}

/**
 * Uploads the updated store data to JSONBin
 */
export async function saveCloudData(data: DjiStoreBackup): Promise<boolean> {
  if (!BIN_ID || !API_KEY) {
    console.warn("JSONBin credentials missing. Check Vercel Environment Variables.");
    return false;
  }

  try {
    const res = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Master-Key': API_KEY,
        'X-Bin-Versioning': 'false', // Keeps single current record without piling version counts
      },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`JSONBin save error (${res.status}): ${errorText}`);
    }

    return true;
  } catch (err) {
    console.error('Error saving cloud data:', err);
    return false;
  }
}
