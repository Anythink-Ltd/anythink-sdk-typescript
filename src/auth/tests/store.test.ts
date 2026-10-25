import { describe, it, expect, beforeEach } from "vitest";
import { createAuthStore } from "@/auth/store";
import type { Session } from "@/types/auth";

const NAME = "test_auth_session";

const session: Session = {
  access_token: "access",
  refresh_token: "refresh",
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
};

const persisted = JSON.stringify({ state: { session, user: null }, version: 0 });

const clearCookies = () => {
  document.cookie.split(";").forEach((c) => {
    const key = c.split("=")[0].trim();
    if (key) document.cookie = `${key}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/`;
  });
};

const cookieValue = (name: string) =>
  document.cookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${name}=`));

beforeEach(() => {
  window.sessionStorage.clear();
  window.localStorage.clear();
  clearCookies();
});

describe("createAuthStore storage adapters", () => {
  // Rule: the cookie is the default store when no storageType is given
  it("cookieStorage_Default_UsedWhenNoStorageType", () => {
    const store = createAuthStore({ name: NAME });
    store.getState().setSession(session);

    expect(cookieValue(NAME)).toBeDefined();
    expect(window.localStorage.getItem(NAME)).toBeNull();
    expect(window.sessionStorage.getItem(NAME)).toBeNull();
  });

  it("cookieStorage_ExplicitCookieType_UsedLikeDefault", () => {
    const store = createAuthStore({ name: NAME, storageType: "cookie" });
    store.getState().setSession(session);

    expect(cookieValue(NAME)).toBeDefined();
    expect(window.localStorage.getItem(NAME)).toBeNull();
  });

  // Rule: web-storage adapters mirror every write into the cookie
  it("localStorage_SetItem_MirrorsToCookie", () => {
    const store = createAuthStore({ name: NAME, storageType: "localStorage" });
    store.getState().setSession(session);

    expect(window.localStorage.getItem(NAME)).toContain("access");
    expect(cookieValue(NAME)).toBeDefined();
  });

  it("sessionStorage_SetItem_MirrorsToCookie", () => {
    const store = createAuthStore({ name: NAME, storageType: "sessionStorage" });
    store.getState().setSession(session);

    expect(window.sessionStorage.getItem(NAME)).toContain("access");
    expect(cookieValue(NAME)).toBeDefined();
  });

  it("localStorage_RemoveItem_RemovesCookieMirror", () => {
    const store = createAuthStore({ name: NAME, storageType: "localStorage" });
    store.getState().setSession(session);
    store.persist.clearStorage();

    expect(window.localStorage.getItem(NAME)).toBeNull();
    expect(cookieValue(NAME)).toBeUndefined();
  });

  it("sessionStorage_RemoveItem_RemovesCookieMirror", () => {
    const store = createAuthStore({ name: NAME, storageType: "sessionStorage" });
    store.getState().setSession(session);
    store.persist.clearStorage();

    expect(window.sessionStorage.getItem(NAME)).toBeNull();
    expect(cookieValue(NAME)).toBeUndefined();
  });

  // Rule: an empty web store falls back to the cookie and backfills itself
  it("sessionStorage_EmptyStore_FallsBackToCookieAndBackfills", () => {
    document.cookie = `${NAME}=${encodeURIComponent(persisted)}; path=/`;

    const store = createAuthStore({ name: NAME, storageType: "sessionStorage" });

    expect(store.getState().session?.access_token).toBe("access");
    expect(window.sessionStorage.getItem(NAME)).toBe(persisted);
  });

  it("localStorage_EmptyStore_FallsBackToCookieAndBackfills", () => {
    document.cookie = `${NAME}=${encodeURIComponent(persisted)}; path=/`;

    const store = createAuthStore({ name: NAME, storageType: "localStorage" });

    expect(store.getState().session?.access_token).toBe("access");
    expect(window.localStorage.getItem(NAME)).toBe(persisted);
  });

  it("sessionStorage_PopulatedStore_WinsOverCookie", () => {
    const other = JSON.stringify({
      state: { session: { ...session, access_token: "from-cookie" }, user: null },
      version: 0,
    });
    document.cookie = `${NAME}=${encodeURIComponent(other)}; path=/`;
    window.sessionStorage.setItem(NAME, persisted);

    const store = createAuthStore({ name: NAME, storageType: "sessionStorage" });

    expect(store.getState().session?.access_token).toBe("access");
  });

  // Rule: only session and user are persisted
  it("persist_Partialize_OmitsLoadingAndError", () => {
    const store = createAuthStore({ name: NAME });
    store.getState().setLoading(true);
    store.getState().setSession(session);

    const raw = decodeURIComponent(cookieValue(NAME)!.split("=").slice(1).join("="));
    const state = JSON.parse(raw).state;
    expect(Object.keys(state).sort()).toEqual(["session", "user"]);
  });
});

describe("createAuthStore actions", () => {
  it("signOut_ClearsSessionUserAndError", () => {
    const store = createAuthStore({ name: NAME });
    store.getState().setSession(session);
    store.getState().setError(new Error("boom"));
    store.getState().signOut();

    const { session: s, user, error } = store.getState();
    expect([s, user, error]).toEqual([null, null, null]);
  });

  it("setSession_ClearsPreviousError", () => {
    const store = createAuthStore({ name: NAME });
    store.getState().setError(new Error("boom"));
    store.getState().setSession(session);

    expect(store.getState().error).toBeNull();
  });
});
