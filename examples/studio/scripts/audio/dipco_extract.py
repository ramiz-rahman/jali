"""Stream DipCo.tgz from Zenodo (13.4 GB) and write ONLY the named members; stop as soon as all are found.
Nothing else touches the disk. usage: dipco_extract.py <outdir> <basename> [<basename> ...]"""
import sys, tarfile, urllib.request, os, shutil
URL = "https://zenodo.org/api/records/8122551/files/DipCo.tgz/content"
out, want = sys.argv[1], set(sys.argv[2:])
os.makedirs(out, exist_ok=True)
tf = tarfile.open(fileobj=urllib.request.urlopen(URL), mode="r|gz")
for m in tf:
    b = os.path.basename(m.name)
    if m.isfile() and b in want:
        with open(os.path.join(out, b), "wb") as f: shutil.copyfileobj(tf.extractfile(m), f)
        want.discard(b); print("got", m.name, m.size, flush=True)
        if not want: break
    elif m.isfile() and m.size > 1e6: print("skip", m.name, flush=True)
print("missing:", sorted(want))
