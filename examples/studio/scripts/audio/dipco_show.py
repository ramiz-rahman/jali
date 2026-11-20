import json, sys
def ts(s): h,m,x = s.split(":"); return int(h)*3600+int(m)*60+float(x)
U = json.load(open(sys.argv[1])); t0, t1 = float(sys.argv[2]), float(sys.argv[3])
for x in sorted(U, key=lambda x: ts(x["start_time"]["close-talk"])):
    a, b = ts(x["start_time"]["close-talk"]), ts(x["end_time"]["close-talk"])
    if a >= t0 and a < t1: print(f"{a:8.2f} {b:8.2f} {x['speaker_id']}: {x['words']}")
