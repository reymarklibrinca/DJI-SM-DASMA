// These read the values you just saved in Vercel's Environment Variables
const BIN_ID = import.meta.env.VITE_JSONBIN_BIN_ID;
const API_KEY = import.meta.env.VITE_JSONBIN_KEY;

// 1. Function to DOWNLOAD your latest data from the cloud
export async function fetchCloudData() {
  if (!BIN_ID || !API_KEY) {
    console.warn("JSONBin credentials missing from environment variables.");
    return null;
  }

  try {
    const res = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}/latest`, {
      headers: {
        'X-Master-Key': API_KEY,
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch from JSONBin: ${res.statusText}`);
    }

    const json = await res.json();
    // JSONBin wraps your saved JSON in a property named "record"
    return json.record;
  } catch (err) {
    console.error('Error reading cloud data:', err);
    return null;
  }
}

// 2. Function to UPLOAD your updated data to the cloud
export async function saveCloudData(data: any) {
  if (!BIN_ID || !API_KEY) {
    console.warn("JSONBin credentials missing from environment variables.");
    return;
  }

  try {
    await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Master-Key': API_KEY,
        'X-Bin-Versioning': 'false', // Keeps the file cleanly updated without filling version history
      },
      body: JSON.stringify(data),
    });
  } catch (err) {
    console.error('Error saving cloud data:', err);
  }
}
