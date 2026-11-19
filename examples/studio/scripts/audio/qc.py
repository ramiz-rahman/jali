"""Quality checks for every session in sessions/: decode each MP3 (ffmpeg), then check
 - every track decodes to the same number of samples (and the stated duration);
 - no clipping (decoded |sample| >= 0.999) and the peak level;
 - segments sorted; words monotonic, inside their segment, and inside the session;
 - word timing spot-check against the waveform: the energy inside each spoken word's span on its track, against
   that track's quiet floor. A word whose span is no louder than the floor is reported as suspect;
 - the transcript text equals the source text (sources re-read independently of the build scripts);
 - sizes.
usage: .venv/bin/python -I scripts/qc.py  > qc_report.txt
"""
import json, os, sys, glob, re, html
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import ROOT, decoded

from scipy.signal import butter, sosfiltfilt

def source_texts(sid):
    if sid == "apollo11-landing":
        import apollo_text as T
        return [t for _, _, t in T.TEC] + [t for _, _, t in T.PAO]
    if sid == "light-caught-by-the-stone":
        m = json.load(open(os.path.join(ROOT, "licenses", "meta-thelightmasters.json")))["metadata"]["description"]
        lines = [html.unescape(re.sub(r"<[^>]+>", "", x)).strip() for x in re.findall(r"<div>(.*?)</div>", m)]
        i = lines.index("as infering the light caught by the stone")
        j = lines.index("has access to all")
        return lines[i:j + 1]
    if sid == "dinner-party":
        U = json.load(open(os.path.join(ROOT, "dl", "dipco", "S02.json")))
        return [u["words"] for u in U]
    return []

report = {}
for sp in sorted(glob.glob(os.path.join(ROOT, "sessions", "*", "session.json"))):
    sdir = os.path.dirname(sp); s = json.load(open(sp)); sid = s["id"]
    r = {"tracks": {}, "problems": []}
    audio = {}
    for t in s["tracks"]:
        f = os.path.join(sdir, "audio", os.path.basename(t["file"]))
        x = decoded(f)
        audio[t["id"]] = x[:, 0] if x.shape[1] == 1 else x.mean(1)
        pk = float(np.abs(x).max())
        r["tracks"][t["id"]] = {"bytes": os.path.getsize(f), "samples": int(len(x)), "seconds": round(len(x) / t["sampleRate"], 4),
                                "peak_dbfs": round(20 * np.log10(pk + 1e-12), 2), "clipped_samples": int((np.abs(x) >= 0.999).sum())}
    lens = {v["samples"] for v in r["tracks"].values()}
    r["same_length"] = len(lens) == 1
    sr = s["tracks"][0]["sampleRate"]
    r["decoded_seconds"] = round(max(lens) / sr, 4)
    r["json_duration"] = s["duration"]
    r["bytes_total"] = sum(v["bytes"] for v in r["tracks"].values()) + os.path.getsize(sp)
    # transcript structure
    prev = -1
    nwords = 0
    for g in s["segments"]:
        if g["start"] < prev - 1e-9:
            r["problems"].append(f"{g['id']} starts before the previous segment (overlap ordering)")
        prev = g["start"]
        last = g["start"] - 1e-9
        for w in g["words"]:
            nwords += 1
            if not (w[1] <= w[2]):
                r["problems"].append(f"{g['id']} word {w} end before start")
            if w[1] < last - 1e-6:
                r["problems"].append(f"{g['id']} word {w} not monotonic")
            if w[1] < g["start"] - 1e-6 or w[2] > g["end"] + 1e-6:
                r["problems"].append(f"{g['id']} word {w} outside segment {g['start']}-{g['end']}")
            last = w[2]
        if g["end"] > s["duration"] + 1e-6:
            r["problems"].append(f"{g['id']} ends after the session")
        if " ".join(w[0] for w in g["words"]) != " ".join(g["text"].split()):
            r["problems"].append(f"{g['id']} words do not spell the text")
    r["segments"], r["words"] = len(s["segments"]), nwords
    # text equals source
    src = source_texts(sid)
    missing = [g["id"] for g in s["segments"] if g["text"] not in src]
    r["text_matches_source"] = not missing
    if missing:
        r["problems"].append(f"text not found verbatim in source: {missing}")
    # energy spot-check
    sos = butter(4, [250, 3500], btype="band", fs=sr, output="sos")
    sus, checked = [], 0
    for tid, x in audio.items():
        y = sosfiltfilt(sos, x)
        fr = int(0.02 * sr)
        e = np.sqrt(np.convolve(y ** 2, np.ones(fr) / fr, mode="same"))
        floor = np.percentile(e[::fr], 20) + 1e-9
        for g in s["segments"]:
            if g["track"] != tid:
                continue
            for w in g["words"]:
                if w[2] - w[1] < 0.03 or w[0].startswith("["):
                    continue
                a, b = int(w[1] * sr), int(w[2] * sr)
                lvl = 20 * np.log10(e[a:b].max() / floor)
                checked += 1
                if lvl < 6:
                    sus.append((g["id"], w[0], w[1], w[2], round(float(lvl), 1)))
    r["energy_checked_words"] = checked
    r["energy_suspect_words"] = sus
    report[sid] = r
print(json.dumps(report, indent=1))
