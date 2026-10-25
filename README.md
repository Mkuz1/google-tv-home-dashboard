# MK TV & Car Launcher

An Apple TV–style home screen and Islamic dashboard screensaver (with the M&D logo) for Google TV / Android TV, and a smooth touch home screen with azkar and Sharjah prayer times for Android car head units, in a Liquid Glass look.

Two APKs are built from the same code:

| APK | For | Home screen |
|---|---|---|
| `mk-tv-launcher.apk` | Google TV / Android TV 9+ | Apple TV style, remote control |
| `mk-car-launcher.apk` | Android car head units 8+ (made for 12" screens, e.g. 1920×720) | Azkar, Sharjah prayer times, app drawer; touch first |

![Home screen](docs/home.jpg)

| Screensaver | Prayer alert |
|---|---|
| ![Screensaver](docs/screensaver.jpg) | ![Prayer alert](docs/prayer-alert.jpg) |
| **Folder** | **Night mode, Friday reminder** |
| ![Folder](docs/folder.jpg) | ![Night mode](docs/night-mode.jpg) |

## Features

**Home screen**
- Apple TV layout: apps five to a row, a soft glow in the selected app's brand colour, glass capsule with clock, Wi-Fi and Settings.
- **Hold OK** on an app (or press Play/Pause) for a small glass menu: **Move**, **Add to Folder**, **Hide**, **Delete** (apps you installed).
- **Folders** like Apple TV: glass tiles previewing up to nine apps, named automatically (Entertainment, Games, Sony…), with Rename, Move and Remove Folder.
- Smooth on TV hardware: every tile is GPU-composited and only transform/opacity animate.

**Screensaver**
- Clock, Gregorian and Hijri date, weather now and for 4 days (Open-Meteo, no API key).
- **Finds where the TV is by itself**: time and dates follow the TV's time zone, the city comes from its internet connection (TVs have no GPS), and prayer times use the official method for that country (UAE Awqaf, Umm al-Qura, Egyptian, Karachi/Hanafi, Diyanet, JAKIM, ISNA, and more). You can fix the place and method yourself instead.
- Prayer times are calculated on the TV and keep working offline.
- **Silent prayer alert**: "Asr in 10 minutes", then "It's time for Asr" in Arabic and English. No sound.
- Azkar by time of day: morning (4 AM–12 PM), general (12–5 PM), evening (5 PM–4 AM), from Hisn al-Muslim.
- **Night mode** dims everything between Isha and Fajr.
- **Friday** Surat Al-Kahf reminder (Thursday Maghrib to Friday Maghrib) and **white days** fasting reminder (Hijri 12–15).
- Optional two-city world clock and your own logo text at the top.
- Backgrounds: your **shared Google Photos albums** (new photos appear by themselves) mixed with 10 bundled nature scenes.

## Car head unit (`mk-car-launcher.apk`)

A smooth, touch-first home screen for the car (made for 12" screens such as 1920×720), in Liquid Glass. Previews with placeholder app icons:

![Car home](docs/car-home.jpg)
![App drawer](docs/car-drawer.jpg)
![Options menu](docs/car-menu.jpg)

- **Home**: the time (and M&D logo, Gregorian and Hijri dates, Friday / white days reminders), an **azkar widget** (morning, general or evening azkar by the time of day; tap for the next one) and **prayer times for where the car is** (from its GPS, with the official method of that country), next prayer highlighted.
- **Silent prayer banner**: 10 minutes before each prayer a soft glass banner ("Asr in 10 minutes"), then "It's time for Asr" in gold, in Arabic and English. No sound, no vibration. When another app is in front (navigation, music), the same words come as a silent notification banner that goes away by itself.
- **Day / Eye comfort / Night** buttons (top of the time card). **Night mode comes on by itself at Maghrib** and day mode at sunrise; tap ☀ to go back to day whenever you like (your choice holds until the next sunrise or Maghrib). The modes lower the screen brightness while the home screen is shown and lay a warm tint over it; other apps keep the system brightness.
- **Split screen**: the **Split** button in the sidebar opens two apps side by side (for example Google Maps + YouTube). Tap **New Pair**, pick the two apps (1 on the left, 2 on the right), then **Open Side by Side**; the pair is saved in the Split menu for next time (up to 6 pairs; **Remove a Pair** deletes one). Android doesn't let apps start split screen on their own, so switch on the helper once: Split → **Turn On Split Helper** → *MK Split Screen* → On (Settings → Accessibility). It only presses the system's split-screen action and reads nothing on the screen. Without it, the launcher still tries a direct split, which works on many Android 9 head units.
- **Favorite places** (under the azkar), opened in **Google Maps** only: **Home** and **Work** go to the places saved as Home and Work in your Google Maps (sign in to Google Maps on the head unit with your account; hold either to use another place instead), **Mosque** and **Petrol** (the nearest ones around the car).
- **Qibla** button: a compass with the Kaaba marked that turns with the car (from the head unit's compass, or the GPS direction once the car is moving), e.g. "Qibla 40° to your right", plus the distance to Makkah. Standing still without a compass it shows the direction from north.
- **Travel dua** (دعاء السفر): when a trip starts — a navigation app opened from the home screen, sidebar, drawer or favorites — the azkar card shows the travel dua in Arabic for 15 minutes (tap it to go back to the azkar), and a silent banner shows it over the map. At most once an hour.
- **Arabic interface**: the ع / EN button on the time card switches everything (menus, dates, prayer times, banners) to Arabic, with the layout mirrored.
- **Sidebar**: time, **Wi-Fi**, up to 4 apps **you choose**, **Settings**, and the **App Drawer** button. Hold an app in the drawer → **Add to Sidebar** (or **Remove from Sidebar**); hold an app in the sidebar → **Move Up / Move Down / Remove from Sidebar**.
- **App Drawer**: every app in pages, **swipe** sideways. Like the TV home, **hold** an app for the glass menu: **Move**, **Add to Folder**, **Hide**, **Delete**; the app being moved jiggles: drag it (hold it at the screen edge to change page) or tap where it should go, then **Done**. Folders open as a glass platter; hold a folder to **Rename**, **Move** or **Remove Folder**.
- **No screensaver** in the car version.
- **Smooth on head units**: the Liquid Glass wallpaper is pre-blurred, so nothing is blurred while you swipe; only transform and opacity animate; the app list is re-read only when an app is installed or removed; the page ignores the system font size.
- Adapts to 1920×720, 1280×720, 1024×600 and portrait screens. Steering-wheel / rotary buttons that send arrow and OK keys work too (hold OK for the menu).
- On first start the app asks for **location** permission (allow it, for prayer times that follow the car). Without GPS, or until the first fix, it uses Sharjah (UAE Awqaf). To fix a place instead, set `latitude`, `longitude`, `city` (and `prayer`) in settings.

**Install**: copy `mk-car-launcher.apk` to a USB stick, open it with the head unit's file manager and allow installing from that source. If it says *"There was a problem parsing the package"*: check the file is complete (about 4.9 MB; a half-finished download won't open), copy it from the USB stick to the head unit's internal storage first and open it from there, or try another file manager (some head-unit file managers can't hand APKs to the installer). Then press **Home** and choose *MK TV & Car Launcher* → **Always** (or Settings → Apps → Default apps → Home app). If the head unit has adb over Wi-Fi, the `tv.sh` install and settings commands work with `CAR=1` in front, e.g. `CAR=1 ./tv.sh install`, `CAR=1 ./tv.sh settings settings.json`.

## What you need

- A Google TV or Android TV running Android 9 or newer.
- A Mac or Linux computer on the same network (for `adb`, used to install and to make it the Home screen).

## Install

1. **Get the tools** (adb, and JDK + Android SDK if you build yourself):
   ```bash
   tools/setup-sdk.sh
   ```
2. **Turn on debugging on the TV**: Settings → System → About → press OK on *Android TV OS build* 7 times. Then Settings → System → Developer options → **USB debugging** on. Note the TV's IP address (Settings → Network).
3. **Connect** and accept the prompt on the TV (tick *Always allow*):
   ```bash
   ./tv.sh connect 192.168.1.50
   ```
   If your TV shows *Wireless debugging* with a pairing code instead: `./tv.sh pair <tv-ip> <port> <code>`, then `./tv.sh connect <tv-ip> <port>`.
4. **Install** the APK from the Releases page (or build it, see below):
   ```bash
   ./tv.sh install mk-tv-launcher.apk
   ./tv.sh set-home
   ./tv.sh screensaver on
   ./tv.sh delay 2
   ```
5. **Optional, make it yours**: location and prayer method are detected automatically. To add a logo or world clocks, or to fix the place and method, copy `settings.example.json` to `settings.json`, edit it, then:
   ```bash
   ./tv.sh settings settings.json
   ```

## Your photos in the screensaver

In Google Photos, open an album → **Share** → **Create link**, then:

```bash
./tv.sh albums add https://photos.app.goo.gl/XXXXXXXX
```

The TV re-reads the albums every 6 hours. `./tv.sh albums list | remove <link> | clear` manage them. Set `"mixScenes": false` to show only your photos.

> Google stopped letting apps read albums through its API in March 2025, so this reads the album's public share page. It works today, but Google could change that page.

Prefer local files? `./tv.sh photos <folder>` pushes a folder of images instead.

## Settings

All keys are optional; anything left out uses the default in [`app/assets/config.js`](app/assets/config.js).

| Key | What it does |
|---|---|
| `latitude`, `longitude`, `city` | Fix the place instead of detecting it (detection is the default) |
| `timezone` | IANA zone; default `"auto"` uses the TV's own time-zone setting |
| `prayer` | Fix the method instead of the country's official one. A `prayer` block replaces the detected method entirely |
| `prayer.fajrAngle`, `prayer.ishaAngle` | Twilight angles (e.g. 18.2/18.2 UAE, 18/17 MWL, 19.5/17.5 Egypt) |
| `prayer.ishaMinutes` | Isha a fixed time after Maghrib (Umm al-Qura: 90) |
| `prayer.asrFactor` | 1 = Shafi'i/Maliki/Hanbali, 2 = Hanafi |
| `prayer.offsets` | Minutes added per prayer, to match your local authority |
| `logoText` | Text at the top of the screensaver and on the car home (default `"M&D"`); `&` is drawn in gold; `""` hides it |
| `worldClocks` | List of `{ "city", "zone" }` (IANA time zones) |
| `prayerAlert` | `enabled`, `minutesBefore`, `minutesAfter` (TV screensaver and car banner) |
| `nightAuto`, `nightLevel` | Car only: night mode from Maghrib to sunrise (default on), and how dark (1 eye comfort, 2 night) |
| `nightMode` | `enabled`, `dim` (0–1) |
| `reminders` | `kahf`, `whiteDays` |
| `azkar` | `morningFrom`, `generalFrom`, `eveningFrom` (hours) |
| `homeOrder`, `homeExclude` | Starting app order, and apps never shown |
| `useAlbums`, `mixScenes`, `photoSeconds`, `albumRefreshHours`, `weatherMinutes` | Screensaver photos and refresh |

## Remote

| Where | Button | Does |
|---|---|---|
| Home | OK / hold OK | Open app or folder / options menu |
| Home | Up from the top row | Wi-Fi and Settings |
| Options menu | Left / Right, OK, Back | Choose, pick, close |
| Move | Arrows, OK | Move the app, done |
| Folder | Back | Close the folder |

## Going back to the stock home screen

```bash
./tv.sh restore
```

Without a computer: Settings → Apps → See all apps → Show system apps → **Google TV Home** → Enable (and **Setup**), then press Home. Remove the app from Settings → Apps → **MK TV & Car Launcher** → Uninstall.

## Build from source

```bash
tools/setup-sdk.sh
./build.sh          # out/mk-tv-launcher.apk and out/mk-car-launcher.apk (or ./build.sh tv / ./build.sh car)
./tv.sh install
```

No Gradle: `build.sh` uses `aapt2`, `javac`, `d8` and `apksigner` directly. The UI is plain HTML/CSS/JS in [`app/assets/`](app/assets) shown in a WebView (`home.html` and `screensaver.html` on TV, `car.html` in the car); the two APKs differ only in their manifest ([`app/AndroidManifest.xml`](app/AndroidManifest.xml), [`car/AndroidManifest.xml`](car/AndroidManifest.xml)), whose `flavor` picks the home screen; [`Bridge.java`](app/src/com/mk/homedash/Bridge.java) is the small Android side (apps, launching, network, location, albums).

Releases are built by GitHub Actions: every push builds both APKs (download them from the run's *Artifacts*); pushing a tag like `v2.0.0`, or a new `versionName` in `app/AndroidManifest.xml` reaching `main`, builds them, signs it with the key kept in the repository's encrypted secrets, and publishes the release. Your own local builds use a key created in `keystore/`, so uninstall a release before installing your own build (or the other way round).

Tested on a Sony BRAVIA 4K VH2 (Google TV, Android 12).

## Credits

See [CREDITS.md](CREDITS.md). MIT licensed, see [LICENSE](LICENSE).
