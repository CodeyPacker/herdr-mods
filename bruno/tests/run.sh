#!/bin/sh
# Runs the Bruno tests: sh bruno/tests/run.sh [file ...]
# machine.test.mjs runs the real `bru` against the fixture server when `bru` is on PATH, and skips
# those tests otherwise. BRUNO_SKIP_BRU=1 skips them too.
cd "$(dirname "$0")" || exit 1
[ $# -gt 0 ] || set -- ./*.test.mjs
exec node --import ./register.mjs --test --test-timeout=120000 "$@"
