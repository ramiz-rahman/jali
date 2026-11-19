"""Stream the DiPCo .tgz from Zenodo and save only small text files (LICENSE, README...), stopping early.
Nothing but those files is written to disk. usage: dipco_peek.py <outdir> [max_entries]"""
import sys, tarfile, urllib.request, os
URL = "https://zenodo.org/api/records/8122551/files/DipCo.tgz/content"
out = sys.argv[1]; maxn = int(sys.argv[2]) if len(sys.argv) > 2 else 60
r = urllib.request.urlopen(URL)
tf = tarfile.open(fileobj=r, mode="r|gz")
n = 0
for m in tf:
    print(m.name, m.size, flush=True); n += 1
    base = os.path.basename(m.name)
    if m.isfile() and m.size < 200000 and not base.endswith(('.wav', '.json')):
        data = tf.extractfile(m).read()
        with open(os.path.join(out, "DiPCo-zenodo-" + base), "wb") as f: f.write(data)
        print("  saved", base, flush=True)
    if n >= maxn: break
