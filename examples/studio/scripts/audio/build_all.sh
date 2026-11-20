#!/bin/sh
# Rebuild everything from scratch. Run from studio-audio/. Needs ffmpeg, curl, python3 and uv. About 1.5 GB on disk
# while it runs (venv, models, sources); delete dl/ and work/ afterwards.
set -e
cd "$(dirname "$0")/.."
[ -d .venv ] || uv venv -q .venv
VIRTUAL_ENV=$PWD/.venv uv pip install -q -r scripts/requirements.txt
export TORCH_HOME=$PWD/.torch HF_HOME=$PWD/.hf
sh scripts/fetch_apollo.sh
sh scripts/fetch_song.sh
sh scripts/fetch_dipco.sh
.venv/bin/python -I scripts/build_apollo.py
.venv/bin/python -I scripts/build_song.py 7
.venv/bin/python -I scripts/build_dipco.py
.venv/bin/python -I scripts/qc.py > checks/qc.json
# decode test in Playwright's bundled Chromium (needs `playwright install chromium` or a cached build)
python3 -I -m http.server 8765 --bind 127.0.0.1 >/dev/null 2>&1 & S=$!
mkdir -p work/decode && cp scripts/decode_test.html work/decode/index.html
.venv/bin/python -I scripts/decode_test.py > checks/decode.txt || true
kill $S
