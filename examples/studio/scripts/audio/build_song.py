"""Build the song session from the 28 multitrack masters of "The Light caught by the Stone" (archive.org thelightmasters).

Inputs: dl/light/*.flac (fetched by fetch_song.sh; archive.org's lossless FLAC derivatives of the uploaded WAVs, all
44.1 kHz, 234.92 s, sample-aligned) and the published mix (used only to compare levels, not shipped).
Output: sessions/light-caught-by-the-stone/{session.json,audio/*.mp3}

usage: .venv/bin/python -I scripts/build_song.py [vbr_quality]
"""
import json, os, sys, subprocess
import numpy as np, soundfile as sf

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *  # noqa

SRC = os.path.join(ROOT, "dl", "light")
WORK = os.path.join(ROOT, "work")
OUT = os.path.join(ROOT, "sessions", "light-caught-by-the-stone")
os.makedirs(os.path.join(OUT, "audio"), exist_ok=True)
VBR = sys.argv[1] if len(sys.argv) > 1 else "7"

BPM = 59.0
BAR = 4 * 60 / BPM
START = 3.70                    # just before the first note (bass and trumpet enter at 3.81 s)
BARS = 36
END = START + BARS * BAR        # 150.14 s: after the last sung line (146.7 s), as the drums drop out
SR = 44100

# Stems grouped into 8 channels. Every master here is mono or dual-mono except KEY5fx (real stereo, folded to mono).
GROUPS = [
    ("drums", "Drums", ["01 BD", "02 SN", "03 HH", "04 TOM1ohL", "05 TOM2ohR", "06 TOM3", "07 PERC1pand", "08 PERC2binghi"]),
    ("bass", "Bass", ["11 BASS"]),
    ("guitars", "Guitars", ["12 GT1skank", "13 GT2solo"]),
    ("keys", "Keys and melodica", ["14 MELODICA", "15 KEY1piano", "16 KEY2wacu", "17 KEY3hmnd", "18 KEY4clav", "19 KEY5fx"]),
    ("horns", "Horns", ["20 TRP1", "21 TRP2", "22 TRP3", "23 SAX1", "24 SAX2", "25 SAX3", "26 TBN"]),
    ("vox1", "Vocal 1", ["40 ENG_VOX1"]),
    ("vox2", "Vocal 2", ["41 ENG_VOX2"]),
    ("chorus", "Chorus", ["42 ENG_CORO1", "43 ENG_CORO2"]),
]

i0, i1 = int(round(START * SR)), int(round(END * SR))

def mono(name):
    x, sr = sf.read(os.path.join(SRC, name + ".flac"), dtype="float64")
    assert sr == SR
    if x.ndim > 1:
        x = x.mean(1)  # dual-mono stems: L = R, so this is the same signal
    return x[i0:i1]

groups = {gid: sum(mono(n) for n in names) for gid, _, names in GROUPS}
total = sum(groups.values())
mix, msr = sf.read(os.path.join(SRC, "The Light - Awe Plant - Mixed by Kresimir K remastered2024.flac"), dtype="float64")
mix = mix.mean(1)

# One gain for every stem (keeps the masters' own balance): the sum of all stems peaks at -1 dBFS.
g = 10 ** (-1.0 / 20) / np.abs(total).max()
for gid in groups:
    g = min(g, 10 ** (-1.0 / 20) / np.abs(groups[gid]).max())
gain_db = 20 * np.log10(g)

# compare with the published mix (an independent mix by Kresimir K, 2024; level and spectrum only)
def bands(x, sr):
    from scipy.signal import welch
    f, p = welch(x, sr, nperseg=8192)
    edges = [20, 120, 500, 2000, 6000, 16000]
    return [10 * np.log10(p[(f >= a) & (f < b)].mean() + 1e-20) for a, b in zip(edges, edges[1:])]
# find the mix's offset against our stem sum (the remaster may be shifted): coarse cross-correlation of envelopes
from scipy.signal import fftconvolve
def env(x, sr):
    w = sr // 100
    return np.abs(x[: len(x) // w * w]).reshape(-1, w).mean(1)
es, em = env(total, SR), env(mix, msr)
c = fftconvolve(em - em.mean(), (es - es.mean())[::-1], mode="valid")
mix_off = int(np.argmax(c)) / 100.0
mseg = mix[int(mix_off * msr):int(mix_off * msr) + len(total)]
cmp = {
    "mix_offset_s": mix_off, "corr_envelope": float(np.corrcoef(env(mseg, msr)[:len(es)], es[:len(env(mseg, msr))])[0, 1]),
    "bands_db_sum_minus_mix": [round(a - b, 1) for a, b in zip(bands(total / np.std(total), SR), bands(mseg / np.std(mseg), msr))],
    "band_edges_hz": [20, 120, 500, 2000, 6000, 16000],
    "group_share_db": {gid: round(float(20 * np.log10(np.std(x) / np.std(total))), 1) for gid, x in groups.items()},
}

tracks_audio = {}
for gid, x in groups.items():
    y = (x * g).astype(np.float32)
    n_in, n_out = int(0.03 * SR), int(0.75 * SR)
    y[:n_in] *= np.linspace(0, 1, n_in, dtype=np.float32)
    y[-n_out:] *= np.linspace(1, 0, n_out, dtype=np.float32)
    tracks_audio[gid] = y
dur = (i1 - i0) / SR

def enc(x, path):
    tmp = os.path.join(WORK, os.path.basename(path) + ".wav")
    sf.write(tmp, x, SR, subtype="PCM_16")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", tmp, "-c:a", "libmp3lame", "-q:a", VBR, "-map_metadata", "-1", path], check=True)
    os.remove(tmp)

for gid, x in tracks_audio.items():
    enc(x, os.path.join(OUT, "audio", f"{gid}.mp3"))

# ---- Lyrics: the published text (item description), placed by forced alignment on Vocal 1.
LYRICS = [
    "as infering the light caught by the stone",
    "from the one that bounces, ancestral mathematics",
    "as natural as intelligence",
    "as artificial as an idea",
    "Your hate is love to me",
    "and your love is everything",
    "And each fragment",
    "is, from all others around, equidistant",
    "the interior of a knowledge plant",
    "and all quasars receding from us",
    "bent space, elastic time",
    "extreme vertigo you may experience now",
    "but it's always been the same foundation",
    "same reality",
    "and being realistic I overstand",
    "that reality is hidden from us",
    "but expanding the perception we may see beyond",
    "nature reveals all its secrets",
    "much is revealed with instinct and feeling",
    "some secrets are more encrypted",
    "ultimately all is there",
    "the magic of cosmos and your love",
    "And your point of view",
    "is equidistant from all,",
    "has access to all",
]
SPOKEN = {"infering": "inferring", "overstand": "over stand", "it's": "it's"}
voc = tracks_audio["vox1"] + tracks_audio["vox2"]
x16 = to16k(voc, SR)
tok, sp, owner = [], [], []
for li, line in enumerate(LYRICS):
    for w in line.split():
        tok.append(w); sp.append(SPOKEN.get(w.strip(",").lower(), w.strip(","))); owner.append(li)
words, scores = display_word_times(tok, sp, x16, 0.0)
segs = []
for li, line in enumerate(LYRICS):
    ws = tidy_words([w for w, o in zip(words, owner) if o == li], [s for s, o in zip(sp, owner) if o == li])
    sc = [s for s, o in zip(scores, owner) if o == li and s is not None]
    segs.append({"text": line, "words": ws, "score": float(np.mean(sc))})

peaks = {gid: envelope(x, SR) for gid, x in tracks_audio.items()}
scale = max(p.max() for p in peaks.values())
p99 = {gid: peaks99(p, scale) for gid, p in peaks.items()}

segments = []
for i, s in enumerate(segs):
    a, b = s["words"][0][1], s["words"][-1][2]
    segments.append({"id": f"s{i + 1:02d}", "speaker": "vocals", "track": "vox1", "start": r3(a), "end": r3(b),
                     "voiced": [r3(a), r3(b)], "text": s["text"], "words": [[w[0], r3(w[1]), r3(w[2])] for w in s["words"]],
                     "peaks": p99["vox1"][int(round(a * 50)):int(round(b * 50))]})

def bar(n):  # time of bar n (0-based) from the excerpt's start (bars counted from 3.70 s)
    return r3(n * BAR)
def at_line(i):
    return segments[i]["start"]
# Sections, from the stems themselves (times measured in the masters, minus START): the horn intro ends at 22.0 s,
# the horns come back with the vocal at 38.0 s, the kick drum drops out from 100.95 s to 108.81 s.
markers = [
    {"id": "m1", "time": 0.0, "label": "Intro: horns"},
    {"id": "m2", "time": r3(22.0 - START), "label": "Groove"},
    {"id": "m3", "time": r3(at_line(0) - 0.3), "label": "Vocals"},
    {"id": "m4", "time": r3(100.95 - START), "label": "Break: no kick"},
    {"id": "m5", "time": r3(108.81 - START), "label": "Full band"},
    {"id": "m6", "time": r3(at_line(24) - 0.3), "label": "Last line"},
]

names = {gid: (label, stems) for gid, label, stems in GROUPS}
session = {
    "id": "light-caught-by-the-stone",
    "show": "Awe Plant",
    "episode": 1,
    "title": "The Light caught by the Stone",
    "recorded": "2016",
    "speakers": [{"id": "vocals", "name": "Pablo C. Budassi and Tatiana Pino", "role": "Voices (which voice is on which stem is not stated)"}],
    "intro": segments[0]["start"],
    "outro": r3(dur),
    "duration": r3(dur),
    "tracks": [{"id": gid, "kind": "music" if not gid.startswith(("vox", "chorus")) else "voice", "label": names[gid][0],
                "file": f"audio/light-caught-by-the-stone/{gid}.mp3", "channels": 1, "sampleRate": SR,
                "stems": names[gid][1], "peaks": p99[gid]} for gid in groups],
    "segments": segments,
    "markers": markers,
    "lyricsSource": "Published lyrics in the archive.org item description (thelightmasters), verbatim; times by forced alignment",
    "credits": {
        "line": "\"The Light caught by the Stone\" by Pablo Carlos Budassi (Awe Plant), recorded by Nueve Millas, CC BY 4.0. Excerpt, stems summed into 8 groups and re-encoded.",
        "sources": ["https://archive.org/details/thelightmasters"],
        "license": "CC BY 4.0 https://creativecommons.org/licenses/by/4.0/",
    },
}
with open(os.path.join(OUT, "session.json"), "w") as f:
    json.dump(session, f, ensure_ascii=False, separators=(",", ":"))
rep = {"gain_db": round(float(gain_db), 2), "excerpt": [START, END], "duration": dur, "compare_mix": cmp,
       "line_scores": [(s["id"], s["start"], s["end"], s["text"][:30], round(sg["score"], 2)) for s, sg in zip(segments, segs)]}
json.dump(rep, open(os.path.join(WORK, "song_report.json"), "w"), indent=1)
print(json.dumps(rep, indent=1))
print({gid: os.path.getsize(os.path.join(OUT, "audio", f"{gid}.mp3")) for gid in groups})
