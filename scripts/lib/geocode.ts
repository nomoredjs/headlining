/**
 * Nominatim geocoder with in-memory cache.
 * Rate limit: 1 request/second (Nominatim policy).
 */

const cache = new Map<string, { lat: number; lng: number } | null>();

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function geocodeCity(
  city: string,
  country: string
): Promise<{ lat: number; lng: number } | null> {
  const key = `${city}||${country}`.toLowerCase();
  if (cache.has(key)) return cache.get(key)!;

  // Rate limit: wait 1 second between requests
  await sleep(1100);

  const query = encodeURIComponent(`${city}, ${country}`);
  const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "headlin.ing/1.0 (data@headlin.ing)",
        Accept: "application/json",
      },
    });
    if (!res.ok) {
      console.warn(`Nominatim ${res.status} for "${city}, ${country}"`);
      cache.set(key, null);
      return null;
    }
    const data = (await res.json()) as Array<{ lat: string; lon: string }>;
    if (!data.length) {
      cache.set(key, null);
      return null;
    }
    const result = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    cache.set(key, result);
    return result;
  } catch (err) {
    console.warn(`Nominatim error for "${city}, ${country}":`, err);
    cache.set(key, null);
    return null;
  }
}
