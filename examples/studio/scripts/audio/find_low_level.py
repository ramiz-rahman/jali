"""Locate the "Low level" call on the Flight Director loop track (ASR word times, used only to place a marker)."""
import subprocess, sys
subprocess.run([sys.executable, "-I", __file__.replace("find_low_level.py", "asr_words.py"),
                sys.argv[1] if len(sys.argv) > 1 else "work/flight-loop.wav", "0", "100", "135", "small.en"])
