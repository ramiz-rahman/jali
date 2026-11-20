"""Rough ASR scan (only to LOCATE passages in long tapes; never used as transcript text)."""
import sys, numpy as np, soundfile as sf
from faster_whisper import WhisperModel
path, ch, t0, t1 = sys.argv[1], int(sys.argv[2]), float(sys.argv[3]), float(sys.argv[4])
x, sr = sf.read(path, start=int(t0*16000), stop=int(t1*16000), dtype='float32')
if x.ndim > 1: x = x[:, ch]
m = WhisperModel(sys.argv[5] if len(sys.argv) > 5 else "base.en", device="cpu", compute_type="int8", download_root=".models")
segs, _ = m.transcribe(x, language="en", vad_filter=False, condition_on_previous_text=False)
for s in segs: print(f"{t0+s.start:8.1f} {t0+s.end:8.1f} {s.text.strip()}")
