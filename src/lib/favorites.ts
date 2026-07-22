// Client-side personalization store (localStorage-backed), shared by the rail
// island and the hero star button. Factory form so tests inject a fake storage.

export type RailView = 'directory' | 'foryou';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface FavoritesStore {
  getStarred(): string[];
  isStarred(slug: string): boolean;
  toggleStar(slug: string): void;
  getRecent(): string[];
  recordView(slug: string): void;
  getView(): RailView;
  setView(v: RailView): void;
  subscribe(cb: () => void): () => void;
}

const K_STARRED = 'kc:starred';
const K_RECENT = 'kc:recent';
const K_VIEW = 'kc:view';
const RECENT_CAP = 10;

let storageListenerBound = false;

function readArray(storage: StorageLike, key: string): string[] {
  try {
    const raw = storage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function writeArray(storage: StorageLike, key: string, value: string[]): void {
  try { storage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
}

export function createFavoritesStore(storage: StorageLike): FavoritesStore {
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((cb) => cb());

  if (typeof window !== 'undefined' && !storageListenerBound) {
    storageListenerBound = true;
    window.addEventListener('storage', (e) => {
      if (e.key && e.key.startsWith('kc:')) emit();
    });
  }

  return {
    getStarred: () => readArray(storage, K_STARRED),
    isStarred: (slug) => readArray(storage, K_STARRED).includes(slug),
    toggleStar(slug) {
      const cur = readArray(storage, K_STARRED);
      const next = cur.includes(slug) ? cur.filter((s) => s !== slug) : [slug, ...cur];
      writeArray(storage, K_STARRED, next);
      emit();
    },
    getRecent: () => readArray(storage, K_RECENT),
    recordView(slug) {
      const cur = readArray(storage, K_RECENT);
      const next = [slug, ...cur.filter((s) => s !== slug)].slice(0, RECENT_CAP);
      writeArray(storage, K_RECENT, next);
      emit();
    },
    getView() {
      try {
        return storage.getItem(K_VIEW) === 'foryou' ? 'foryou' : 'directory';
      } catch { return 'directory'; }
    },
    setView(v) {
      try { storage.setItem(K_VIEW, v); } catch { /* ignore */ }
      emit();
    },
    subscribe(cb) {
      listeners.add(cb);
      return () => { listeners.delete(cb); };
    },
  };
}

function safeStorage(): StorageLike {
  try {
    if (typeof localStorage !== 'undefined') {
      const probe = '__kc_probe__';
      localStorage.setItem(probe, '1');
      localStorage.removeItem(probe);
      return localStorage;
    }
  } catch { /* fall through to in-memory */ }
  const mem = new Map<string, string>();
  return {
    getItem: (k) => (mem.has(k) ? mem.get(k)! : null),
    setItem: (k, v) => { mem.set(k, v); },
  };
}

export const favorites: FavoritesStore = createFavoritesStore(safeStorage());
