# Changesets

Every pull request that changes the published package should include a changeset describing the change and its semver bump.

```sh
bun run changeset
```

Commit the generated file with your pull request. When it reaches `main`, CI opens (or updates) a "Version packages" pull request; merging that publishes the release.
