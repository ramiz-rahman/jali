#!/usr/bin/env bash
# Jali supports React 18.2 and up as well as 19. This checks the oldest: it copies HEAD into a throwaway worktree, pins
# react, react-dom and their types to 18 there, and runs the typecheck and the unit tests. Run from the repo root:
#   pnpm test:react18
set -euo pipefail
# A directory of its own per run, so two checks (two sessions, or verify beside a manual run) never share one.
dir=.claude/worktrees/react18-check-$$
git worktree add -q --detach "$dir" HEAD
# git unregisters the worktree but can fail to delete it (a file written as it goes, a .DS_Store); finish the job, so
# the exit code is the tests' and nothing is left behind.
top=$(pwd)
cleanup() {
  cd "$top"
  git worktree remove --force "$dir" 2>/dev/null || true
  rm -rf "$dir"
}
trap cleanup EXIT
cd "$dir"
node -e '
  const fs = require("fs");
  const f = "pnpm-workspace.yaml";
  fs.writeFileSync(f, fs.readFileSync(f, "utf8").replace("overrides:\n",
    "overrides:\n  react: 18.3.1\n  react-dom: 18.3.1\n  \"@types/react\": 18.3.12\n  \"@types/react-dom\": 18.3.1\n"));
'
pnpm install --no-frozen-lockfile --silent
# The React @jali/react's tests run on (the root has none; above this checkout, Node would find another's).
(cd packages/react && node -e 'console.log("React", require("react/package.json").version)')
pnpm exec tsc -b --noEmit
pnpm exec vp test run
