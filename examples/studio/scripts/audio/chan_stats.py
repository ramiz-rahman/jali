import sys, numpy as np, soundfile as sf
x, sr = sf.read(sys.argv[1]); L, R = x[:,0], x[:,1]
w = sr*30
for i in range(0, len(L)-w, w):
    l, r = L[i:i+w], R[i:i+w]
    c = np.corrcoef(l, r)[0,1]
    print(f"{i/sr:7.0f}s  L {20*np.log10(np.std(l)+1e-9):6.1f}  R {20*np.log10(np.std(r)+1e-9):6.1f}  corr {c:5.2f}")
