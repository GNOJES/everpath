# Device diagnostics implementation plan

User requests Android diagnostic FPS/frame-delay/touch display, exportable logs and rebuilt APK. Continue in existing project; no Git metadata/worktree. User delegates implementation defaults.

## Design decisions
- Opt-in diagnostics accessible in Settings and Pause, plus a compact live in-game HUD. Keep existing ?debug for prior tests.
- Measure raw requestAnimationFrame callback intervals independent of Phaser's smoothing and50ms simulation clamp. Live1-second FPS/p95/max; session all/running-only averages and slow-frame counts. Label as software cadence, not GPU presentation.
- Measure accepted input event timestamp → next running simulation update. Show active primary pointer/touch count/direction; log accepted/ignored/reset events. This is not physical glass-to-photon latency.
- Bounded1-second samples (1800) and input/lifecycle/error events (4000), coalesce moves to5Hz, report dropped counts. Exclude native/visibility/focus suspension gaps from frame stats.
- Native JSON export via official Capacitor Filesystem Cache + Share, no broad storage permission; retain last5 cache exports. Browser downloads JSON. No remote transmission until user chooses a share destination.
- Device/app/viewport/WebView metadata, run context and optional note; no persistent device ID, save blob, account data or arbitrary keyboard text.
- Increment Android versionCode2/versionName0.2.0; preserve appId and debug signing so -r updates keep saves.

## Tasks
- [x] Test-first pure bounded collector: correct percentiles/averages, input timing, retention, suspension, snapshot immutability.
- [x] Instrument input and native resume lifecycle; connect independent sampler, diagnostics screen/HUD, file export and error handling.
- [x] Test browser controls/download JSON/touch timing/background exclusions; run existing tests and build.
- [x] Rebuild and verify APK, test native share/file export in isolated emulator if practical, review code.
- [x] Document phone workflow/metrics/limits and deliver updated APK+SHA.
