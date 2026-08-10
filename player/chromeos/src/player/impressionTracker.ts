/**
 * Impression tracker using IndexedDB for offline persistence.
 * Generates SlotPlayKey for server-side deduplication.
 */
import { generateUUID } from '../utils/uuid';
export interface TrackedImpression {
  slotPlayKey: string;
  bookingId: string | null;
  campaignId: string | null;
  creativeId: string | null;
  ownerContentId: string | null;
  slotNumber: number;
  playedAt: string;
  durationSeconds: number;
  isFillerContent: boolean;
  synced: number; // 0 = not synced, 1 = synced (IDB can't index booleans)
}

const DB_NAME = 'ccms_impressions';
const STORE_NAME = 'impressions';
const DB_VERSION = 2;

export class ImpressionTracker {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        // v2: recreate store with numeric synced key (booleans are not valid IDB keys)
        if (db.objectStoreNames.contains(STORE_NAME)) {
          db.deleteObjectStore(STORE_NAME);
        }
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'slotPlayKey' });
        store.createIndex('synced', 'synced', { unique: false });
      };
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  async record(impression: Omit<TrackedImpression, 'synced'>): Promise<void> {
    if (!this.db) return;
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put({ ...impression, synced: 0 });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getPending(): Promise<TrackedImpression[]> {
    if (!this.db) return [];
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_NAME, 'readonly');
      const index = tx.objectStore(STORE_NAME).index('synced');
      const request = index.getAll(IDBKeyRange.only(0));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async markSynced(keys: string[]): Promise<void> {
    if (!this.db || keys.length === 0) return;
    const tx = this.db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    for (const key of keys) {
      const getReq = store.get(key);
      getReq.onsuccess = () => {
        if (getReq.result) {
          getReq.result.synced = 1;
          store.put(getReq.result);
        }
      };
    }
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /** Generate SlotPlayKey matching backend format */
  static generateSlotPlayKey(
    screenId: string,
    slotNumber: number,
    playedAt: Date
  ): string {
    const dateStr = playedAt.toISOString().split('T')[0]; // YYYY-MM-DD
    const hour = playedAt.getUTCHours().toString().padStart(2, '0');
    const min = playedAt.getUTCMinutes().toString().padStart(2, '0');
    return `${screenId}_S${slotNumber}_${dateStr}_${hour}${min}_${generateUUID().substring(0, 8)}`;
  }
}
