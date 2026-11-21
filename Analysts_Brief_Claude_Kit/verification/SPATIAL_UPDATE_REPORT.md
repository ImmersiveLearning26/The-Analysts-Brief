# Spatial update verification — 20 November 2026

This report covers the modified `web/` app. Older reports/screenshots in this kit describe earlier versions.

## Passed here

| Check | Result |
| --- | --- |
| Production build | `npm --prefix web run build` passed with Node 24.22.3 / Vite 8.3.8 |
| Teaching model | All 128 factor combinations passed; outcome counts unchanged: 76 Coup, 32 Personalised rule, 20 Consolidation |
| Response model | All 729 checks across Calm, Strained and Hostile passed |
| Source handling | Existing source-example discrepancy handling passed |
| Inspector transforms | Lift before opening; one sheet moves right; Y/Z remain fixed; plane faces camera; no idle tease; return before replacement; prohibit reading rotation; close sequence; restore original parent and stack |
| Reduced motion | Inspector can enter and exit without a stuck state |
| Runtime cutaway helper | Hides representative ceiling and disables architecture shadow casting |
| Syntax | Updated main, world, agent and the supplied browser continuation test parse successfully |
| Original assets/content | See `handoff/CHANGED_FILES.json` for hashes and original-file comparison |

Detailed command output: `spatial/build.log`, `spatial/rules.log`, `spatial/transforms.log`.

## Not verified here

No updated browser screenshots, video or successful end-to-end UI run were produced. Local Chromium could not launch because the environment denied its socket operation. A remote preview attempt could not reach the local development server. This is a concrete testing limitation, not proof that the UI passes or fails.

The offline inspector test uses representative Three.js page geometry. It does not validate every transform/material/morph in the real exported case-file asset. Shader compilation, cutaway appearance, real paper texture readability, layout overlap and actual GPU performance require a browser.

Build warning: the main JavaScript chunk is about 1.21 MB before gzip (about 361 KB gzip). It exceeds the configured 900 KB advisory threshold. Build succeeds; code splitting/asset-loading performance remains production work. An npm proxy configuration warning belongs to the execution environment and is not an application failure.

## Claude acceptance checklist

- [ ] Run `web/` at 1366×768 and 390×844; verify no whole-page scrolling or clipped primary action.
- [ ] P00: model is visible, on a plain light background, with a readable title and Start.
- [ ] P01–P02: one compact composer; stable typed value; corner globe and menu remain accessible.
- [ ] P03: closed folder lifts; cover opens square to view; one sheet exits straight right. Check front/back texture orientation and cover clipping in the actual GLB.
- [ ] Tags remain readable and persist across next/previous, closing/reopening and a saved run.
- [ ] Next/Previous cannot leave duplicate floating pages or a half-closed folder, including rapid repeated input.
- [ ] Reading does not allow tilt. Zoom/pan remain useful. Read-text fallback exposes the whole source and both tags.
- [ ] Close reverses the sequence. Escape, F/S and page-navigation keys work without firing inside text fields.
- [ ] P04: all 18 sources remain accessible; source gate has not changed.
- [ ] P05–P08: Kalinda is isolated; no office surrounds it; user-controlled orbit works after hiding the conversation; model holds during reading/typing; outputs match the engine.
- [ ] P09–P11: hall cutaway reveals content without floating fittings, roof remnants or misleading baked shadows; response choices and rationale remain intact.
- [ ] P12–P14: Chair context loads; typed briefing, optional topic check and debrief work; restart and resume work.
- [ ] Optional feedback remains discoverable in the globe menu and does not automatically cover the next task.
- [ ] Globe/composer motion stays local and restrained; no screen-edge glow or camera bounce.
- [ ] Reduced motion works for world, inspector, assistant and dialogs; Pause does not strand navigation.
- [ ] Mobile keyboard does not cover the active input or submit action. UI surface reflow and internal scrolling work.
- [ ] Keyboard-only / screen-reader / focus restoration pass, including Escape and native-dialog close/reopen.
- [ ] Real microphone consent, recording, playback, download and deletion work; no external transmission implied.
- [ ] WebGL unavailable and model-load failure paths provide text interaction, not a dead end.
- [ ] Capture actual runtime screenshots and a short clip before declaring visual acceptance.

`spatial.browser.test.cjs` is a continuation script, not a passed test. It targets the production app and is separate from `browser.test.cjs`, which still targets the old `app/` reference.
