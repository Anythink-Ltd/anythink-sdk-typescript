# Testing

Tests use [Vitest](https://vitest.dev/) with jsdom and Testing Library. New tests are named after the rule they prove (`subject_condition_outcome`); the older `client.test.ts` and `provider.test.tsx` suites still use `should …` names.

```bash
bun run test            # run once
bun run test:watch      # watch mode
bun run test:coverage   # run with v8 coverage and thresholds
```

## Suites

### `src/auth/tests/client.test.ts` (AuthClient)

The store and axios are mocked; these tests lock the client's contract.

- Constructor: axios base URL, default cookie name, custom cookie storage options.
- `signIn`: success with email and password, `orgId` forwarding, custom token endpoint, error shapes (string, object, no response, empty message, non-Axios), user info fetched after sign-in.
- `register`: success, custom endpoint, error handling.
- `refreshSession`: success, custom endpoint, error when there is no refresh token, session cleared on failure, user info fetched afterwards.
- `getSession`, `getUser`, `getAccessToken`, `getRefreshToken`, `getStore`: read accessors, including null cases.
- `setSession`: builds a session from tokens, fetches the user, handles errors.
- `changePassword`: success, custom endpoint, no access token, error handling.
- `signOut`: invalidates the refresh token, custom endpoint, and always signs out locally even when the server call fails (401, 404, other).
- `isAuthenticated`: valid, missing and expired sessions.
- `fetchUserInfo`: success, no access token, error handling.

### `src/auth/tests/provider.test.tsx` (AuthProvider)

- Session expiration handling: refreshes when expired with a refresh token; redirects to login when refresh fails or no refresh token exists; never redirects while on an auth page.
- Initialisation: fetches user info after a successful refresh; falls back to refresh when `fetchUserInfo` fails; redirects when both fail, when the refresh succeeds but the fetch still fails, and when there is no session.

### `src/auth/tests/store.test.ts` (auth store storage adapters)

Storage adapters:

- `cookieStorage_Default_UsedWhenNoStorageType`
- `cookieStorage_ExplicitCookieType_UsedLikeDefault`
- `localStorage_SetItem_MirrorsToCookie`
- `sessionStorage_SetItem_MirrorsToCookie`
- `localStorage_RemoveItem_RemovesCookieMirror`
- `sessionStorage_RemoveItem_RemovesCookieMirror`
- `sessionStorage_EmptyStore_FallsBackToCookieAndBackfills`
- `localStorage_EmptyStore_FallsBackToCookieAndBackfills`
- `sessionStorage_PopulatedStore_WinsOverCookie`
- `persist_Partialize_OmitsLoadingAndError`

Actions:

- `signOut_ClearsSessionUserAndError`
- `setSession_ClearsPreviousError`

### `src/auth/tests/providerContext.test.tsx` (AuthProvider context and wrappers)

- `useAuth_OutsideProvider_Throws`
- `isAuthenticated_UnexpiredSession_IsTrue`, `isAuthenticated_NoSession_IsFalse`, `isAuthenticated_ExpiredSession_IsFalse`
- `signIn_Success_InvokesOnSignInCallback`, `signIn_Error_DoesNotInvokeOnSignInCallback`
- `signOut_Success_InvokesOnSignOutCallback`, `signOut_Error_DoesNotInvokeOnSignOutCallback`
- `init_ValidSession_FetchesUserInfoWithoutRefreshing`
- `init_ValidSessionButUserFetchFails_RefreshesAndRetriesUserFetch`
- `init_OnAuthPage_SkipsInitialisation`
- `init_UnexpectedError_SignsOutAndRedirects`

### `src/auth/tests/cookieStorage.test.ts` (cookie adapter)

- `cookie_SetThenGet_RoundTripsValue`, `cookie_Missing_GetReturnsNull`, `cookie_Remove_ClearsValue`
- `cookie_GetWithSimilarlyPrefixedName_DoesNotMatch`, `cookie_SetNonJsonValue_StillStores`, `cookie_GetThrows_ReturnsNull`
- `cookie_Set_WritesPathSameSiteAndSecureAttributes`, `cookie_Set_DefaultsToLaxRootPathAndNoSecureOverHttp`, `cookie_SetWithDomain_WritesDomainAttribute`
- `cookie_Remove_ExpiresWithMatchingPathAndDomain`
- Todo: `cookie_PersistedSessionShape_WritesMaxAgeFromRefreshTokenLifetime` (ANY-339)

### `src/services/tests/AuthenticatedBaseService.test.ts` (request layer)

The axios adapter is stubbed, so no network or extra dependency is involved.

- `request_SignedIn_InjectsBearerToken`, `request_SignedOut_SendsNoAuthorizationHeader`
- `response401_RefreshesOnceAndRetriesWithNewToken`
- `response401_SecondUnauthorisedOnRetry_IsNotRetriedAgain`
- `response401_RefreshReturnsNoSession_RejectsWithOriginalError`, `response401_RefreshThrows_RejectsWithRefreshError`
- `responseNon401_PassesThroughWithoutRefresh`
- `get_`, `post_`, `postFormData_`, `put_`, `patch_`, `delete_` helpers send the right method, URL and body; `getClient_ReturnsUnderlyingAxiosInstanceWithBaseUrl`
- Todo (ANY-339): `refreshFailure_NotifiesProvider`

Concurrent 401s each call `AuthClient.refreshSession()`, which shares one in-flight request (covered in `client.test.ts`).

## Coverage

Coverage is measured with v8 over `src/**`, excluding tests, `src/index.ts` and `src/types/**`. The thresholds in `vitest.config.ts` are a ratchet: they are set to the measured values rounded down, and `bun run test:coverage` fails if coverage drops below them. When coverage rises, raise the thresholds in the same pull request; never lower them.

Current thresholds: lines 91, statements 91, functions 95, branches 80 (measured 91.31 / 91.31 / 95.74 / 80.68).

## Reports

`bun run test` and `bun run test:coverage` write a JUnit report to `reports/junit.xml`, and coverage to `coverage/` (`text`, `json-summary` and `lcov`). Both directories are git-ignored. CI uploads them as the `sdk-test-results` artifact on every run, including failures.
