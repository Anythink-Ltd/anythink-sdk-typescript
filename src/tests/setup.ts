import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock window.location
Object.defineProperty(window, "location", {
  value: {
    href: "",
    pathname: "/",
  },
  writable: true,
  configurable: true,
});

// Newer Node versions expose a broken global localStorage that shadows jsdom's
if (typeof window.localStorage === "undefined") {
  const items = new Map<string, string>();
  const storage = {
    getItem: (k: string) => items.get(k) ?? null,
    setItem: (k: string, v: string) => void items.set(k, String(v)),
    removeItem: (k: string) => void items.delete(k),
    clear: () => items.clear(),
    key: (i: number) => [...items.keys()][i] ?? null,
    get length() {
      return items.size;
    },
  };
  Object.defineProperty(window, "localStorage", { value: storage, configurable: true });
}
