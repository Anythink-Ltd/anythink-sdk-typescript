import { describe, it, expect, vi, afterEach } from "vitest";
import { render, renderHook, act, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { AuthProvider, useAuth } from "@/auth/provider";
import type { AuthClient } from "@/auth/client";
import type { Session } from "@/types/auth";

const originalLocation = window.location;

afterEach(() => {
  Object.defineProperty(window, "location", { value: originalLocation, writable: true, configurable: true });
});

const session: Session = {
  access_token: "a",
  refresh_token: "r",
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
};

const makeClient = (state: { session: Session | null }, overrides: Record<string, unknown> = {}) => {
  const store = Object.assign(
    (selector: (s: unknown) => unknown) =>
      selector({ session: state.session, user: null, isLoading: false, error: null }),
    { getState: () => state, subscribe: () => () => {} }
  );
  return {
    getStore: () => store,
    getSession: () => ({ data: { session: state.session } }),
    fetchUserInfo: vi.fn().mockResolvedValue({ error: null }),
    refreshSession: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    register: vi.fn(),
    changePassword: vi.fn(),
    getAccessToken: vi.fn(() => state.session?.access_token ?? null),
    getRefreshToken: vi.fn(),
    ...overrides,
  } as unknown as AuthClient;
};

const wrapperFor = (client: AuthClient, props: Record<string, unknown> = {}) =>
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <AuthProvider authClient={client} loginUrl="" authPrefix="" {...props}>
        {children}
      </AuthProvider>
    );
  };

describe("AuthProvider context", () => {
  it("useAuth_OutsideProvider_Throws", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useAuth())).toThrow(/within an AuthProvider/);
  });

  it("isAuthenticated_UnexpiredSession_IsTrue", () => {
    const client = makeClient({ session });
    const { result } = renderHook(() => useAuth(), { wrapper: wrapperFor(client) });
    expect(result.current.isAuthenticated).toBe(true);
  });

  it("isAuthenticated_NoSession_IsFalse", () => {
    const client = makeClient({ session: null });
    const { result } = renderHook(() => useAuth(), { wrapper: wrapperFor(client) });
    expect(result.current.isAuthenticated).toBe(false);
  });

  it("isAuthenticated_ExpiredSession_IsFalse", () => {
    const client = makeClient({ session: { ...session, expires_at: 1 } }, {
      refreshSession: vi.fn().mockResolvedValue({ data: { session: null }, error: new Error("x") }),
    });
    const { result } = renderHook(() => useAuth(), { wrapper: wrapperFor(client) });
    expect(result.current.isAuthenticated).toBe(false);
  });

  it("signIn_Success_InvokesOnSignInCallback", async () => {
    const onSignIn = vi.fn();
    const client = makeClient({ session: null }, {
      signIn: vi.fn().mockResolvedValue({ data: { session }, error: null }),
    });
    const { result } = renderHook(() => useAuth(), {
      wrapper: wrapperFor(client, { callbacks: { onSignIn } }),
    });

    await act(async () => {
      await result.current.signIn("e@x.com", "pw", 5);
    });

    expect(client.signIn).toHaveBeenCalledWith("e@x.com", "pw", 5);
    expect(onSignIn).toHaveBeenCalledWith(session);
  });

  it("signIn_Error_DoesNotInvokeOnSignInCallback", async () => {
    const onSignIn = vi.fn();
    const client = makeClient({ session: null }, {
      signIn: vi.fn().mockResolvedValue({ data: { session: null }, error: new Error("bad") }),
    });
    const { result } = renderHook(() => useAuth(), {
      wrapper: wrapperFor(client, { callbacks: { onSignIn } }),
    });

    await act(async () => {
      await result.current.signIn("e@x.com", "pw");
    });

    expect(onSignIn).not.toHaveBeenCalled();
  });

  it("signOut_Success_InvokesOnSignOutCallback", async () => {
    const onSignOut = vi.fn();
    const client = makeClient({ session });
    const { result } = renderHook(() => useAuth(), {
      wrapper: wrapperFor(client, { callbacks: { onSignOut } }),
    });

    await act(async () => {
      await result.current.signOut();
    });

    expect(onSignOut).toHaveBeenCalledTimes(1);
  });

  it("signOut_Error_DoesNotInvokeOnSignOutCallback", async () => {
    const onSignOut = vi.fn();
    const client = makeClient({ session }, {
      signOut: vi.fn().mockResolvedValue({ error: new Error("x") }),
    });
    const { result } = renderHook(() => useAuth(), {
      wrapper: wrapperFor(client, { callbacks: { onSignOut } }),
    });

    await act(async () => {
      await result.current.signOut();
    });

    expect(onSignOut).not.toHaveBeenCalled();
  });

  it("init_ValidSession_FetchesUserInfoWithoutRefreshing", async () => {
    const client = makeClient({ session });
    render(<AuthProvider authClient={client} loginUrl="" authPrefix="">x</AuthProvider>);

    await waitFor(() => expect(client.fetchUserInfo).toHaveBeenCalledTimes(1));
    expect(client.refreshSession).not.toHaveBeenCalled();
  });

  it("init_ValidSessionButUserFetchFails_RefreshesAndRetriesUserFetch", async () => {
    const client = makeClient({ session }, {
      fetchUserInfo: vi.fn().mockResolvedValueOnce({ error: new Error("401") }).mockResolvedValue({ error: null }),
      refreshSession: vi.fn().mockResolvedValue({ data: { session }, error: null }),
    });
    render(<AuthProvider authClient={client} loginUrl="" authPrefix="">x</AuthProvider>);

    await waitFor(() => expect(client.fetchUserInfo).toHaveBeenCalledTimes(2));
    expect(client.refreshSession).toHaveBeenCalledTimes(1);
    expect(client.signOut).not.toHaveBeenCalled();
  });

  it("init_OnAuthPage_SkipsInitialisation", () => {
    Object.defineProperty(window, "location", {
      value: { href: "", pathname: "/auth/login" },
      writable: true,
      configurable: true,
    });
    const client = makeClient({ session });
    render(<AuthProvider authClient={client} loginUrl="" authPrefix="/auth">x</AuthProvider>);

    expect(client.fetchUserInfo).not.toHaveBeenCalled();
  });

  it("init_UnexpectedError_SignsOutAndRedirects", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    Object.defineProperty(window, "location", {
      value: { href: "", pathname: "/" },
      writable: true,
      configurable: true,
    });
    const client = makeClient({ session }, {
      fetchUserInfo: vi.fn().mockRejectedValue(new Error("boom")),
    });
    render(<AuthProvider authClient={client} loginUrl="/login" authPrefix="">x</AuthProvider>);

    await waitFor(() => expect(window.location.href).toBe("/login"));
    expect(client.signOut).toHaveBeenCalled();
  });
});
