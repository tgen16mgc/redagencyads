export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export type StorageSlot<T> = {
  key: string;
  legacyKey: string;
  deserialize: (raw: string | null) => T;
};

export function readStorageSlot<T>(storage: StorageLike, slot: StorageSlot<T>): T {
  const currentValue = storage.getItem(slot.key);
  const legacyValue = currentValue === null ? storage.getItem(slot.legacyKey) : null;
  if (legacyValue !== null) {
    storage.setItem(slot.key, legacyValue);
    storage.removeItem(slot.legacyKey);
  }
  return slot.deserialize(currentValue ?? legacyValue);
}
