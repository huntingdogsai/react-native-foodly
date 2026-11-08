// Favourites belong to the signed-in account and are kept ON THE DEVICE (AsyncStorage), so they survive
// an app restart — the client-side persistence a QA run verifies against what the UI shows.
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'foodly.favourites';

function keyFor(userId: string): string {
  return `${KEY}.${userId}`;
}

export async function loadFavourites(userId: string): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(keyFor(userId));
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export async function saveFavourites(userId: string, ids: string[]): Promise<void> {
  try {
    await AsyncStorage.setItem(keyFor(userId), JSON.stringify(ids));
  } catch {
    /* storage can be unavailable; the UI still works for the session */
  }
}
