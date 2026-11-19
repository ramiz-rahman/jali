#!/bin/sh
# Fetch the 28 masters (archive.org's lossless FLAC derivatives, about 155 MB) and the 2024 mix (for comparison only).
set -e
mkdir -p dl/light
curl -sfL "https://archive.org/metadata/thelightmasters" -o dl/light/meta-thelightmasters.json
python3 -I -c "
import json
for f in json.load(open('dl/light/meta-thelightmasters.json'))['files']:
    n = f['name']
    if n.endswith('.flac') and not n.startswith('examples'): print(n)
" | while read -r n; do
  q=$(python3 -I -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1]))" "$n")
  [ -f "dl/light/$n" ] || curl -sfL -o "dl/light/$n" "https://archive.org/download/thelightmasters/$q"
done
