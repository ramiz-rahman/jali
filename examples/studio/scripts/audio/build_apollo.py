"""Build the Apollo 11 landing session.

Inputs (fetched by fetch_apollo.sh with HTTP range requests, lossless 48 kHz / 24-bit originals):
  work/ag_fd.wav  = Apollo11Audio/550-AAG.wav, 1680.000 s to 1970.000 s. Left = air-to-ground, right = Flight Director loop.
  work/pao.wav    = Apollo11Audio/173-AAA.wav, 1800.000 s to 2130.000 s. Mission commentary (PAO) as broadcast.
Output: sessions/apollo11-landing/{session.json,audio/*.mp3}

usage: .venv/bin/python -I scripts/build_apollo.py
"""
import json, os, sys
import numpy as np, soundfile as sf
from scipy.signal import resample_poly, fftconvolve, butter, sosfiltfilt
from scipy.interpolate import UnivariateSpline

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *  # noqa
import apollo_text as T

WORK = os.path.join(ROOT, "work")
OUT = os.path.join(ROOT, "sessions", "apollo11-landing")
os.makedirs(os.path.join(OUT, "audio"), exist_ok=True)

AG_FILE_START = 1680.0   # where work/ag_fd.wav starts in 550-AAG
PAO_FILE_START = 1800.0  # where work/pao.wav starts in 173-AAA
CUT = (46.0, 259.0)      # the excerpt, in work/ag_fd.wav seconds (= 550-AAG 1726.0 s to 1939.0 s)
SR_OUT, KBPS = 32000, 48
TARGET_DB, PEAK_MAX = -20.0, 10 ** (-1.0 / 20)

agfd, sr = sf.read(os.path.join(WORK, "ag_fd.wav"), dtype="float32")
pao, sr2 = sf.read(os.path.join(WORK, "pao.wav"), dtype="float32")
assert sr == sr2 == 48000
ag, fd = agfd[:, 0], agfd[:, 1]
pao_m = pao.mean(1)

# ---- 1. How the PAO tape lines up with the air-to-ground loop: windowed cross-correlation, then a smooth fit.
def band8k(x):
    y = resample_poly(x, 1, 6).astype(np.float32)
    return sosfiltfilt(butter(4, [300, 3000], btype="band", fs=8000, output="sos"), y)

a8, b8 = band8k(ag), band8k(pao_m)
pts = []
W = 4 * 8000
for t in np.arange(CUT[0] - 10, CUT[1] + 6, 1.0):
    seg = a8[int(t * 8000):int(t * 8000) + W]
    if np.std(seg) < 1e-4:
        continue
    lo, hi = int((t + 16.5) * 8000), int((t + 19.5) * 8000) + W  # lag is between 17 and 19 s (coarse scan, README)
    ref = b8[lo:hi]
    c = fftconvolve(ref, seg[::-1], mode="valid")
    e = np.sqrt(np.convolve(ref ** 2, np.ones(W), mode="valid")) * np.linalg.norm(seg) + 1e-9
    n = c / e; k = int(np.argmax(n))
    # sub-sample peak (parabolic)
    if 0 < k < len(n) - 1:
        d = 0.5 * (n[k - 1] - n[k + 1]) / (n[k - 1] - 2 * n[k] + n[k + 1])
    else:
        d = 0
    pts.append((t + 2.0, (lo + k + d) / 8000 - t, n[k]))
pts = np.array(pts)
good = pts[pts[:, 2] > 0.15]
# reject outliers against a running median
med = np.array([np.median(good[max(0, i - 7):i + 8, 1]) for i in range(len(good))])
good = good[np.abs(good[:, 1] - med) < 0.03]
spl = UnivariateSpline(good[:, 0], good[:, 1], w=good[:, 2], k=3, s=len(good) * 0.004 ** 2)
resid = good[:, 1] - spl(good[:, 0])
lag_report = {
    "points": int(len(good)), "lag_start_s": float(spl(CUT[0])), "lag_end_s": float(spl(CUT[1])),
    "fit_residual_ms_rms": float(np.sqrt(np.mean(resid ** 2)) * 1000),
    "fit_residual_ms_p95": float(np.percentile(np.abs(resid), 95) * 1000),
}

# ---- 2. Cut. The PAO is resampled onto the air-to-ground clock through the fitted lag (time warp).
i0, i1 = int(round(CUT[0] * sr)), int(round(CUT[1] * sr))
t = np.arange(i0, i1) / sr
ag_c, fd_c = ag[i0:i1].astype(np.float64), fd[i0:i1].astype(np.float64)
src_t = t + spl(t)
pao_c = np.interp(src_t * sr, np.arange(len(pao_m)), pao_m.astype(np.float64))

# verify the warp: residual lag after warping, 4 s windows
chk = []
aw, pw = band8k(ag_c.astype(np.float32)), band8k(pao_c.astype(np.float32))
for s in np.arange(0, (i1 - i0) / sr - 4, 2.0):
    seg = aw[int(s * 8000):int(s * 8000) + W]
    if np.std(seg) < 1e-4:
        continue
    lo = max(0, int((s - 0.1) * 8000)); ref = pw[lo:int((s + 0.1) * 8000) + W]
    c = fftconvolve(ref, seg[::-1], mode="valid")
    e = np.sqrt(np.convolve(ref ** 2, np.ones(W), mode="valid")) * np.linalg.norm(seg) + 1e-9
    n = c / e; k = int(np.argmax(n))
    if n[k] > 0.2:
        chk.append(((lo + k) / 8000 - s) * 1000)
chk = np.array(chk)
lag_report["after_warp_ms_median"] = float(np.median(chk))
lag_report["after_warp_ms_p95_abs"] = float(np.percentile(np.abs(chk), 95))
lag_report["after_warp_windows"] = int(len(chk))

# ---- 3. Level, fades, resample, encode.
def finish(x):
    x = resample_poly(x, SR_OUT // 16000 * 1, sr // 16000).astype(np.float32)  # 48k -> 32k
    g = 10 ** ((TARGET_DB - active_rms_db(x, SR_OUT)) / 20)
    g = min(g, PEAK_MAX / (np.abs(x).max() + 1e-9))
    return fade(x * g, SR_OUT, 30), 20 * np.log10(g)

tracks_audio = {}
for tid, x in (("air-ground", ag_c), ("flight-loop", fd_c), ("pao", pao_c)):
    tracks_audio[tid] = finish(x)
dur = len(tracks_audio["air-ground"][0]) / SR_OUT

# ---- 4. Alignment of the NASA text on the air-to-ground track; the PAO line on the PAO track.
ag16 = to16k(tracks_audio["air-ground"][0], SR_OUT)
tok, sp, owner = [], [], []
for li, (_, _, text) in enumerate(T.TEC):
    for w in text.split():
        tok.append(w); sp.append(T.spoken(w)); owner.append(li)
# a <star> token before every line (and at the end) soaks up speech NASA did not transcribe, and noise
line_starts = sorted({owner.index(li) for li in set(owner)} | {len(tok)})
if os.environ.get("STAR_EVERY"):
    line_starts = list(range(len(tok) + 1))
STAR_LOGP = float(os.environ.get("STAR_LOGP", "0"))
words, scores = display_word_times(tok, sp, ag16, 0.0, star_before_tokens=line_starts, star_logp=STAR_LOGP)
pao16 = to16k(tracks_audio["pao"][0], SR_OUT)
p_tok = T.PAO[0][2].split()
p_words, p_scores = display_word_times(p_tok, [T.spoken(w) for w in p_tok], pao16[: 20 * 16000], 0.0)

# Hand corrections after the waveform check (README, "Alignment"): the aligner put the first word of a line on an
# earlier burst of untranscribed speech. Times read off the band-passed energy of the air-to-ground track.
CORRECT = {("Watch your shadow out there.", 0): (84.56, 84.70), ("Watch your shadow out there.", 1): (84.70, 84.78)}
for (line, k), (a, b) in CORRECT.items():
    li = next(i for i, (_, _, t) in enumerate(T.TEC) if t == line)
    j = [n for n, o in enumerate(owner) if o == li][k]
    words[j][1], words[j][2] = a, b

spk = {s["code"]: s["id"] for s in T.SPEAKERS}
segs = []
for li, (get, code, text) in enumerate(T.TEC):
    ws = tidy_words([w for w, o in zip(words, owner) if o == li], [x for x, o in zip(sp, owner) if o == li])
    sc = [s for s, o in zip(scores, owner) if o == li and s is not None]
    segs.append({"get": get, "speaker": spk[code], "track": "air-ground", "text": text, "words": ws,
                 "score": float(np.mean(sc)) if sc else None})
segs.append({"get": T.PAO[0][0], "speaker": "pao", "track": "pao", "text": T.PAO[0][2],
             "words": tidy_words(p_words, [T.spoken(w) for w in p_tok]),
             "score": float(np.mean([s for s in p_scores if s is not None]))})
for s in segs:
    spoken_w = [w for w in s["words"] if w[2] > w[1]]
    s["start"], s["end"] = spoken_w[0][1], spoken_w[-1][2]
segs.sort(key=lambda s: s["start"])

# GET <-> session clock, from lines whose printed GET is fully legible
def get_s(g):
    d, h, m, s = (int(v) for v in g.split())
    return d * 86400 + h * 3600 + m * 60 + s
pairs = [(get_s(s["get"]), s["start"]) for s in segs if s["track"] == "air-ground" and "?" not in s["get"]]
off = np.median([g - st for g, st in pairs])
get_resid = [st - (g - off) for g, st in pairs]

# ---- 5. Envelopes and JSON.
peaks = {}
for tid, (x, _) in tracks_audio.items():
    peaks[tid] = envelope(x, SR_OUT)
scale = max(p.max() for p in peaks.values())
peaks99_ = {tid: peaks99(p, scale) for tid, p in peaks.items()}

def seg_json(i, s):
    a = int(round(s["start"] * PEAKS_PER_SECOND)); b = int(round(s["end"] * PEAKS_PER_SECOND))
    return {
        "id": f"s{i + 1:02d}", "speaker": s["speaker"], "track": s["track"], "start": r3(s["start"]), "end": r3(s["end"]),
        "voiced": [r3(s["start"]), r3(s["end"])], "text": s["text"],
        "words": [[w[0], r3(w[1]), r3(w[2])] for w in s["words"]],
        "peaks": peaks99_[s["track"]][a:b],
        "source": {"transcript": "AS11_TEC.pdf (GOSS NET 1)" if s["track"] == "air-ground" else "AS11_PAO.pdf (Mission Commentary 307/1)",
                   "get": s["get"]},
    }

segments = [seg_json(i, s) for i, s in enumerate(segs)]

def seg_at(text):
    return next(s for s in segments if s["text"].startswith(text))

LOW_LEVEL = 115.14  # on the Flight Director loop; measured with scripts/find_low_level.py (README)
markers = [
    {"id": "m1", "time": seg_at("Roger. 1202")["start"], "label": "1202 alarm"},
    {"id": "m2", "time": LOW_LEVEL, "label": "Low level"},
    {"id": "m3", "time": seg_at("60 seconds")["start"], "label": "60 seconds"},
    {"id": "m4", "time": seg_at("CONTACT LIGHT")["start"], "label": "Contact light"},
    {"id": "m5", "time": seg_at("THE EAGLE HAS LANDED")["start"], "label": "The Eagle has landed"},
]
markers.sort(key=lambda m: m["time"])

files = {}
for tid, (x, g) in tracks_audio.items():
    path = os.path.join(OUT, "audio", f"{tid}.mp3")
    encode_mp3(x, SR_OUT, path, KBPS, WORK)
    files[tid] = (f"audio/apollo11-landing/{tid}.mp3", g)

base_get = off  # GET of session time 0
def fmt_get(s):
    s = round(s); return f"{s // 3600}:{(s % 3600) // 60:02d}:{s % 60:02d}"

session = {
    "id": "apollo11-landing",
    "show": "Apollo 11",
    "episode": 1,
    "title": "The Eagle has landed",
    "recorded": "1969-07-20",
    "speakers": [{"id": s["id"], "name": s["name"], "role": s["role"], "code": s["code"]} for s in T.SPEAKERS],
    "intro": segments[0]["start"],
    "outro": r3(dur),
    "duration": r3(dur),
    "tracks": [
        {"id": "air-ground", "kind": "voice", "label": "Air-to-ground", "file": files["air-ground"][0], "channels": 1,
         "sampleRate": SR_OUT, "peaks": peaks99_["air-ground"],
         "source": "550-AAG left channel: air-to-ground (GOSS NET 1), crew and CAPCOM"},
        {"id": "flight-loop", "kind": "voice", "label": "Flight Director loop", "file": files["flight-loop"][0], "channels": 1,
         "sampleRate": SR_OUT, "peaks": peaks99_["flight-loop"],
         "source": "550-AAG right channel: the Flight Director's loop in Mission Control (not transcribed by NASA)"},
        {"id": "pao", "kind": "voice", "label": "Public affairs", "file": files["pao"][0], "channels": 1,
         "sampleRate": SR_OUT, "peaks": peaks99_["pao"],
         "source": "173-AAA: Mission Commentary as broadcast (air-to-ground plus the PAO's voice), time-warped onto the 550-AAG clock"},
    ],
    "segments": segments,
    "markers": markers,
    "credits": {
        "line": "Audio and transcript: NASA (Johnson Space Center Houston Audio Control Room), via the Internet Archive item Apollo11Audio. Public domain. Use does not imply NASA endorsement.",
        "sources": ["https://archive.org/details/Apollo11Audio"],
        "license": "Public Domain Mark 1.0 (archive.org licenseurl); NASA media usage guidelines",
    },
    "clock": {"get_at_zero": fmt_get(base_get), "note": "Session time 0 = GET %s (from the transcript's printed GET, median of %d lines)" % (fmt_get(base_get), len(pairs))},
}
with open(os.path.join(OUT, "session.json"), "w") as f:
    json.dump(session, f, ensure_ascii=False, separators=(",", ":"))

report = {"lag": lag_report, "get_offset_s": float(off), "get_resid_s": [round(float(v), 2) for v in get_resid],
          "gains_db": {k: round(float(v[1]), 2) for k, v in tracks_audio.items()},
          "segment_scores": [(s["id"], s["text"][:30], round(sg["score"], 3) if sg["score"] else None) for s, sg in zip(segments, segs)],
          "duration": dur}
with open(os.path.join(WORK, "apollo_report.json"), "w") as f:
    json.dump(report, f, indent=1)
print(json.dumps(report, indent=1)[:6000])
