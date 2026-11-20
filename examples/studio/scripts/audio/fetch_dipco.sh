#!/bin/sh
# Fetch DiPCo session S02: the four close-talk WAVs (4 x 58 MB) and the transcripts, per file, from the Hugging Face
# mirror huckiyang/DiPCo (the Zenodo record is a single 13.4 GB .tgz). The LICENSE and README were read from the
# Zenodo archive itself by streaming its first entries (scripts/dipco_peek.py), and S02.json was stream-extracted from
# Zenodo (scripts/dipco_extract.py) and is byte-identical to the mirror's copy (md5 a8af835f4aec89a02b3af0db1f73cc2a).
set -e
R=https://huggingface.co/datasets/huckiyang/DiPCo/resolve/main
mkdir -p dl/dipco/hf
curl -sfL "$R/transcriptions/dev/S02.json" -o dl/dipco/S02.json
for p in 05 06 07 08; do curl -sfL "$R/audio/dev/S02_P$p.wav" -o dl/dipco/hf/S02_P$p.wav; done
curl -sfL "$R/LICENSE.txt" -o dl/dipco/LICENSE-hf-mirror.txt
