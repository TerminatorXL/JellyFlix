#!/usr/bin/env bash
# Screenshot harness wrapper, e.g.: tools/shoot.sh --inject dist --profiles modern-desktop --pages home
exec "$(dirname "$0")/pw.sh" tools/shoot.mjs "$@"
