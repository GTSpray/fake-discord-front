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

Example files live in [`examples/`](examples/). Sample bot documentation pages with looping video previews:

- [Create a poll](examples/poll-moderator-flow.md)
- [Say hello](examples/say-hello-flow.md)
- [Show an otter](examples/gimme-otter.md)
- [Show channel emotes](examples/gimme-emoji.md)

## JSON contract

Playback files are validated at upload against
[`schema/scenario.schema.json`](schema/scenario.schema.json).

Each file is self-contained:

- `id`, `title` — metadata
- `chrome` — guild, channel, theme
- `emojis` — optional custom emoji resolution (`<:name:id>` / `<a:name:id>` → image URL)
- `actions` — animated sequence (typing, modals, buttons…)

Validate a file from the CLI:

```bash
npm run validate -- examples/poll-moderator-flow.json
```

## Playback timing defaults

| Context                                 | JSON field                                    | Default                             |
| --------------------------------------- | --------------------------------------------- | ----------------------------------- |
| Slash — pause before continuing to type | `delayBeforeMs` on `type`                     | **1250 ms** when input is not empty |
| Modal — pause before each field         | `delayBeforeFieldMs` on `fillModal`           | **900 ms**                          |
| Bot response delay                      | `defaults.botResponseMs` or `responseDelayMs` | **1200 ms**                         |
| Typing speed (slash)                    | — (fixed engine range)                        | **aléatoire 150–200 ms**            |
| Typing speed (modal)                    | `msPerField` on `fillModal`                   | 100 ms                              |

Constants are defined in `src/scenario/ScenarioRunner.ts`.

### Available actions

`wait`, `focusInput`, `type`, `pressEnter`, `openModal`, `fillModal`,
`submitModal`, `showEphemeral`, `clickButton`, `applyState`.

All payload data (`modal`, `ephemeral`, `layers`, `userMessage`, etc.) must be
**inline** in the JSON file.

## Snapshots (visual regression)

Only **evolved** GIF files are updated after a refresh. Capture runs in a temp directory;
step PNG frames are hashed (MD5) into `tests/snapshots/snapshot.json` (stable, no typing
animation). When hashes differ, matching GIFs are copied into `tests/snapshots/` — those
videos are recorded in a second full-playback pass (typing included). Existing videos are
never deleted.

```bash
make docker-build
make snapshots-refresh     # exit 0 if up to date, exit 1 if refreshed (then commit)
make ci                    # lint + test + snapshots-refresh
```

CI runs three parallel jobs (`lint`, `test`, `snapshots-refresh`). `snapshots-refresh`
compares per-step PNG hashes, updates `snapshot.json`, and copies only evolved GIFs.
Exit code 1 means the commit is stale and the refreshed files are in the CI artifact.

## Capture

Requires a built preview server:

```bash
npm run build && npm run preview
CAPTURE_BASE_URL=http://127.0.0.1:4173 npm run capture -- --file examples/poll-moderator-flow.json
```

Filename prefix comes from the optional `output` block in the JSON file
(default: the file `id`).

Use `--output-dir` / `-o` to choose where files are written (default: `output/`).
Priority: `--output-dir` → `output.directory` in JSON → `output/`.

Use `--no-video` to skip recording. Choose the animated output with `--format gif|mp4|webm`
(default: `gif`). Priority: `--format` → `output.format` in JSON → `CAPTURE_VIDEO_FORMAT` → `gif`.

```bash
npm run capture -- --file examples/poll-moderator-flow.json --output-dir docs/assets
```

## Docker CLI

Headless capture CLI against the
[deployed studio](https://gtspray.github.io/fake-discord-front/). Mount a volume
with your playback JSON files — nothing is bundled except the capture scripts,
Playwright, and ffmpeg for gif/mp4 conversion. JSON validation happens in the
studio when each scenario is loaded.

### Official image (GHCR)

Prefer the published image
[`ghcr.io/gtspray/fake-discord-front/doc-studio-capture`](https://github.com/GTSpray/fake-discord-front/pkgs/container/fake-discord-front%2Fdoc-studio-capture).
It is tagged `:latest` on every push to `main` (and via **Release capture**
workflow dispatch).

```bash
docker pull ghcr.io/gtspray/fake-discord-front/doc-studio-capture:latest
```

Mount your working directory on `/work`. Scenario paths and `--output-dir` are
resolved from there (JSON `output.directory` is the fallback when the flag is omitted).

```bash
IMAGE=ghcr.io/gtspray/fake-discord-front/doc-studio-capture:latest

# One scenario (GIF by default)
docker run --rm -v "$PWD:/work" "$IMAGE" \
  capture --file scenarios/poll-moderator-flow.json

# Custom output directory
docker run --rm -v "$PWD:/work" "$IMAGE" \
  capture --file scenarios/poll-moderator-flow.json --output-dir docs/assets

# MP4 output
docker run --rm -v "$PWD:/work" "$IMAGE" \
  capture --file scenarios/poll-moderator-flow.json --format mp4

# Keep raw WebM
docker run --rm -v "$PWD:/work" "$IMAGE" \
  capture --file scenarios/poll-moderator-flow.json --format webm

# Every *.json in a folder
docker run --rm -v "$PWD:/work" "$IMAGE" \
  capture-dir scenarios/ --format gif

# Skip video, only PNG
docker run --rm -v "$PWD:/work" "$IMAGE" \
  capture --file scenarios/gimme-otter.json --no-video
```

| Command       | Description                           |
| ------------- | ------------------------------------- |
| `capture`     | Capture one JSON file                 |
| `capture-dir` | Capture every `*.json` in a directory |

Default studio URL: `https://gtspray.github.io/fake-discord-front/`  
Default video format: `gif`

Override with env vars:

```bash
IMAGE=ghcr.io/gtspray/fake-discord-front/doc-studio-capture:latest

docker run --rm -v "$PWD:/work" \
  -e CAPTURE_BASE_URL=http://host.docker.internal:4173/ \
  -e CAPTURE_VIDEO_FORMAT=mp4 \
  "$IMAGE" capture --file scenarios/gimme-otter.json
```

### Build locally (optional)

From this repo:

```bash
make pack-capture-bundle          # → dist-capture/doc-studio-capture/
make docker-build-capture         # builds image from that bundle
# or from the repo root:
docker build -t doc-studio-capture .
```

Or from the floating GitHub Release `capture-latest` zip
(`doc-studio-capture-latest.zip` — Dockerfile + scripts):

```bash
unzip doc-studio-capture-latest.zip
cd doc-studio-capture
docker build -t doc-studio-capture .
```

Then replace `"$IMAGE"` with `doc-studio-capture` in the commands above.

## For contributors and AI agents

See [`AGENTS.md`](AGENTS.md) for architecture rules and renderer priorities.

## License

MIT
