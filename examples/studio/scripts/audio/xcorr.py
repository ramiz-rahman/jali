"""Cross-correlate two recordings window by window to find their offset and any speed drift.
usage: xcorr.py a.wav a_ch b.wav b_ch [win_s] [hop_s] [search_s]   (prints, per window of a, the lag of b in seconds)
Offsets are on each file's own clock (seconds from the start of the file)."""
import sys, numpy as np, soundfile as sf
from scipy.signal import resample_poly, fftconvolve, butter, sosfiltfilt
def load(p, ch):
    x, sr = sf.read(p, dtype='float32'); x = x[:, ch] if x.ndim > 1 else x
    x = resample_poly(x, 8000, sr).astype(np.float32)
    sos = butter(4, [300, 3000], btype='band', fs=8000, output='sos')
    return sosfiltfilt(sos, x)
a = load(sys.argv[1], int(sys.argv[2])); b = load(sys.argv[3], int(sys.argv[4]))
win = float(sys.argv[5]) if len(sys.argv) > 5 else 10; hop = float(sys.argv[6]) if len(sys.argv) > 6 else 10
search = float(sys.argv[7]) if len(sys.argv) > 7 else 400
sr = 8000; W = int(win*sr)
for t in np.arange(0, len(a)/sr - win, hop):
    seg = a[int(t*sr):int(t*sr)+W]
    if np.std(seg) < 1e-4: continue
    lo = max(0, int((t-search)*sr)); hi = min(len(b), int((t+search)*sr)+W)
    ref = b[lo:hi]
    c = fftconvolve(ref, seg[::-1], mode='valid')
    e = np.sqrt(np.convolve(ref**2, np.ones(W), mode='valid')) * np.linalg.norm(seg) + 1e-9
    n = c / e; k = int(np.argmax(n))
    print(f"a {t:7.2f}s -> b {(lo+k)/sr:9.4f}s  lag {(lo+k)/sr - t:+9.4f}s  ncc {n[k]:.3f}")
