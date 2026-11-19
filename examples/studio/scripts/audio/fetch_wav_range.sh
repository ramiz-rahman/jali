#!/bin/sh
# fetch_wav_range.sh <url> <start_s> <dur_s> <out.wav>
# Fetches only the needed bytes of a 48 kHz / 24-bit / stereo BWF from archive.org with an HTTP range request
# (data chunk at byte 1024, 6 bytes per frame: read from the file's own header, see README) and wraps them as a WAV.
set -e
URL="$1"; S="$2"; D="$3"; OUT="$4"
A=$(python3 -c "print(1024 + int(round($S*48000))*6)")
B=$(python3 -c "print(1024 + int(round(($S+$D)*48000))*6 - 1)")
curl -sfL -r "$A-$B" "$URL" -o "$OUT.raw"
ffmpeg -v error -y -f s24le -ar 48000 -ac 2 -i "$OUT.raw" -c:a pcm_s24le "$OUT"
rm -f "$OUT.raw"
