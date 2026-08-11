# Drivflo Driver — Native iOS App

## What this is

A thin native iOS wrapper around the existing driver pages at drivflo.ca. It does **not**
duplicate any UI or business logic — it loads `https://www.drivflo.ca/driver` inside a
native shell (via Capacitor), and adds one thing a browser fundamentally cannot do:
**background GPS tracking** that keeps working even when the app is minimized or the
phone is locked.

The regular web app is completely unaffected by this. Dealers and drivers using
drivflo.ca in a browser will never notice this exists.

## How background tracking works

1. When a driver marks a job "in progress" inside the app, the web app (running inside
   the native shell) tells the native background-geolocation plugin to start watching
   that job.
2. The native plugin keeps producing location updates even while the app is backgrounded,
   using iOS's real background location APIs (not a browser tab that gets throttled).
3. Each update is inserted into the same `job_location_pings` table the web app already
   uses — same tracking line on the map, same everything, just with real background
   updates instead of updates that pause the moment the tab loses focus.

## One-time setup (run these on your Mac — this repo folder needs Xcode, which only runs on macOS)

```bash
cd mobile-driver-app
npm install
npx cap add ios
npx cap sync ios
npx cap open ios
```

That last command opens the project in Xcode. From there:

1. **Signing**: In Xcode, select the project → "Signing & Capabilities" → choose your
   Apple Developer team (you'll need to create a free Apple ID / Developer account
   if you haven't — a paid $99/year account is only needed once you want to distribute
   via TestFlight or the App Store; a free account lets you build and run on your own
   physical device for testing).
2. **Background Modes capability**: Still in "Signing & Capabilities," click "+ Capability"
   and add "Background Modes." Check the box for "Location updates."
3. **Location permission text**: Open `ios/App/App/Info.plist` and confirm the
   `NSLocationAlwaysAndWhenInUseUsageDescription` and
   `NSLocationWhenInUseUsageDescription` entries exist (added automatically by the
   background-geolocation plugin's install step, but worth double-checking). These are
   the messages iOS shows the driver when asking for location permission.
4. Plug your iPhone into your Mac (or use a simulator, though background location
   behaves more reliably on a real device), select it as the run target, and hit ▶️.

## Making changes later

Since the app loads the live site, most changes to the driver pages (new features,
bug fixes, UI tweaks) show up automatically — no app rebuild or App Store update needed.
You'll only need to rebuild/resubmit the native app itself for things like: changing
the app icon, splash screen, native permissions, or the background-tracking bridge code
itself.

## Next steps once this is running

- Test background tracking on a real device: start a job, background the app, walk
  around, confirm the map trail keeps updating.
- Get a paid Apple Developer account ($99/year) when ready to distribute via TestFlight
  to real drivers, or the App Store.
- Same process can be repeated for Android later, using Android Studio instead of Xcode.
