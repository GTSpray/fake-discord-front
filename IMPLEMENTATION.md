# Implementation checklist

Handoff for contributors implementing the renderer.

## Foundations

- [x] JSON Schema (`schema/scenario.schema.json`)
- [x] Example playback files (`examples/`)
- [x] `AGENTS.md`, `README.md`
- [x] Upload + AJV validation at import (`validateScenario.ts`)
- [x] sessionStorage persistence (`uploadScenario.ts`)

## Renderer

- [x] `DiscordShell.tsx` — sidebar + channel header
- [x] `ChannelView.tsx` — message list
- [x] `ModalOverlay.tsx` — type 9 + `values`
- [x] `SlashBar.tsx`
- [x] Component mapping per AGENTS.md constants table

## Studio UX

- [x] Upload-only entry (file picker + drag & drop)
- [x] `?capture=1` hides sidebar
- [x] Keyboard: S (hide), Space (play/pause)

## Playback engine

- [x] `ScenarioRunner` + `useScenarioPlayer` + `ScenarioCanvas`
- [x] Slash typing via `react-type-animation`
- [x] Bot pending reply delays

## Capture

- [x] `scripts/capture.mjs` — `--file <playback.json>`
- [x] Injects JSON via sessionStorage before navigation
- [x] Default viewport 1280×720

## Acceptance

```bash
npm install
npm run build
npm run validate -- examples/poll-moderator-flow.json
npm run dev        # upload examples/poll-moderator-flow.json
npm run capture -- --file examples/poll-moderator-flow.json
```
