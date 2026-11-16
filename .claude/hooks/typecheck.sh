#!/usr/bin/env bash
# Runs the type check after each edit. Does nothing until the project has a typecheck script.
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
[ -f package.json ] || exit 0
grep -q '"typecheck"' package.json || exit 0
out=$(npm run -s typecheck 2>&1)
if [ $? -ne 0 ]; then
  echo "$out" | tail -n 40 >&2
  exit 2
fi
exit 0
