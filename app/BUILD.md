# Getting the app onto your Android phone

> Heads up: the app currently runs on built-in demo data. It shows the full UX
> with sample conversations, but does not connect to real WhatsApp/Slack/etc.
> yet — that needs the bridge server from `../server` (Phase 0 in `../PLAN.md`).
> Everything below still gets the real app installed so you can try it on-device.

## Option A — Build an APK with EAS (recommended)

Expo builds the APK in the cloud, so you don't need Android Studio or the SDK
installed. You do need a free Expo account.

From the `app/` directory:

```bash
npm install -g eas-cli        # one-time
eas login                     # sign in (create a free account at expo.dev)
eas build -p android --profile preview
```

The `preview` profile (in `eas.json`) is already set to output an installable
**APK**. When the build finishes (~10–15 min) the CLI prints a URL and a QR code:

- Open that URL on your phone and tap **Download**, **or** scan the QR code.
- Android will warn about installing from an unknown source — allow it for your
  browser, then open the downloaded APK to install.

Rebuild any time you change the code by re-running the `eas build` command.

## Option B — Try it instantly with Expo Go (no build)

Fastest way to see it on your phone, though it runs through the Expo Go host app
rather than as a standalone install:

```bash
npm install
npx expo start --tunnel
```

Install **Expo Go** from the Play Store, then scan the QR code shown in the
terminal. `--tunnel` lets your phone reach the dev server even on a different
network.

## Option C — Build the APK locally (needs Android SDK)

Only if you'd rather not use the cloud and have Android Studio / SDK set up:

```bash
npx expo prebuild -p android
cd android && ./gradlew assembleRelease
# APK lands at android/app/build/outputs/apk/release/app-release.apk
```

## iPhone?

There's no APK equivalent — iOS needs a signed build. Use Option B (Expo Go) to
try it, or `eas build -p ios` with an Apple Developer account for a real install.
