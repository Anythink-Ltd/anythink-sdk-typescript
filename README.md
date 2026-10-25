# Anythink TypeScript SDK

The TypeScript SDK for [Anythink](https://anythink.cloud), published on npm as `@anythink-cloud/sdk`. It handles sign-in, sessions and authenticated requests for browser and React apps.

## Features

- **Multi-Tab Context Isolation**: Support for `sessionStorage` and `localStorage` to isolate tab sessions and bypass browser third-party cookie restrictions.
- **De-duplicated Silent Token Refresh**: Under the hood, concurrent token refresh requests are serialized and cached to prevent duplicate POST requests.
- **Axios Response Interceptor**: `AuthenticatedBaseService` registers an automatic interceptor that handles `401 Unauthorized` responses by silently refreshing the tokens and replaying original failed requests.

## Installation

```bash
npm install @anythink-cloud/sdk
# or
yarn add @anythink-cloud/sdk
# or
pnpm add @anythink-cloud/sdk
```

## Usage

To initialise the auth client:

```typescript
import { AuthClient } from "@anythink-cloud/sdk";

let authClientInstance: AuthClient | null = null;

export const getAuthClient = (): AuthClient => {
  if (!authClientInstance) {
    authClientInstance = new AuthClient({
      instanceUrl: "<your_anythink_instance_url>",
      orgId: 12345678, // <your_anythink_org_id>
      storageType: "sessionStorage", // Optional: "cookie" (default), "sessionStorage", or "localStorage"
      cookieStorage: {
        name: "anythink_auth_session", // use a unique identifier here
      },
    });
  }
  return authClientInstance;
};
```

To use the auth provider:

```typescript

const onSignOut = () => { ... }

// ....

<AuthProvider
    authClient={getAuthClient()}
    callbacks={{ onSignOut }}
    loginUrl="/auth/login" // replace with your login url
    authPrefix="/auth" // replace with your auth page prefix
>
    {children}
</AuthProvider>
```

To use the base service:

```typescript
class MyService extends AuthenticatedBaseService {
  constructor() {
    super(getAuthClient(), "<your_anythink_instance_url>");
  }
}
```

Login example:

```typescript
import { useAuth } from "@anythink-cloud/sdk";

const auth = useAuth();
const [error, setError] = useState("");

// ....

const handleLoginSubmit = async (values: {
  email: string;
  password: string;
}) => {
  try {
    setError(null);
    await auth?.signIn(values.email, values.password);
  } catch (err: unknown) {
    setError(err?.toString() ?? "An error occurred. Please try again.");
  }
};
```

## Development

The project uses [bun](https://bun.sh).

```bash
bun install               # install dependencies
bun run build             # build with tsup
bun run dev               # watch mode
bun run typecheck         # tsc --noEmit
bun run lint              # eslint
bun run test              # run the tests once
bun run test:coverage     # tests with coverage thresholds
bun run check:package     # publint and are-the-types-wrong
```

See [TESTING.md](./TESTING.md) for what the tests cover and the coverage policy.

## Contributing and releases

Releases are managed with [Changesets](https://github.com/changesets/changesets). If your pull request changes the published package, add a changeset:

```bash
bun run changeset
```

Commit the generated file in `.changeset/`. When it lands on `main`, CI opens a "Version packages" pull request; merging that publishes the release to npm with provenance and tags it `v<version>`. Releases are only ever published by CI from `main`.

## License

MIT
