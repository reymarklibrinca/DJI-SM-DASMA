const BIN_ID = import.meta.env.VITE_JSONBIN_BIN_ID;
const API_KEY = import.meta.env.VITE_JSONBIN_KEY;

export async function fetchCloudData() {
  try {
    const res = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}/latest`, {
      headers: {
        'X-Master-Key': API_KEY,
      },
    });
    if (!res.ok) throw new Error('Failed to fetch from JSONBin');
    const json = await res.json();
    return json.record;
  } catch (err) {
    console.error('Error reading cloud data:', err);
    return null;
  }
}

export async function saveCloudData(data: any) {
  try {
    await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Master-Key': API_KEY,
        'X-Bin-Versioning': 'false', // Keeps your bin clean without creating hundreds of version histories
      },
      body: JSON.stringify(data),
    });
  } catch (err) {
    console.error('Error saving cloud data:', err);
  }
}
