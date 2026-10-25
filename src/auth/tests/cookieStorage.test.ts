import { describe, it, expect, beforeEach, vi } from "vitest";
import { createCookieStorage } from "@/auth/cookieStorage";

const clearCookies = () => {
  document.cookie.split(";").forEach((c) => {
    const key = c.split("=")[0].trim();
    if (key) document.cookie = `${key}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/`;
  });
};

const spyOnCookieWrites = () => {
  const writes: string[] = [];
  const desc = Object.getOwnPropertyDescriptor(Document.prototype, "cookie")!;
  Object.defineProperty(document, "cookie", {
    configurable: true,
    get: () => desc.get!.call(document),
    set: (v: string) => {
      writes.push(v);
      desc.set!.call(document, v);
    },
  });
  return writes;
};

beforeEach(() => {
  delete (document as unknown as Record<string, unknown>).cookie;
  clearCookies();
});

describe("createCookieStorage", () => {
  it("cookie_SetThenGet_RoundTripsValue", () => {
    const s = createCookieStorage({ name: "k" });
    s.setItem("k", "hello world; with=special&chars");
    expect(s.getItem("k")).toBe("hello world; with=special&chars");
  });

  it("cookie_Missing_GetReturnsNull", () => {
    expect(createCookieStorage({ name: "k" }).getItem("absent")).toBeNull();
  });

  it("cookie_Remove_ClearsValue", () => {
    const s = createCookieStorage({ name: "k" });
    s.setItem("k", "v");
    s.removeItem("k");
    expect(s.getItem("k")).toBeNull();
  });

  it("cookie_GetWithSimilarlyPrefixedName_DoesNotMatch", () => {
    const s = createCookieStorage({ name: "k" });
    s.setItem("key_long", "v");
    expect(s.getItem("key")).toBeNull();
  });

  it("cookie_SetNonJsonValue_StillStores", () => {
    const s = createCookieStorage({ name: "k" });
    s.setItem("k", "not json");
    expect(s.getItem("k")).toBe("not json");
  });

  it("cookie_GetThrows_ReturnsNull", () => {
    const s = createCookieStorage({ name: "k" });
    vi.spyOn(console, "warn").mockImplementation(() => {});
    document.cookie = "k=%E0%A4%A; path=/";
    expect(s.getItem("k")).toBeNull();
  });

  it("cookie_Set_WritesPathSameSiteAndSecureAttributes", () => {
    const writes = spyOnCookieWrites();
    createCookieStorage({ name: "k", path: "/app", sameSite: "strict", secure: true }).setItem("k", "v");
    expect(writes[0]).toContain("path=/app");
    expect(writes[0]).toContain("samesite=strict");
    expect(writes[0]).toContain("; secure");
  });

  it("cookie_Set_DefaultsToLaxRootPathAndNoSecureOverHttp", () => {
    const writes = spyOnCookieWrites();
    createCookieStorage({ name: "k" }).setItem("k", "v");
    expect(writes[0]).toContain("path=/");
    expect(writes[0]).toContain("samesite=lax");
    expect(writes[0]).not.toContain("secure");
  });

  it("cookie_SetWithDomain_WritesDomainAttribute", () => {
    const writes = spyOnCookieWrites();
    createCookieStorage({ name: "k", domain: "example.com" }).setItem("k", "v");
    expect(writes[0]).toContain("domain=example.com");
  });

  it("cookie_Remove_ExpiresWithMatchingPathAndDomain", () => {
    const writes = spyOnCookieWrites();
    createCookieStorage({ name: "k", path: "/app", domain: "example.com" }).removeItem("k");
    expect(writes[0]).toContain("expires=Thu, 01 Jan 1970");
    expect(writes[0]).toContain("path=/app");
    expect(writes[0]).toContain("domain=example.com");
  });

  it.todo("cookie_PersistedSessionShape_WritesMaxAgeFromRefreshTokenLifetime — ANY-339");
});
