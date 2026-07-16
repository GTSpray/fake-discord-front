#!/usr/bin/env bash
set -euo pipefail

export CAPTURE_BASE_URL="${CAPTURE_BASE_URL:-https://gtspray.github.io/fake-discord-front/}"

usage() {
  cat <<EOF
Doc Studio capture CLI

Mount your scenarios and output directory on /work, then run:

  docker run --rm -v "\$PWD:/work" doc-studio-capture \\
    capture --file scenarios/my-flow.json

  docker run --rm -v "\$PWD:/work" doc-studio-capture \\
    capture-dir scenarios/

Commands:
  capture      Capture one JSON file (--file <path> [--no-video])
  capture-dir  Capture every *.json in a directory
  help         Show this message

Paths are relative to /work (mount your project there).
Output directory comes from the JSON "output" block (default: output/).

Studio URL: \${CAPTURE_BASE_URL}
Override with -e CAPTURE_BASE_URL=…
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
