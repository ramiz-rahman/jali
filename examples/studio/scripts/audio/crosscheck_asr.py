"""Second opinion on word times: compare our forced-aligned word starts with faster-whisper (small.en) word
timestamps on the same track, for words whose text matches within +-1.5 s. ASR is not used for any text.
usage: crosscheck_asr.py <session_id> <track_id>"""
import json, os, re, sys, subprocess
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import ROOT, decoded, to16k
from faster_whisper import WhisperModel
sid, tid = sys.argv[1], sys.argv[2]
s = json.load(open(os.path.join(ROOT, "sessions", sid, "session.json")))
tr = next(t for t in s["tracks"] if t["id"] == tid)
x = to16k(decoded(os.path.join(ROOT, "sessions", sid, "audio", os.path.basename(tr["file"])))[:, 0], tr["sampleRate"])
m = WhisperModel("small.en", device="cpu", compute_type="int8", download_root=os.path.join(ROOT, ".models"))
segs, _ = m.transcribe(x, language="en", word_timestamps=True, condition_on_previous_text=False)
asr = [(re.sub(r"[^a-z]", "", w.word.lower()), w.start) for sg in segs for w in sg.words]
norm = lambda t: re.sub(r"[^a-z]", "", t.lower())
d = []
for g in s["segments"]:
    if g["track"] != tid: continue
    for w in g["words"]:
        n = norm(w[0])
        if len(n) < 3: continue
        c = [a[1] for a in asr if a[0] == n and abs(a[1] - w[1]) < 1.5]
        if c: d.append(min(c, key=lambda v: abs(v - w[1])) - w[1])
d = np.array(d)
print(json.dumps({"session": sid, "track": tid, "matched_words": int(len(d)), "median_abs_ms": round(float(np.median(np.abs(d))) * 1000),
                  "p90_abs_ms": round(float(np.percentile(np.abs(d), 90)) * 1000), "median_signed_ms": round(float(np.median(d)) * 1000)}))
