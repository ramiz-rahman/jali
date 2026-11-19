"""Per-stem activity map: dB RMS in 5 s blocks, to see where each part plays."""
import sys, glob, os, numpy as np, soundfile as sf
for p in sorted(glob.glob(sys.argv[1] + "/*.flac")):
    x, sr = sf.read(p, dtype='float32'); ch = 1 if x.ndim == 1 else x.shape[1]
    m = x if x.ndim == 1 else x.mean(1); B = sr*5
    db = [20*np.log10(np.sqrt(np.mean(m[i:i+B]**2))+1e-9) for i in range(0, len(m), B)]
    row = "".join(" " if d < -50 else "." if d < -35 else "o" if d < -25 else "O" for d in db)
    print(f"{os.path.basename(p)[:22]:22s} {sr} {ch}ch {len(m)/sr:6.2f}s pk{20*np.log10(np.abs(x).max()+1e-9):6.1f} |{row}|")
