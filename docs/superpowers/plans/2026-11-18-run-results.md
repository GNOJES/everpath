# Forest run ending and combat records
User requests a finite ending at ten-minute boss victory, detailed playtime/kill/missed records, cleanup before considering future stages. Existing v0.4 already has victory/death terminals. Preserve balance/audio; no automatic next-stage behavior.
- [x] Add successful-spawn/out-of-bounds/administrative-removal counters. Result missed=spawned-kills, rates use all spawned including bosses, zero denominator=0. Live enemies on death/abandon count missed, not defeated. Track cap replacement and600s arena removal separately. Tests ensure conservation and frozen terminal state.
- [x] Expand result screen with exact metric labels, percentages and denominator explanation. Store latest20 validated run summaries with original settlement dedupe, expose history from settings/results. Legacy absent stats display unrecorded, not invented zeros. Keep progress/currency/settings.
- [x] Test-first pure stats/history/migration; short browser death/abandon/history/small-phone layouts and long normal-HP boss victory summary/idle after win. Final review, README, APK0.4.1/code5/signature/asset check. Existing difficulty/audio unchanged.

Evidence:91 unit tests,13 short browser tests,1 normal-HP long touch victory with frozen state+history assertions. APK0.4.1 signed and packaged assets match. Review: no Critical/Important findings.
