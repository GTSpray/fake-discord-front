# AGENTS.md

Instructions for AI coding agents working on **doc-studio**.

## What this project is

**doc-studio** is a standalone documentation tool. Users upload a JSON
playback file; the app renders an animated Discord-like UI (typing, modals,
buttons). Output is used for screenshots and short screen recordings in
technical documentation.

This project does **not** run the bot, connect to Discord, or simulate command
handlers.

## Audience

| Audience    | Goal                                                           |
| ----------- | -------------------------------------------------------------- |
| Doc authors | Author self-contained playback JSON when bot UX changes        |
| AI agents   | Implement renderer features without breaking the JSON contract |
| CI          | `npm run build` must pass; captures are manual                 |

## Contract-first rules

1. **JSON Schema is authoritative.** `schema/scenario.schema.json` defines the
   public contract. TypeScript types must match the schema, not the reverse.
2. **Validation happens at upload** in the browser (`src/lib/validateScenario.ts`
   via AJV). The CLI `npm run validate -- <file.json>` uses the same schema.
3. **Playback JSON is self-contained.** No references to bundled scene files.
   Inline `chrome`, `modal`, `ephemeral`, `layers`, etc.
4. **Copy uses resolved French strings** when scenarios target French UX. Do not
   add i18n runtime logic unless explicitly requested.
5. **`custom_id` and Discord snowflakes are ignored** by the renderer. Only
   labels, content, styles, and component types matter visually.
6. **Do not add bot business logic** (permissions, DB, vote counting, etc.).

## Repository layout

- `schema/scenario.schema.json` — playback JSON contract (stable API)
- `examples/` — sample playback files for dev and capture
- `src/render/` — Discord-like UI components (Skyra for messages, custom for CV2/chrome)
- `src/scenario/` — playback engine (`ScenarioRunner`, typing bridge)
- `src/lib/validateScenario.ts` — AJV validation (browser + shared logic)
- `src/lib/uploadScenario.ts` — sessionStorage persistence
- `scripts/validate-scenario.mjs` — CLI validation helper
- `scripts/capture.mjs` — Playwright screenshot/video from a JSON file

Optional top-level `emojis` resolves Discord custom mentions (`<:name:id>` /
`<a:name:id>`) to image URLs in message markdown.

## Playback model

A playback file describes an **animated sequence**:

- `chrome` — guild name, channel name, theme
- `actions` — ordered steps (`type`, `openModal`, `clickButton`, `applyState`, …)
- `defaults` — optional timing overrides (`botResponseMs`, `botPendingText`)
- `output` — optional capture hints (`directory`, `prefix`, `video`)

Bot messages use either plain `content` (user messages) or `interaction`
payloads (bot messages) using Discord interaction response shapes.

## Discord constants (renderer mapping)

| Name                                     | Value   |
| ---------------------------------------- | ------- |
| `InteractionResponseType.ChannelMessage` | `4`     |
| `InteractionResponseType.Modal`          | `9`     |
| `MessageFlags.Ephemeral`                 | `64`    |
| `MessageFlags.IsComponentsV2`            | `32768` |
| `ComponentType.ActionRow`                | `1`     |
| `ComponentType.Button`                   | `2`     |
| `ComponentType.StringSelect`             | `3`     |
| `ComponentType.TextInput`                | `4`     |
| `ComponentType.RoleSelect`               | `6`     |
| `ComponentType.Section`                  | `9`     |
| `ComponentType.TextDisplay`              | `10`    |
| `ComponentType.Thumbnail`                | `11`    |
| `ComponentType.MediaGallery`             | `12`    |
| `ComponentType.Separator`                | `14`    |
| `ComponentType.Label`                    | `18`    |
| `ButtonStyle.Primary`                    | `1`     |
| `ButtonStyle.Secondary`                  | `2`     |
| `TextInputStyle.Short`                   | `1`     |
| `TextInputStyle.Paragraph`               | `2`     |

## Typing timing defaults

Defined in `src/scenario/ScenarioRunner.ts`:

| Constant                              | Value   | Used when                                                                               |
| ------------------------------------- | ------- | --------------------------------------------------------------------------------------- |
| `DEFAULT_DELAY_BEFORE_TYPING_MS`      | 1250    | `type` action and slash input already has text                                          |
| `DEFAULT_DELAY_BEFORE_MODAL_FIELD_MS` | 900     | before each field in `fillModal`                                                        |
| `DEFAULT_BOT_RESPONSE_MS`             | 1200    | after `pressEnter`, `submitModal`, or `clickButton` when the next action is a bot reply |
| `DEFAULT_MS_PER_CHAR_MIN/MAX`         | 150–200 | `type` / `typeSlashParam` keystroke delay (random per typing action)                    |

Override per action with `delayBeforeMs` (`type`), `delayBeforeFieldMs`
(`fillModal`), or `responseDelayMs` on bot reply actions (`openModal`,
`showEphemeral`, `applyState`). Scenario-wide defaults: `defaults.botResponseMs`.

While waiting after `pressEnter`, a deferred bot message is shown (slash invocation +
animated dots + `Envoi de la commande...`). Override text via `defaults.botPendingText`.
After `clickButton`, the button shows loading dots during the response delay. After
`submitModal`, the modal Submit button shows loading dots, then the modal closes —
no deferred « thinking » message. During `fillModal`, the active text field gets a
Discord focus ring (and DOM focus) while it is being typed.

Slash input typing uses `react-type-animation` via `AnimatedSlashInput`.

`clickButton` moves an animated pointer (`ScenarioCursor`) to the matching
`discord-button` label before highlighting it. `submitModal` moves the same
pointer to the modal Submit button before showing loading dots / closing.
`selectModalOption` moves the pointer to the RoleSelect control to open the
options list, then to the chosen option.

## Authoring a playback file

1. Create a JSON file with `id`, `title`, `chrome`, and `actions`.
2. Inline all visual data (modals, ephemeral messages, final channel state).
3. Validate: `npm run validate -- my-flow.json`
4. Preview: `npm run dev` → upload the file in the browser.
5. Capture: `npm run capture -- --file my-flow.json`

Reference examples: `examples/poll-moderator-flow.json`, `examples/gimme-otter.json`.

## Renderer priorities

When implementing component support, prioritize common Discord bot patterns:

1. Buttons, ActionRow, ephemeral banner
2. Modals (Label + TextInput, RoleSelect)
3. Components V2: TextDisplay, Section, Separator, Thumbnail
4. MediaGallery (gimme emoji/otter)
5. StringSelect (vote modal)

Unsupported component types should render a visible fallback block in dev mode,
not fail silently.

## Visual guidelines

- Default theme: Discord dark.
- Default bot name: `Bot` (generated avatar when none is provided).
- Keep layouts readable at 1280×720 for doc embeds.
- Sidebar can be hidden during capture (`S` key or `?capture=1` query param).

## Commands

```bash
npm install
npm run dev
npm run validate -- examples/poll-moderator-flow.json
npm run build
npm run capture -- --file examples/poll-moderator-flow.json
```

## CI expectations

- `make ci` runs `lint-ci`, `test-ci`, and `snapshots-refresh` in Docker.
- GitHub Actions runs **three parallel jobs**: `lint`, `test`, `snapshots-refresh`.
- **Visual regression = MD5 of per-step PNG captures** stored in `tests/snapshots/snapshot.json`. Step PNGs are generated during capture only (not versioned).
- **Versioned artifacts**: `tests/snapshots/snapshot.json` (CI gate) + `tests/snapshots/*.gif` for human review (updated only when step hashes evolve).
- Capture uses `?capture=1&capture_steps=1` to pause after each action and hash a stable frame.
- Snapshot GIFs are recorded in a **second pass** without `capture_steps`, so typing animations remain visible for review.
- `make snapshots-refresh`: capture in a temp dir, update `snapshot.json`, copy only evolved GIFs. On hash mismatch, retry capture up to **2 times** to filter flakiness. **Exit 0** if nothing to refresh, **exit 1** if snapshots were refreshed (commit them). Existing videos are never deleted.

## What not to do

- Do not call the Discord API.
- Do not import code from external bot repositories.
- Do not store secrets or real guild/user IDs.
- Do not use Discord trademarks in a way that implies an official product.
- Do not break backward compatibility of schema fields without a documented
  migration note in README.

## Sync with documentation

When command UX changes in the product you document:

1. Update or create the matching playback JSON.
2. Regenerate captures with `npm run capture`.
3. Copy PNG/GIF assets into the target documentation repository.
4. Reference them from the usage markdown.
