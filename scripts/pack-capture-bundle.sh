#!/usr/bin/env bash
# Pack a self-contained capture CLI build context (Dockerfile + scripts + entrypoint).
# Usage:
#   ./scripts/pack-capture-bundle.sh [output-dir]
# Default output: dist-capture/doc-studio-capture/
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${1:-"$ROOT/dist-capture/doc-studio-capture"}"

rm -rf "$OUT"
mkdir -p "$OUT/scripts" "$OUT/docker"

cp "$ROOT/Dockerfile" "$OUT/Dockerfile"
cp "$ROOT/docker/entrypoint.sh" "$OUT/docker/entrypoint.sh"
cp "$ROOT/scripts/capture.mjs" "$OUT/scripts/capture.mjs"
cp "$ROOT/scripts/capture-dir.mjs" "$OUT/scripts/capture-dir.mjs"
cp "$ROOT/scripts/capture-lib.mjs" "$OUT/scripts/capture-lib.mjs"

cat >"$OUT/README.md" <<'EOF'
# Doc Studio capture CLI

Self-contained Docker build context for the headless capture tool.

## Build

```bash
docker build -t doc-studio-capture .
```

## Run

```bash
docker run --rm -v "$PWD:/work" doc-studio-capture \
  capture --file scenarios/my-flow.json --format gif
```

See the main repository README for formats (`gif` | `mp4` | `webm`) and options.
EOF

echo "Packed capture bundle → $OUT"
find "$OUT" -type f | sort
