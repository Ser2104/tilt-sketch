# Publishing Tilt Sketch on Google Play

The Android app lives in `android/`. It is a Capacitor wrapper that packs the same game files as the website, so it works offline. Wrist practice and the clinician panel are hidden in the app (they only appear on the website with `?rehab=1`). GitHub Actions builds it: no Android Studio needed.

- App ID: `io.github.ser2104.tiltsketch` (permanent once uploaded)
- Store texts and graphics: [`listing.md`](listing.md) and the images in this folder
- Privacy policy: https://ser2104.github.io/tilt-sketch/privacy.html

## 1. Add the upload key to GitHub (once)

The upload key signs every version you send to Google Play. Keep a private backup of the key file and its password: every future update must be signed with the same key. Never commit it.

In GitHub: **Settings › Secrets and variables › Actions › New repository secret**, add:

| Name | Value |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | the key file, base64-encoded on one line |
| `ANDROID_KEYSTORE_PASSWORD` | the key store password |
| `ANDROID_KEY_ALIAS` | `upload` |
| `ANDROID_KEY_PASSWORD` | the key password |

To make a new key yourself instead: `keytool -genkeypair -storetype PKCS12 -keystore upload.jks -alias upload -keyalg RSA -keysize 4096 -validity 10000`, then `base64 -w0 upload.jks` (macOS: `base64 -i upload.jks`).

## 2. Build the app

**Actions › android › Run workflow**, type the version (for example `1.0`) and run it. After about 3 minutes, download the artifact `tilt-sketch-android-N` from the run page. It contains:

- `app-release.aab`: the file you upload to Google Play
- `app-release.apk`: install it on your own Android phone to test first

Each run gets a higher version code automatically. Pushing a tag such as `v1.0.1` also builds a release.

Pushes to `main` that touch the Android files make an unsigned test build only, to check that the app still compiles.

## 3. Create the app in Play Console

1. Sign up at https://play.google.com/console (one-time US$25 fee, identity verification).
2. **Create app**: name `Tilt Sketch`, language English (United States), type **Game**, **Free**. Accept the declarations.
3. Fill **Store presence › Main store listing** from [`listing.md`](listing.md) and upload the images.

## 4. App content forms (Policy › App content)

| Form | Answer |
|---|---|
| Privacy policy | `https://ser2104.github.io/tilt-sketch/privacy.html` |
| App access | All functionality is available without special access |
| Ads | No, the app does not contain ads |
| Content rating | Category: Game. Violence, sexuality, language, drugs, gambling: No. Users can interact or exchange content: **Yes** (players see each other’s nicknames and drawings in rooms and leaderboards). Shares location: No. Digital purchases: No. Expected rating: Everyone / PEGI 3 |
| Target audience | 13–15, 16–17 and 18+ (not under 13, so the Families policy does not apply) |
| News app | No |
| Government app | No |
| Financial features | None |
| Health apps | Not a health app (it is a game). The wrist-practice and clinician features are turned off in the app |
| Data safety | See the table below |

### Data safety answers

Does your app collect or share user data? **Yes**. Is all data encrypted in transit? **Yes**. Can users request deletion? **Yes** (in-app for donated drawings; on request for rankings, through the contact on the privacy policy).

| Data type | Collected | Shared with third parties | Optional | Purpose |
|---|---|---|---|---|
| Personal info › Name (nickname on rankings) | Yes | No | No (needed to appear on rankings) | App functionality |
| Device or other IDs (random phone ID) | Yes | No | No | App functionality |
| App activity › Other user-generated content (donated drawings, feedback answers) | Yes | No | Yes | App functionality, Analytics |

Not collected: health info, location, photos or videos (the camera view never leaves the phone), contacts, financial info, messages, audio, files, web history.

## 5. Testing, then production

New personal developer accounts must run a **closed test with at least 12 testers for 14 days in a row** before applying for production.

1. **Testing › Closed testing › Create track**, add an email list of 12+ testers (friends with Android phones), upload `app-release.aab`, and roll out.
2. Send testers the opt-in link. They must stay opted in for 14 days.
3. Then **Apply for production** and answer the questions about your test.

Choose **Use Google Play App Signing** when asked (the default). Google then holds the final signing key; your upload key only proves the update comes from you, and Google can reset it if it is ever lost.

## Updating the app

Change the website code as usual, then run the **android** workflow again with a higher version (for example `1.0.1`) and upload the new `.aab` to the same track.
