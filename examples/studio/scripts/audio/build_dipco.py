"""Build the dinner-party session from DiPCo session S02 (dev set): the four close-talk microphones P05 to P08.

Inputs: dl/dipco/hf/S02_P0{5,6,7,8}.wav (16 kHz mono close-talk, fetched per file by fetch_dipco.sh) and
dl/dipco/S02.json (the corpus's own transcript). Output: sessions/dinner-party/{session.json,audio/*.mp3}

Processing, per microphone: the excerpt is cut at identical sample positions; a gentle gate, driven by the corpus's
own utterance times for that microphone's wearer, lowers the microphone by GATE_DB outside that person's utterances
(with padding and smooth ramps), which tames the other speakers' bleed without cutting any transcribed speech.
A 70 Hz high-pass removes rumble. Each track is levelled to the same speech loudness.

usage: .venv/bin/python -I scripts/build_dipco.py
"""
import json, os, sys
import numpy as np, soundfile as sf
from scipy.signal import butter, sosfiltfilt, resample_poly

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *  # noqa

WORK = os.path.join(ROOT, "work")
OUT = os.path.join(ROOT, "sessions", "dinner-party")
os.makedirs(os.path.join(OUT, "audio"), exist_ok=True)
SPK = ["P05", "P06", "P07", "P08"]
CUT = (18.50, 146.00)  # seconds in S02: lasagna, oranges, the office fruit, and the food tonight
GATE_DB, PAD, RAMP = -14.0, 0.25, 0.08
SR, SR_OUT, KBPS = 16000, 32000, 40
TARGET_DB, PEAK_MAX = -20.0, 10 ** (-1.0 / 20)

def ts(s):
    h, m, x = s.split(":"); return int(h) * 3600 + int(m) * 60 + float(x)

U = json.load(open(os.path.join(ROOT, "dl", "dipco", "S02.json")))
utts = sorted([(ts(u["start_time"]["close-talk"]), ts(u["end_time"]["close-talk"]), u["speaker_id"], u["words"]) for u in U])
inside = [u for u in utts if u[0] >= CUT[0] and u[1] <= CUT[1]]
straddle = [u for u in utts if (u[0] < CUT[0] < u[1]) or (u[0] < CUT[1] < u[1])]
assert not straddle, straddle

i0, i1 = int(round(CUT[0] * SR)), int(round(CUT[1] * SR))
hp = butter(2, 70, btype="high", fs=SR, output="sos")
tracks_audio, gate_info = {}, {}
for p in SPK:
    x, sr = sf.read(os.path.join(ROOT, "dl", "dipco", "hf", f"S02_{p}.wav"), dtype="float64")
    assert sr == SR
    x = sosfiltfilt(hp, x)[i0:i1]
    t = np.arange(len(x)) / SR + CUT[0]
    # gate envelope: 1 inside own utterances (+PAD), GATE_DB elsewhere, with linear ramps of RAMP seconds
    g = np.full(len(x), 10 ** (GATE_DB / 20))
    for a, b, s, _ in utts:
        if s != p:
            continue
        a, b = a - PAD, b + PAD
        m = (t >= a - RAMP) & (t <= b + RAMP)
        if not m.any():
            continue
        up = np.clip((t[m] - (a - RAMP)) / RAMP, 0, 1)
        dn = np.clip(((b + RAMP) - t[m]) / RAMP, 0, 1)
        g[m] = np.maximum(g[m], np.minimum(up, dn) * (1 - 10 ** (GATE_DB / 20)) + 10 ** (GATE_DB / 20))
    own = np.mean(g > 0.99)
    bleed_before = None
    y = x * g
    y = resample_poly(y, 2, 1)  # 16k -> 32k so every session's MP3 is MPEG-1 Layer III
    gain = 10 ** ((TARGET_DB - active_rms_db(y, SR_OUT, frac=0.25)) / 20)
    gain = min(gain, PEAK_MAX / (np.abs(y).max() + 1e-9))
    tracks_audio[p] = fade((y * gain).astype(np.float32), SR_OUT, 30)
    gate_info[p] = {"open_fraction": round(float(own), 3), "gain_db": round(float(20 * np.log10(gain)), 2)}
dur = len(tracks_audio[SPK[0]]) / SR_OUT

for p in SPK:
    encode_mp3(tracks_audio[p], SR_OUT, os.path.join(OUT, "audio", f"{p.lower()}.mp3"), KBPS, WORK)

# word times: forced alignment of the corpus's words within each utterance, on the speaker's own microphone
TAG = re.compile(r"^\[.*\]$")
peaks = {p: envelope(tracks_audio[p], SR_OUT) for p in SPK}
scale = max(v.max() for v in peaks.values())
p99 = {p: peaks99(v, scale) for p, v in peaks.items()}
segments, low = [], []
for k, (a, b, s, text) in enumerate(inside):
    a0, b0 = a - CUT[0], b - CUT[0]
    x16 = to16k(tracks_audio[s][int(max(0, a0 - 0.15) * SR_OUT):int(min(dur, b0 + 0.15) * SR_OUT)], SR_OUT)
    toks = text.split()
    sp = ["" if TAG.match(w) else w for w in toks]
    if any(sp):
        ws, sc = display_word_times(toks, sp, x16, max(0, a0 - 0.15), start=a0)
        ws = tidy_words(ws, sp)
        scv = [v for v in sc if v is not None]
        if scv and np.mean(scv) < 0.3:
            low.append((k, text, round(float(np.mean(scv)), 2)))
    else:
        ws = [[w, a0, b0] for w in toks]
    # keep every word inside the corpus's utterance span
    for w in ws:
        w[1] = min(max(w[1], a0), b0); w[2] = min(max(w[2], w[1]), b0)
    segments.append({"id": f"s{k + 1:02d}", "speaker": s.lower(), "track": s.lower(), "start": r3(a0), "end": r3(b0),
                     "voiced": [r3(ws[0][1]) if any(sp) else r3(a0), r3(max(w[2] for w in ws)) if any(sp) else r3(b0)],
                     "text": text, "words": [[w[0], r3(w[1]), r3(w[2])] for w in ws],
                     "peaks": p99[s][int(round(a0 * 50)):int(round(b0 * 50))]})

def first(sub):
    return next(s["start"] for s in segments if sub in s["text"])
markers = [
    {"id": "m1", "time": 0.0, "label": "Lasagna"},
    {"id": "m2", "time": r3(first("never had an orange") - 0.2), "label": "Never had an orange"},
    {"id": "m3", "time": r3(first("oranges here on tuesdays") - 0.2), "label": "Fruit at the office"},
    {"id": "m4", "time": r3(first("how do you like the food") - 0.2), "label": "The food tonight"},
]

meta = {u["speaker_id"]: u for u in U}
session = {
    "id": "dinner-party",
    "show": "DiPCo dinner party",
    "episode": 2,
    "title": "Never had an orange",
    "recorded": "unknown (DiPCo, published 2019)",
    "speakers": [{"id": p.lower(), "name": f"Speaker {i + 1} ({p})", "role": "Dinner guest (DiPCo participant %s)" % p} for i, p in enumerate(SPK)],
    "intro": segments[0]["start"],
    "outro": r3(dur),
    "duration": r3(dur),
    "tracks": [{"id": p.lower(), "kind": "voice", "label": f"Close-talk {p}", "speaker": p.lower(),
                "file": f"audio/dinner-party/{p.lower()}.mp3", "channels": 1, "sampleRate": SR_OUT, "peaks": p99[p]} for p in SPK],
    "segments": segments,
    "markers": markers,
    "credits": {
        "line": "DiPCo - Dinner Party Corpus (Amazon), CDLA-Permissive-1.0. Excerpt of session S02, close-talk microphones; modified (cut, filtered, gated, levelled, MP3).",
        "sources": ["https://zenodo.org/record/8122551", "https://huggingface.co/datasets/huckiyang/DiPCo"],
        "license": "CDLA-Permissive-1.0 https://cdla.dev/permissive-1-0/",
        "modified": "These files are modified from the DiPCo data: excerpted, high-passed, gated outside each wearer's own utterances, levelled and encoded to MP3.",
    },
}
with open(os.path.join(OUT, "session.json"), "w") as f:
    json.dump(session, f, ensure_ascii=False, separators=(",", ":"))
rep = {"duration": dur, "utterances": len(inside), "gate": gate_info, "low_score_utts": low}
json.dump(rep, open(os.path.join(WORK, "dipco_report.json"), "w"), indent=1)
print(json.dumps(rep, indent=1))
