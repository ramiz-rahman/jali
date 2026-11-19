#!/bin/sh
# Fetch only what the Apollo 11 session needs (about 180 MB, lossless), with HTTP range requests on archive.org's
# original 48 kHz / 24-bit WAVs, plus the NASA transcript PDF used for the text. Run from studio-audio/.
set -e
B=https://archive.org/download/Apollo11Audio
mkdir -p work dl/apollo
curl -sfL "https://archive.org/metadata/Apollo11Audio" -o dl/apollo/meta-Apollo11Audio.json
# 550-AAG: "Landing from AOS thru just after landing Flight Director and Air to Ground" (L = A/G, R = FD loop)
scripts/fetch_wav_range.sh "$B/550-AAG.wav" 1680 290 work/ag_fd.wav
# 173-AAA: "Mission Commentary 304-322", GET 102:12-106:17 (PAO broadcast)
scripts/fetch_wav_range.sh "$B/173-AAA.wav" 1800 330 work/pao.wav
# Transcripts (text is copied by hand from the scans into scripts/apollo_text.py; these are for checking)
curl -sfL "$B/AS11_TEC.pdf" -o dl/apollo/TEC.pdf
curl -sfL "$B/AS11_PAO_djvu.txt" -o dl/apollo/PAO.txt
