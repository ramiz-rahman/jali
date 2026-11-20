"""Rank 120 s windows of each DiPCo session by liveliness: turns, speakers, words, few [unintelligible], before music."""
import json, sys, glob, os
MUSIC = {"S01":2332,"S02":1170,"S03":2025,"S04":1405,"S05":1875,"S06":377,"S07":605,"S08":62,"S09":738,"S10":430}
def ts(s): h,m,x = s.split(":"); return int(h)*3600+int(m)*60+float(x)
res = []
for p in sorted(glob.glob(sys.argv[1] + "/S*.json")):
    sid = os.path.basename(p)[:3]; U = json.load(open(p))
    u = sorted([(ts(x["start_time"]["close-talk"]), ts(x["end_time"]["close-talk"]), x["speaker_id"], x["words"]) for x in U])
    for t0 in range(0, int(u[-1][0]) - 120, 10):
        if t0 + 120 > MUSIC[sid]: break
        w = [x for x in u if x[0] >= t0 and x[1] <= t0 + 120]
        if not w: continue
        spk = len(set(x[2] for x in w)); turns = sum(1 for a, b in zip(w, w[1:]) if a[2] != b[2])
        words = sum(len(x[3].split()) for x in w); unint = sum(x[3].count("[unintelligible]") for x in w)
        res.append((turns + words/20 - 5*unint + (10 if spk >= 3 else -50), sid, t0, spk, turns, words, unint))
res.sort(reverse=True)
seen = []
for r in res:
    if any(r[1] == s and abs(r[2]-t) < 120 for s, t in seen): continue
    seen.append((r[1], r[2])); print(r)
    if len(seen) >= 20: break
