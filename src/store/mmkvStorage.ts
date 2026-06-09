import { StateStorage } from 'zustand/middleware';

interface SimpleStorage {
  set: (key: string, value: string) => void;
  getString: (key: string) => string | undefined;
  delete: (key: string) => void;
}

let storage: SimpleStorage;

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { MMKV } = require('react-native-mmkv');
  storage = new MMKV({
    id: 'stackup-storage',
  });
} catch (e) {
  // Fallback to in-memory storage in non-react-native environments (like Node.js unit tests)
  const mockStorage = new Map<string, string>();
  storage = {
    set: (key: string, value: string) => mockStorage.set(key, value),
    getString: (key: string) => mockStorage.get(key),
    delete: (key: string) => mockStorage.delete(key),
  };
}

export const mmkvStorage: StateStorage = {
  setItem: (name, value) => {
    storage.set(name, value);
  },
  getItem: (name) => {
    const value = storage.getString(name);
    return value ?? null;
  },
  removeItem: (name) => {
    storage.delete(name);
  },
};
