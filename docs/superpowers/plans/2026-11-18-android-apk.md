# Android APK Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans for continuous inline implementation.

**Goal:** Package the existing game in Capacitor and deliver an installable debug APK with repeatable build/install instructions.
**Architecture:** Bundle Vite dist locally in Capacitor Android. Add native app lifecycle/back handling at the shell boundary, preserving the simulation and browser flow. Use the existing SDK/JDK without changing global settings.
**Tech Stack:** Capacitor8 stable, Android SDK36, Java21, Gradle wrapper, existing Phaser/TypeScript/Vite.
**Spec:** User explicitly requests a phone-test APK and README build/install guide; existing detailed brief delegates unspecified implementation choices.

## Decisions
- App ID com.everpath.game, name EVERPATH, portrait phones, local assets, no development server URL or external backend.
- Signed debug APK for sideload testing, not store/release signing. Do not install to a physical phone on the user's behalf.
- Keep status/navigation insets outside the game using Capacitor8.6 SystemBars native inset handling and viewport-fit=contain.
- Native pause resets input, saves progression and suspends audio. Resume remains user-controlled. Android back navigates menus or pauses combat; root back minimizes.
- Reuse the supplied project; no Git metadata/worktree exists. No global SDK/JDK modifications.

## Review Focus
- APK really contains current assets and a valid debug signature.
- SDK/Java detection must be portable; machine paths and debug keystore remain untracked.
- Home/lock/back never continue moving or consume a level-up choice.
- Android insets and portrait layout must remain usable on small phones.
- Web builds/tests remain functional with native modules included.

## Tasks
- [x] Install matching Capacitor packages, generate checked-in Android native project and capacitor.config.ts.
- [x] Test and implement native shell lifecycle, back navigation and audio suspend; configure orientation, insets and original launcher artwork.
- [x] Add reproducible npm commands / toolchain detection and build the debug APK using existing SDK/JDK.
- [x] Verify assets, manifest, package, debug signature, web tests/build; use an isolated emulator if practical.
- [x] Document prerequisites, CLI/Android Studio build, USB/file install, updating, troubleshooting and verification limits. Deliver APK plus SHA-256.

Verification: npm56 unit tests, browser6 scenarios, web build, signed debug APK build, Android16 native smoke, package identity instrumentation1 passed. Physical phone performance remains user-side. See docs/android-apk-verification.md.
