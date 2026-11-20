# How the sessions were made

These scripts fetched, cut, aligned and checked Studio's three sessions. Their outputs are already in the example
(`src/sessions/data/*.json` and `public/audio/*/`), so nothing here needs to run for the app or its tests.
`PREPARATION.md` is the full account: every source, every decision, the alignment method and the checks.
`checks/` holds the checks' outputs.

To build them again:

1. Make an empty working folder outside the repository and copy this folder's files into `<work>/scripts/`.
2. From `<work>`, run `sh scripts/build_all.sh`. It makes a Python venv, installs `requirements.txt`, fetches the
   sources by HTTP range (about 300 MB), downloads the alignment models, builds each session into
   `<work>/sessions/<id>/`, runs `qc.py` and the browser decode test. It needs about 1.5 GB while it runs.
3. Copy `<work>/sessions/<id>/session.json` to `src/sessions/data/<id>.json` and `<work>/sessions/<id>/audio/*` to
   `public/audio/<id>/`. Run `pnpm test` from the repository root: `src/sessions/sessions.test.ts` checks the data.

To change an excerpt, edit `CUT` in `build_apollo.py` (a 3:00 cut is noted there) or `build_dipco.py` (an
alternative S02 window is noted there) and run that one script. Keep the credits in `../../CREDITS.md` and
`src/sessions/catalog.ts` in step with what changed.
