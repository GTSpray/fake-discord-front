# Doc Studio

Standalone tool that renders uploaded JSON playback files resembling the Discord
client. Use it to produce screenshots and short screen recordings for
documentation.

This repository does **not** run the bot or connect to Discord.

## Quick start

```bash
npm install
npm run dev
```

Open the app, then **import a JSON file** (button or drag & drop). Playback starts
automatically. Add `?autoplay=0` to control playback manually, or `?capture=1` to
hide the sidebar for screenshots.

Example files live in [`examples/`](examples/).

## JSON contract

Playback files are validated at upload against
[`schema/scenario.schema.json`](schema/scenario.schema.json).

Each file is self-contained:

- `id`, `title` — metadata
- `chrome` — guild, channel, theme
- `actions` — animated sequence (typing, modals, buttons…)

Validate a file from the CLI:

```bash
npm run validate -- examples/poll-moderator-flow.json
```

## Playback timing defaults

| Context                                 | JSON field                                                        | Default                             |
| --------------------------------------- | ----------------------------------------------------------------- | ----------------------------------- |
| Slash — pause before continuing to type | `delayBeforeMs` on `type`                                         | **1250 ms** when input is not empty |
| Modal — pause before each field         | `delayBeforeFieldMs` on `fillModal`                               | **900 ms**                          |
| Bot response delay                      | `defaults.botResponseMs` or `responseDelayMs`                     | **1200 ms**                         |
| Typing speed (slash)                    | `msPerChar` on `type` / `typeSlashParam`, or `defaults.msPerChar` | **185 ms**                          |
| Typing speed (modal)                    | `msPerField` on `fillModal`                                       | 100 ms                              |

Constants are defined in `src/scenario/ScenarioRunner.ts`.

### Available actions

`wait`, `focusInput`, `type`, `pressEnter`, `openModal`, `fillModal`,
`submitModal`, `showEphemeral`, `clickButton`, `applyState`.

All payload data (`modal`, `ephemeral`, `layers`, `userMessage`, etc.) must be
**inline** in the JSON file.

## Snapshots (visual regression)

Only **WebM** files are versioned as visual artifacts. During capture, step-by-step **PNG** frames are generated on the fly, hashed (MD5), then stored in `tests/snapshots/snapshot.json` for CI verification.

```bash
make docker-build
make snapshots             # regenerate WebM + snapshot.json after UX changes
make snapshots-verify      # recapture and fail if snapshot.json is stale
make ci                    # lint + test + snapshots-verify
```

CI runs three parallel jobs (`lint`, `test`, `snapshots-verify`). Only `snapshots-verify` compares per-step PNG hashes from `snapshot.json`.

## Capture

Requires a built preview server:

```bash
npm run build && npm run preview
CAPTURE_BASE_URL=http://127.0.0.1:4173 npm run capture -- --file examples/poll-moderator-flow.json
```

Output directory and filename prefix come from the optional `output` block in the
JSON file (defaults: `output/` and the file `id`).

Use `--no-video` to skip WebM recording.

## Docker CLI

Headless capture CLI against the
[deployed studio](https://gtspray.github.io/fake-discord-front/). Mount a volume
with your playback JSON files — nothing is bundled except the capture scripts and
Playwright. JSON validation happens in the studio when each scenario is loaded.

### Build

```bash
docker build -f docker/Dockerfile.capture -t doc-studio-capture .
# or (same image):
docker build -t doc-studio-capture .
```

### Usage

Mount your working directory on `/work`. Scenario paths and output folders are
resolved from there (see the optional `output` block in each JSON file).

```bash
# One scenario
docker run --rm -v "$PWD:/work" doc-studio-capture \
  capture --file scenarios/poll-moderator-flow.json

# Every *.json in a folder
docker run --rm -v "$PWD:/work" doc-studio-capture \
  capture-dir scenarios/

# Skip WebM, only PNG
docker run --rm -v "$PWD:/work" doc-studio-capture \
  capture --file scenarios/gimme-otter.json --no-video
```

| Command       | Description                           |
| ------------- | ------------------------------------- |
| `capture`     | Capture one JSON file                 |
| `capture-dir` | Capture every `*.json` in a directory |

Default studio URL: `https://gtspray.github.io/fake-discord-front/`

Override with `CAPTURE_BASE_URL` (e.g. a local preview during development):

```bash
docker run --rm -v "$PWD:/work" \
  -e CAPTURE_BASE_URL=http://host.docker.internal:4173/ \
  doc-studio-capture capture --file scenarios/gimme-otter.json
```

## For contributors and AI agents

See [`AGENTS.md`](AGENTS.md) for architecture rules and renderer priorities.

## License

MIT
