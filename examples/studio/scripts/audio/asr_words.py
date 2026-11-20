"""ASR with word times, used only to LOCATE cut points and as a cross-check; never as transcript text."""
import sys, numpy as np, soundfile as sf
from scipy.signal import resample_poly
from faster_whisper import WhisperModel
path, ch, t0, t1 = sys.argv[1], int(sys.argv[2]), float(sys.argv[3]), float(sys.argv[4])
x, sr = sf.read(path, dtype='float32'); x = x[:, ch] if x.ndim > 1 else x
x = x[int(t0*sr):int(t1*sr)]
if sr != 16000: x = resample_poly(x, 16000, sr).astype(np.float32)
m = WhisperModel(sys.argv[5] if len(sys.argv) > 5 else "base.en", device="cpu", compute_type="int8", download_root=".models")
segs, _ = m.transcribe(x, language="en", word_timestamps=True, condition_on_previous_text=False)
for s in segs:
    print(" ".join(f"{w.word.strip()}@{t0+w.start:.2f}" for w in s.words))
