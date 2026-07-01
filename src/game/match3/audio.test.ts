import { afterEach, describe, expect, test } from "vitest";
import { GemAudio, musicStepForBeat } from "./audio";

const originalLocalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");

afterEach(() => {
  if (originalLocalStorage) {
    Object.defineProperty(globalThis, "localStorage", originalLocalStorage);
    return;
  }

  delete (globalThis as { localStorage?: Storage }).localStorage;
});

function useLocalStorageMock(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  const storage = {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.get(key) ?? null;
    },
    key(index: number) {
      return [...store.keys()][index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    }
  } satisfies Storage;

  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: storage
  });

  return store;
}

describe("gem audio sequencing", () => {
  test("cycles background music through a stable gem-like motif", () => {
    const first = musicStepForBeat(0);
    const repeated = musicStepForBeat(8);

    expect(repeated.frequency).toBe(first.frequency);
    expect(first.duration).toBeGreaterThan(musicStepForBeat(1).duration);
  });

  test("keeps music tones in a soft high-register range", () => {
    const frequencies = Array.from({ length: 8 }, (_, beat) => musicStepForBeat(beat).frequency);

    expect(Math.min(...frequencies)).toBeGreaterThanOrEqual(392);
    expect(Math.max(...frequencies)).toBeLessThanOrEqual(784);
  });

  test("recovers an old muted preference once after the audio UI update", () => {
    const store = useLocalStorageMock({ "audio-test": "false" });
    const audio = new GemAudio("audio-test");

    expect(audio.enabled).toBe(true);
    expect(store.get("audio-test")).toBe("true");
    expect(store.get("audio-test-preference-version")).toBe("2");

    audio.destroy();
  });

  test("respects a newly confirmed muted preference", () => {
    const store = useLocalStorageMock({
      "audio-test": "false",
      "audio-test-preference-version": "2"
    });
    const audio = new GemAudio("audio-test");

    expect(audio.enabled).toBe(false);
    expect(store.get("audio-test")).toBe("false");

    audio.destroy();
  });
});
