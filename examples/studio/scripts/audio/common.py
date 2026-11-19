"""Shared helpers for the Studio audio sessions: forced alignment, envelopes, loudness, fades and MP3 encoding.

Forced alignment uses torchaudio's CTC aligner (`torchaudio.functional.forced_align`) with the
WAV2VEC2_ASR_BASE_960H English acoustic model. The transcript TEXT always comes from the source (NASA transcript,
published lyrics, corpus JSON); the model only places that given text in time. It never chooses words.
"""
import json, os, re, subprocess
import numpy as np
import soundfile as sf
from scipy.signal import resample_poly

PEAKS_PER_SECOND = 50  # same as the app: one value per 20 ms, 0..99
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
os.environ.setdefault("TORCH_HOME", os.path.join(ROOT, ".torch"))

_model = None


def _load_model():
    global _model
    if _model is None:
        import torch, torchaudio
        b = torchaudio.pipelines.WAV2VEC2_ASR_BASE_960H
        _model = (b.get_model().eval(), b.get_labels(), b.sample_rate, torch)
    return _model


def to16k(x, sr):
    x = np.asarray(x, dtype=np.float32)
    if x.ndim > 1:
        x = x.mean(1)
    if sr != 16000:
        from math import gcd
        g = gcd(16000, sr)
        x = resample_poly(x, 16000 // g, sr // g).astype(np.float32)
    return x


def emissions(x16):
    """Log-probabilities per 20 ms frame for 16 kHz mono audio, computed in 30 s chunks with overlap."""
    model, labels, sr, torch = _load_model()
    hop = 320  # model stride in samples (20 ms)
    chunk, pad = 30 * sr, 2 * sr
    out = []
    with torch.inference_mode():
        for s in range(0, len(x16), chunk):
            a, b = max(0, s - pad), min(len(x16), s + chunk + pad)
            seg = torch.from_numpy(x16[a:b]).unsqueeze(0)
            seg = (seg - seg.mean()) / (seg.std() + 1e-7)
            em, _ = model(seg)
            em = torch.log_softmax(em, dim=-1)[0]
            f0 = (s - a) // hop
            n = min(chunk, len(x16) - s) // hop
            out.append(em[f0:f0 + n])
    em = torch.cat(out)
    return em, labels


def spoken_chars(s):
    s = s.upper().replace("’", "'")
    s = re.sub(r"[^A-Z' ]", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def align(x16, words_spoken, t_offset=0.0, star_before=(), star_logp=0.0):
    """Force-align a list of spoken words (strings of letters) to 16 kHz audio.
    `star_before`: word indices before which a <star> token may absorb any audio (untranscribed speech, noise),
    as in torchaudio's forced-alignment tutorial; index len(words) puts one at the end, 0 at the start.
    Returns [(start, end, score)] per word, in seconds (+ t_offset). Empty spoken words get None."""
    model, labels, sr, torch = _load_model()
    import torchaudio.functional as F
    em, labels = emissions(x16)
    idx = {c: i for i, c in enumerate(labels)}
    STAR = len(labels)
    if star_before:
        em = torch.cat([em, torch.full((em.size(0), 1), float(star_logp))], 1)
    star_before = set(star_before)
    toks, owner = [], []
    for wi, w in enumerate(words_spoken):
        w = spoken_chars(w).replace(" ", "|")
        if wi in star_before:
            if toks: toks.append(idx["|"]); owner.append(-1)
            toks.append(STAR); owner.append(-1)
            if w: toks.append(idx["|"]); owner.append(-1)
        elif toks and w:
            toks.append(idx["|"]); owner.append(wi)
        for c in w:
            if c in idx:
                toks.append(idx[c]); owner.append(wi)
    if len(words_spoken) in star_before:
        toks.append(idx["|"]); owner.append(-1); toks.append(STAR); owner.append(-1)
    if not toks:
        return [None] * len(words_spoken)
    tgt = torch.tensor([toks], dtype=torch.int32)
    ali, scores = F.forced_align(em.unsqueeze(0), tgt, blank=0)
    spans = F.merge_tokens(ali[0], scores[0].exp())
    assert len(spans) == len(toks), (len(spans), len(toks))
    res = [None] * len(words_spoken)
    sep = idx.get("|")
    for sp, t, wi in zip(spans, toks, owner):
        if t == sep or wi < 0:
            continue
        r = res[wi]
        if r is None:
            res[wi] = [sp.start, sp.end, [sp.score]]
        else:
            r[1] = sp.end; r[2].append(sp.score)
    fr = 320 / 16000
    return [None if r is None else (t_offset + r[0] * fr, t_offset + r[1] * fr, float(np.mean(r[2]))) for r in res]


def display_word_times(display_tokens, spoken_per_token, x16, t_offset=0.0, start=None, end=None,
                       star_before_tokens=(), star_logp=0.0):
    """Align display tokens (as shown in the transcript) that each carry a spoken form ('' = not spoken, e.g. '-').
    Unspoken tokens get a zero-length time at the previous word's end. Returns [[text, start, end]] and scores."""
    flat, own, stars = [], [], set()
    for i, sp in enumerate(spoken_per_token):
        if i in star_before_tokens:
            stars.add(len(flat))
        for w in sp.split():
            flat.append(w); own.append(i)
    if len(display_tokens) in star_before_tokens:
        stars.add(len(flat))
    al = align(x16, flat, t_offset, star_before=sorted(stars), star_logp=star_logp)
    out, scores = [], []
    for i, tok in enumerate(display_tokens):
        ts = [al[j] for j in range(len(flat)) if own[j] == i and al[j] is not None]
        if ts:
            out.append([tok, ts[0][0], ts[-1][1]]); scores.append(np.mean([t[2] for t in ts]))
        else:
            out.append([tok, None, None]); scores.append(None)
    first = next((w[1] for w in out if w[1] is not None), None)
    last = first if first is not None else (start if start is not None else t_offset)
    for w in out:
        if w[1] is None:
            w[1] = w[2] = last
        last = w[2]
    return out, scores


def envelope(x, sr):
    """Peak of |x| per 20 ms window."""
    x = np.abs(x if x.ndim == 1 else x.max(1))
    win = sr // PEAKS_PER_SECOND
    n = int(np.ceil(len(x) / win))
    x = np.pad(x, (0, n * win - len(x)))
    return x.reshape(n, win).max(1)


def peaks99(env, scale=None):
    scale = scale or max(env.max(), 1e-9)
    return [int(min(99, round(v / scale * 99))) for v in env]


def active_rms_db(x, sr, frac=0.5):
    """RMS (dBFS) of the loudest `frac` of 400 ms frames: a speech/music level that ignores silence."""
    m = x if x.ndim == 1 else x.mean(1)
    w = int(0.4 * sr)
    fr = [np.sqrt(np.mean(m[i:i + w] ** 2)) for i in range(0, len(m) - w, w)]
    fr = np.sort(np.array(fr))[::-1]
    top = fr[:max(1, int(len(fr) * frac))]
    return 20 * np.log10(np.sqrt(np.mean(top ** 2)) + 1e-12)


def fade(x, sr, ms=40):
    n = int(sr * ms / 1000)
    r = np.linspace(0, 1, n, dtype=np.float32)
    x = x.copy()
    if x.ndim == 1:
        x[:n] *= r; x[-n:] *= r[::-1]
    else:
        x[:n] *= r[:, None]; x[-n:] *= r[::-1, None]
    return x


def encode_mp3(x, sr, out, kbps, tmpdir):
    """CBR MP3 via ffmpeg/libmp3lame. CBR keeps every track of a session at the same frame count."""
    tmp = os.path.join(tmpdir, os.path.basename(out) + ".wav")
    sf.write(tmp, x, sr, subtype="PCM_16")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", tmp, "-c:a", "libmp3lame", "-b:a", f"{kbps}k",
                    "-map_metadata", "-1", out], check=True)
    os.remove(tmp)


def decoded(path):
    """Decode an MP3 back (ffmpeg) to check length, peaks and clipping."""
    r = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-f", "f32le", "-acodec", "pcm_f32le", "-"],
                       check=True, capture_output=True)
    ch = int(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "stream=channels", "-of", "csv=p=0", path],
                            capture_output=True, text=True).stdout.strip())
    return np.frombuffer(r.stdout, dtype=np.float32).reshape(-1, ch)


def r3(t):
    return round(float(t), 3)


def word_cap(token, spoken_form=None):
    """The longest a word plausibly lasts: generous, so only a clear aligner failure (a word that has swallowed a
    pause, a cough or untranscribed speech) is trimmed."""
    n = len(re.sub(r"[^A-Za-z]", "", spoken_form if spoken_form is not None else token))
    return 0.35 + 0.11 * n


def tidy_words(words, spoken_forms=None):
    """Trim over-long words in one segment: the first word keeps its end (it most often grabs noise before the
    line), the others keep their start. Keeps times monotonic."""
    out = [list(w) for w in words]
    sp_ = [i for i, w in enumerate(out) if w[2] > w[1]]
    if sp_:  # leading unspoken tokens ("...", "-", tags) sit at the first spoken word's start
        for i in range(sp_[0]):
            out[i][1] = out[i][2] = out[sp_[0]][1]
    for i, w in enumerate(out):
        cap = word_cap(w[0], spoken_forms[i] if spoken_forms else None)
        if w[2] - w[1] > cap:
            if i == 0:
                w[1] = w[2] - cap
            else:
                w[2] = w[1] + cap
    for i in range(1, len(out)):
        if out[i][1] < out[i - 1][2] and out[i][2] > out[i][1]:
            out[i][1] = out[i - 1][2]
        if out[i][2] < out[i][1]:
            out[i][2] = out[i][1]
    # zero-length (unspoken) tokens sit at the previous word's end
    for i, w in enumerate(out):
        if w[2] == w[1] and i > 0:
            w[1] = w[2] = max(w[1], out[i - 1][2])
    return out
