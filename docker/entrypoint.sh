#!/usr/bin/env bash
set -euo pipefail

export CAPTURE_BASE_URL="${CAPTURE_BASE_URL:-https://gtspray.github.io/fake-discord-front/}"
export CAPTURE_VIDEO_FORMAT="${CAPTURE_VIDEO_FORMAT:-gif}"

usage() {
  cat <<EOF
Doc Studio capture CLI

Mount your scenarios and output directory on /work, then run:

  docker run --rm -v "\$PWD:/work" doc-studio-capture \\
    capture --file scenarios/my-flow.json

  docker run --rm -v "\$PWD:/work" doc-studio-capture \\
    capture --file scenarios/my-flow.json --format mp4

  docker run --rm -v "\$PWD:/work" doc-studio-capture \\
    capture-dir scenarios/ --format webm

Commands:
  capture      Capture one JSON file
  capture-dir  Capture every *.json in a directory
  help         Show this message

Options:
  --file <path>              Playback JSON (capture)
  --dir <path>               Directory of JSON files (capture-dir)
  --output-dir <dir>, -o     Output directory (default: output/ or JSON output.directory)
  --format gif|mp4|webm      Output video format (default: gif)
  --no-video                 Skip video/GIF, keep PNG only
  --base-url <url>           Studio URL override

Paths are relative to /work (mount your project there).
Output dir resolution: --output-dir > output.directory in JSON > output/.
Format resolution: --format > output.format in JSON > CAPTURE_VIDEO_FORMAT > gif.

Studio URL: \${CAPTURE_BASE_URL}
Video format: \${CAPTURE_VIDEO_FORMAT}
Override with -e CAPTURE_BASE_URL=… / -e CAPTURE_VIDEO_FORMAT=…
EOF
}

case "${1:-help}" in
  capture)
    shift
    exec node /app/scripts/capture.mjs "$@"
    ;;
  capture-dir)
    shift
    exec node /app/scripts/capture-dir.mjs "$@"
    ;;
  help | --help | -h)
    usage
    ;;
  *)
    echo "Unknown command: $1" >&2
    echo >&2
    usage
    exit 2
    ;;
esac
