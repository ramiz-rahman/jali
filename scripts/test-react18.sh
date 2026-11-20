#!/usr/bin/env bash
# Jali supports React 18.2 and up as well as 19. This checks the oldest: it copies HEAD into a throwaway worktree, pins
# react, react-dom and their types to 18 there, and runs the typecheck and the unit tests. Run from the repo root:
#   pnpm test:react18
set -euo pipefail
# A directory of its own per run, so two checks (two sessions, or verify beside a manual run) never share one.
dir=.claude/worktrees/react18-check-$$
git worktree add -q --detach "$dir" HEAD
trap 'git worktree remove --force "$dir"' EXIT
cd "$dir"
node -e '
  const fs = require("fs");
  const f = "pnpm-workspace.yaml";
  fs.writeFileSync(f, fs.readFileSync(f, "utf8").replace("overrides:\n",
    "overrides:\n  react: 18.3.1\n  react-dom: 18.3.1\n  \"@types/react\": 18.3.12\n  \"@types/react-dom\": 18.3.1\n"));
'
pnpm install --no-frozen-lockfile --silent
node -e 'console.log("React", require("react/package.json").version)'
pnpm exec tsc -b --noEmit
pnpm exec vp test run
