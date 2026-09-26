# Mysticals for iOS

The Mysticals calendar as an Expo (React Native) app. It looks like the desktop app and runs the same core: CalDAV and Google accounts, sync, the same rules. iOS only for now; the code stays cross-platform so Android can follow.

## Develop

Needs macOS with Xcode (and an iOS simulator runtime: Xcode → Settings → Components), Node.js 22 and pnpm 10. Run from the repo root:

```sh
pnpm i
EXPO_PUBLIC_MYSTICALS_MOCK=1 pnpm --filter @mysticals/mobile ios   # build the dev client, open the simulator, start Metro
```

`EXPO_PUBLIC_MYSTICALS_MOCK=1` swaps the backend for two fake isolated accounts with no network, like `MYSTICALS_MOCK=1` on desktop. Without it the app talks to real servers. The first native build takes several minutes; after that `pnpm --filter @mysticals/mobile dev` starts only Metro, and the installed dev client reloads on save.

Google sign-in needs an iOS OAuth client ID from Google Cloud (application type iOS, bundle ID `app.mysticals.mobile`): put `EXPO_PUBLIC_MYSTICALS_GOOGLE_IOS_CLIENT_ID=…` in `apps/mobile/.env.local`.

Checks:

```sh
pnpm --filter @mysticals/mobile typecheck
pnpm --filter @mysticals/mobile test                              # vitest, pure logic only (no RN runtime)
cd apps/mobile && npx expo export --platform ios                  # the JS bundle builds (CI runs this)
```

### Driving the app from scripts

In dev builds `src/e2e.ts` exposes `globalThis.__e2e` (`router`, `api`, `bus`, `toast`, `nav`, `sheets`, `setTheme`, `reload`). `scripts/e2e.mjs` evaluates an expression in the running app through Metro's inspector and prints the result:

```sh
node scripts/e2e.mjs "__e2e.nav.set({ view: 'week' })"
node scripts/e2e.mjs --port 8081 "__e2e.sheets.openSettings()"
xcrun simctl io booted screenshot shot.png
```

## Architecture

- **Core reuse.** Everything that isn't UI comes from `@mysticals/core`: types, the `Api` contract, account store, CalDAV and Google providers, sync engine, view layout math. Mobile only adds platform adapters in `src/api/mobile`: credentials encrypted with a key kept in the iOS Keychain, files, Google OAuth, and background refresh through expo-background-task.
- **One API.** `src/api/index.ts` exports the `api` singleton implementing the desktop `Api` interface (the mock backend in mock mode). Screens call it the way the desktop renderer calls `window.api`.
- **Theme.** `src/theme.ts` holds the desktop design tokens (the four dark palettes, mono labels, event colours) plus spacing, grid and motion constants. Style only through `useTheme()`.
- **Navigation.** expo-router, routes in `src/app/`. Event details, the editor, calendars, invites, accounts and settings open as native form sheets.
- **Native folders.** `ios/` and `android/` are generated (Continuous Native Generation) and git-ignored. Configure native behaviour in `app.json` and `plugins/`. `plugins/withSceneLifecycle.js` is required by the iOS 27 SDK; keep it.

## Release (TestFlight)

Builds run on [EAS](https://docs.expo.dev/eas/) (Expo's cloud): it signs with the Apple account, builds, and submits to App Store Connect. Nothing needs Xcode locally.

`eas.json` profiles:

| Profile | What |
| --- | --- |
| `development` | Dev client for registered devices (internal distribution) |
| `development-simulator` | Dev client for the iOS simulator |
| `preview` | Release build for registered devices (internal distribution, ad hoc) |
| `production` | App Store build, uploaded to TestFlight |

Versions: `expo.version` in `app.json` is the user-facing version and is bumped by hand. The build number is kept by EAS (`cli.appVersionSource: remote`) and `production` increments it on every build, so nothing has to be committed back after a CI build.

### One-time setup (repo owner)

> TODO(owner): these need your Expo and Apple logins, so they aren't done yet.

1. Create an Expo account, then link the project:

   ```sh
   cd apps/mobile
   npx eas-cli@latest login
   npx eas-cli@latest init   # creates the EAS project, writes extra.eas.projectId (and owner) into app.json
   ```

   Commit the `app.json` change.
2. Set up iOS credentials and the App Store Connect app. The first interactive build does both: it logs in to your Apple Developer account, creates the distribution certificate and provisioning profile, and stores them on EAS.

   ```sh
   npx eas-cli@latest build --platform ios --profile production
   ```

3. Give EAS an App Store Connect API key for submissions: `npx eas-cli@latest credentials --platform ios` → production → App Store Connect API key → create one (or reuse the Team key the desktop release uses). Then run `npx eas-cli@latest submit --platform ios --profile production --latest` once, and add the App Store Connect app ID it reports (Apple ID of the app, App Store Connect → App Information) to `eas.json` as `submit.production.ios.ascAppId`, so CI can submit without prompts.
4. Create an Expo access token (expo.dev → Account settings → Access tokens) and add it to GitHub as the **`EXPO_TOKEN`** repo secret.
5. Add the Google iOS OAuth client ID as the **`EXPO_PUBLIC_MYSTICALS_GOOGLE_IOS_CLIENT_ID`** repo variable (Settings → Variables; it ships inside the app, so it isn't a secret). CI copies it into the EAS `production` environment before each build, because cloud builds don't see the runner's environment. Or set it once yourself: `npx eas-cli@latest env:set --environment production --name EXPO_PUBLIC_MYSTICALS_GOOGLE_IOS_CLIENT_ID --value … --visibility plaintext`.

### Each release

1. Bump `expo.version` in `apps/mobile/app.json`.
2. Commit, then tag with the `mobile-v` prefix (plain `v*` tags are desktop releases):

   ```sh
   git tag mobile-v0.1.0
   git push origin mobile-v0.1.0
   ```

`.github/workflows/mobile.yml` checks that the tag matches `app.json`, runs typecheck and tests, then `eas build --profile production --auto-submit`. When the build finishes, EAS uploads it to App Store Connect; after Apple's processing (usually 5–15 minutes) it appears in TestFlight for internal testers. External testers and App Store review are managed in App Store Connect. The workflow can also be started by hand (Actions → Mobile release → Run workflow), which skips the tag check.

Required GitHub settings: secret `EXPO_TOKEN`, variable `EXPO_PUBLIC_MYSTICALS_GOOGLE_IOS_CLIENT_ID`. Apple credentials live on EAS, not in GitHub.
