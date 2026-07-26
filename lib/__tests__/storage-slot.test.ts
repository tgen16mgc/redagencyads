import { describe, expect, it } from "vitest";
import { CHART_PRESETS, deserializeCharts, presetToSpec, serializeCharts } from "@/lib/custom-chart";
import { readStorageSlot, type StorageLike } from "@/lib/storage-slot";

function memoryStorage(entries: Record<string, string> = {}) {
  const map = new Map(Object.entries(entries));
  const storage: StorageLike & { dump: () => Record<string, string> } = {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
    dump: () => Object.fromEntries(map),
  };
  return storage;
}

const textSlot = {
  key: "current-key",
  legacyKey: "legacy-key",
  deserialize: (raw: string | null) => raw ?? "empty",
};

describe("readStorageSlot", () => {
  it("reads the current key without touching the legacy key", () => {
    const storage = memoryStorage({ "current-key": "a", "legacy-key": "b" });
    expect(readStorageSlot(storage, textSlot)).toBe("a");
    expect(storage.dump()).toEqual({ "current-key": "a", "legacy-key": "b" });
  });

  it("migrates the legacy value once: writes it back to the current key and removes the legacy key", () => {
    const storage = memoryStorage({ "legacy-key": "b" });
    expect(readStorageSlot(storage, textSlot)).toBe("b");
    expect(storage.dump()).toEqual({ "current-key": "b" });
    expect(readStorageSlot(storage, textSlot)).toBe("b");
    expect(storage.dump()).toEqual({ "current-key": "b" });
  });

  it("hands null to the deserializer when neither key exists", () => {
    expect(readStorageSlot(memoryStorage(), textSlot)).toBe("empty");
  });

  it("returns the sanitizer's empty result for a corrupted payload", () => {
    const storage = memoryStorage({ "current-key": "{not json" });
    const charts = readStorageSlot(storage, {
      key: "current-key",
      legacyKey: "legacy-key",
      deserialize: deserializeCharts,
    });
    expect(charts).toEqual([]);
  });

  it("migrates a serialized Custom Chart payload intact", () => {
    const spec = presetToSpec(CHART_PRESETS[0], "en", "chart-1");
    const storage = memoryStorage({ "legacy-key": serializeCharts([spec]) });
    const charts = readStorageSlot(storage, {
      key: "current-key",
      legacyKey: "legacy-key",
      deserialize: deserializeCharts,
    });
    expect(charts).toEqual([spec]);
    expect(storage.dump()).toEqual({ "current-key": serializeCharts([spec]) });
  });
});
