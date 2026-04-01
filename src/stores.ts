export interface Store {
  id: string;
  name: string;
  region: string;
  city: string;
  hasGeotag: boolean;
}

const SCRIPT_URL = import.meta.env.VITE_GOOGLE_SHEET_URL as string;

/**
 * Fetch all stores from the Google Sheet via Apps Script Web App.
 */
export async function fetchStores(): Promise<Store[]> {
  if (!SCRIPT_URL) {
    throw new Error('VITE_GOOGLE_SHEET_URL is not set. Please add it to your .env file.');
  }

  const res = await fetch(SCRIPT_URL);
  const data = await res.json();

  if (!data.success) {
    throw new Error(data.error || 'Failed to fetch stores.');
  }

  return data.stores as Store[];
}

/**
 * Log a geotag for a store — sends coordinates to the Google Sheet.
 */
export async function logGeotag(payload: {
  storeId: string;
  latitude: number;
  longitude: number;
  accuracy: number;
}): Promise<{ success: boolean; message?: string; error?: string }> {
  if (!SCRIPT_URL) {
    throw new Error('VITE_GOOGLE_SHEET_URL is not set. Please add it to your .env file.');
  }

  const res = await fetch(SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' }, // Apps Script requires text/plain for CORS
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  return data;
}
