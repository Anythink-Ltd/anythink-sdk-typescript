import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AxiosAdapter, InternalAxiosRequestConfig } from "axios";
import { AxiosError } from "axios";
import { AuthenticatedBaseService } from "@/services/AuthenticatedBaseService";
import type { AuthClient } from "@/auth/client";

class TestService extends AuthenticatedBaseService {
  doGet = <T>(url: string, config?: object) => this.get<T>(url, config);
  doPost = <T>(url: string, data?: unknown) => this.post<unknown, T>(url, data);
  doPostForm = <T>(url: string, data: unknown) => this.postFormData<unknown, T>(url, data);
  doPut = <T>(url: string, data?: unknown) => this.put<unknown, T>(url, data);
  doPatch = <T>(url: string, data?: unknown) => this.patch<unknown, T>(url, data);
  doDelete = <T>(url: string) => this.delete<T>(url);
}

type Responder = (config: InternalAxiosRequestConfig, call: number) => { status: number; data?: unknown };

const setup = (opts: { token: string | null; responder: Responder; refresh?: () => Promise<unknown> }) => {
  let token = opts.token;
  const refreshSession = vi.fn(
    opts.refresh ??
      (async () => {
        token = "new_token";
        return { data: { session: { access_token: "new_token" } }, error: null };
      })
  );
  const authClient = { getAccessToken: () => token, refreshSession } as unknown as AuthClient;
  const service = new TestService(authClient, "https://api.example.com");
  const seen: InternalAxiosRequestConfig[] = [];
  const adapter: AxiosAdapter = async (config) => {
    seen.push(config);
    const { status, data } = opts.responder(config, seen.length);
    const response = { data, status, statusText: "", headers: {}, config };
    if (status >= 400) {
      throw new AxiosError("fail", String(status), config, null, response);
    }
    return response;
  };
  service.client.defaults.adapter = adapter;
  return { service, seen, refreshSession };
};

const ok: Responder = () => ({ status: 200, data: { ok: true } });
const auth = (c: InternalAxiosRequestConfig) => c.headers.get("Authorization");

describe("AuthenticatedBaseService", () => {
  beforeEach(() => vi.clearAllMocks());

  // Rule: bearer token handling
  it("request_SignedIn_InjectsBearerToken", async () => {
    const { service, seen } = setup({ token: "abc", responder: ok });
    await service.doGet("/things");
    expect(auth(seen[0])).toBe("Bearer abc");
  });

  it("request_SignedOut_SendsNoAuthorizationHeader", async () => {
    const { service, seen } = setup({ token: null, responder: ok });
    await service.doGet("/things");
    expect(auth(seen[0])).toBeFalsy();
  });

  // Rule: 401 refreshes once and retries
  it("response401_RefreshesOnceAndRetriesWithNewToken", async () => {
    const { service, seen, refreshSession } = setup({
      token: "old",
      responder: (c) => (auth(c) === "Bearer new_token" ? { status: 200, data: { ok: 1 } } : { status: 401 }),
    });
    const result = await service.doGet("/things");

    expect(result).toEqual({ ok: 1 });
    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(seen).toHaveLength(2);
    expect(auth(seen[1])).toBe("Bearer new_token");
    expect(seen[1].url).toBe("/things");
  });

  it("response401_SecondUnauthorisedOnRetry_IsNotRetriedAgain", async () => {
    const { service, seen, refreshSession } = setup({ token: "old", responder: () => ({ status: 401 }) });

    await expect(service.doGet("/things")).rejects.toMatchObject({ response: { status: 401 } });
    expect(seen).toHaveLength(2);
    expect(refreshSession).toHaveBeenCalledTimes(1);
  });

  it("response401_RefreshReturnsNoSession_RejectsWithOriginalError", async () => {
    const { service, seen } = setup({
      token: "old",
      responder: () => ({ status: 401 }),
      refresh: async () => ({ data: { session: null }, error: new Error("no") }),
    });

    await expect(service.doGet("/things")).rejects.toMatchObject({ response: { status: 401 } });
    expect(seen).toHaveLength(1);
  });

  it("responseNon401_PassesThroughWithoutRefresh", async () => {
    const { service, refreshSession } = setup({ token: "abc", responder: () => ({ status: 500 }) });

    await expect(service.doGet("/things")).rejects.toMatchObject({ response: { status: 500 } });
    expect(refreshSession).not.toHaveBeenCalled();
  });

  it("response401_RefreshThrows_RejectsWithRefreshError", async () => {
    const boom = new Error("network");
    const { service } = setup({
      token: "old",
      responder: () => ({ status: 401 }),
      refresh: async () => {
        throw boom;
      },
    });

    await expect(service.doGet("/things")).rejects.toBe(boom);
  });

  it.todo("refreshFailure_NotifiesProvider — ANY-339");

  // Rule: helpers hit the right method, URL and body
  it("get_SendsGetToUrlAndReturnsData", async () => {
    const { service, seen } = setup({ token: "t", responder: ok });
    expect(await service.doGet("/a")).toEqual({ ok: true });
    expect([seen[0].method, seen[0].url]).toEqual(["get", "/a"]);
  });

  it("post_SendsPostWithBody", async () => {
    const { service, seen } = setup({ token: "t", responder: ok });
    await service.doPost("/a", { x: 1 });
    expect([seen[0].method, seen[0].url, JSON.parse(seen[0].data)]).toEqual(["post", "/a", { x: 1 }]);
  });

  it("postFormData_SendsMultipartContentType", async () => {
    const { service, seen } = setup({ token: "t", responder: ok });
    await service.doPostForm("/upload", new FormData());
    expect(seen[0].method).toBe("post");
    expect(String(seen[0].headers.get("Content-Type"))).toContain("multipart/form-data");
  });

  it("put_SendsPutWithBody", async () => {
    const { service, seen } = setup({ token: "t", responder: ok });
    await service.doPut("/a", { x: 2 });
    expect([seen[0].method, JSON.parse(seen[0].data)]).toEqual(["put", { x: 2 }]);
  });

  it("patch_SendsPatchWithBody", async () => {
    const { service, seen } = setup({ token: "t", responder: ok });
    await service.doPatch("/a", { x: 3 });
    expect([seen[0].method, JSON.parse(seen[0].data)]).toEqual(["patch", { x: 3 }]);
  });

  it("delete_SendsDeleteToUrl", async () => {
    const { service, seen } = setup({ token: "t", responder: ok });
    await service.doDelete("/a");
    expect([seen[0].method, seen[0].url]).toEqual(["delete", "/a"]);
  });

  it("getClient_ReturnsUnderlyingAxiosInstanceWithBaseUrl", () => {
    const { service } = setup({ token: "t", responder: ok });
    expect(service.getClient()).toBe(service.client);
    expect(service.client.defaults.baseURL).toBe("https://api.example.com");
  });
});
