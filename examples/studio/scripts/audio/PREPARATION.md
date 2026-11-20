# Studio audio: three real sessions

These three real multitrack sessions replace the placeholder voices and synthesised music in the Studio example. Each session has a `session.json` in the shape of the app's `SessionData`, extended with real tracks. It comes with one MP3 file per track, a time-aligned transcript and markers. Credits and licences are in `CREDITS.md`, and saved licence texts are in `licenses/`.

| id                          | What it is                                                                        | Length   | Tracks                                                  | Segments / words     | Size    |
| --------------------------- | --------------------------------------------------------------------------------- | -------- | ------------------------------------------------------- | -------------------- | ------- |
| `apollo11-landing`          | Apollo 11 final descent and landing, 20 July 1969                                 | 3:33.000 | 3 (air-to-ground, Flight Director loop, public affairs) | 48 / 270             | 3.94 MB |
| `light-caught-by-the-stone` | "The Light caught by the Stone", Pablo C. Budassi (Awe Plant), multitrack masters | 2:26.441 | 8 stem groups                                           | 25 lyric lines / 135 | 5.81 MB |
| `dinner-party`              | DiPCo session S02: four people chatting at dinner, one close-talk mic each        | 2:07.500 | 4 close-talk mics                                       | 37 utterances / 316  | 2.63 MB |

The total is 12.4 MB, against a budget of 18 MB. Sizes include `session.json`, which holds the waveform peaks.

## Layout

```
sessions/<id>/session.json      the session (shape below)
sessions/<id>/audio/<track>.mp3 one file per track, all the same length to the sample
scripts/                        fetch, build, check (see "Re-running")
checks/                         outputs of the checks: qc.json, decode.txt, asr_crosscheck.txt, build reports
licenses/                       saved licence texts and the source items' metadata
```

To drop a session into the app, copy `sessions/<id>/audio/*` to `public/audio/<id>/`. Each track's `file` field is already `audio/<id>/<track>.mp3`, relative to the page, the same convention as today's `clip` paths.

## The data shape, and what the app's loader must change

The app today has one clip per transcript segment. Each clip is a `.m4a` file that the engine places at `segment.start` on a track chosen by `trackOf(segment)`. There are four fixed `TRACKS` (`mic-a`, `mic-b`, `bed`, `sting`), and the music is synthesised. Real recordings are continuous: the loops and mics carry bleed, breaths and untranscribed speech between segments, and the song stems have no "segments" at all. Cutting them into one clip per segment would throw that audio away and make gaps. So every track is delivered as one continuous file that starts at session time 0. The transcript segments keep the existing fields and point at their track.

`session.json` follows `SessionData` (`src/sessions/types.ts`) with these differences:

- **New `tracks[]`:** `{id, kind: "voice"|"music", label, speaker?, file, channels, sampleRate, peaks, source|stems}`. `peaks` covers the whole track at 50 values a second (one per 20 ms), 0 to 99, which is the same rate and scale as today's `segment.peaks`. The scale is shared by all tracks of a session, so relative loudness shows.
- **Segments:** `{id, speaker, track, start, end, voiced, text, words, peaks}`. `track` is new. `clip` is gone. `peaks` is still present: it is the slice of the track's peaks from `start` to `end`, so `voicePeaks()` keeps working if `trackOf` returns `segment.track`. `words` are `[text, start, end]` on the session clock, and they spell the segment's `text` token for token (split on whitespace). Tokens that are not spoken, such as `-`, `...` and DiPCo's `[laugh]` and `[noise]`, have zero length.
- **Speakers:** `{id, name, role}` plus `code` (Apollo: CDR, LMP, CC, PAO). There is no `voice` field.
- **No `music`:** there is nothing to synthesise. `intro` is the first segment's start, and `outro` = `duration`.
- **Also new:** `credits` (`line`, `sources`, `license`), Apollo's `clock` (GET at session time 0), the song's `lyricsSource`, and DiPCo's `credits.modified`.

The loader must change in these places. I changed none of them:

1. **`types.ts`:** add `TrackData` and `SessionData.tracks`, and `SegmentData.track`. Make `clip`, `music` and `speaker.voice` optional. Add `credits`.
2. **`sessions.ts`:** `TRACKS` and `CHANNEL` become per session (`session.tracks`). The song has 8 tracks and the dinner party has 4, so `CHANNEL` needs more than four colours, or a palette by index. `trackOf(seg)` returns `seg.track`. `trackName` uses `track.label` or the speaker. Load the JSON files instead of `generated.ts`.
3. **`segmentIndexAt`** does a binary search that assumes segments do not overlap. In DiPCo, utterances overlap: backchannels like "yeah" and "hmmm" land inside another person's line. Segments are sorted by `start`. The function needs to return the latest-started segment that contains `t` (or all of them), and the transcript's "now" logic needs to allow two lit segments at once. Apollo and the song have no overlaps that matter.
4. **`engine.ts`:**
   - `graph()` builds strips for the fixed `TRACKS` once. It must build them for the loaded session's tracks, and rebuild them on `load()`.
   - `fetchSession()` must decode `s.tracks[].file`, not `s.segments[].clip`, and skip `renderBed` and `renderSting`.
   - `schedule()` must `place(buffer, 0, track.id)` for each track.
   - `musicPeaks` and `stingTrackPeaks` must give way to `track.peaks`.
5. **`ui/waveform.ts`:** `trackPeaks` and `voicePeaks` should read `track.peaks`. `overviewPeaks` hard-codes `mic-a` and `mic-b`; it should use the maximum over all tracks.
6. **`edits.ts`:** `DEFAULT_CHANNEL` is keyed by the old track ids. New ids fall back to `{gain: 0, pan: 0}`. You may want default pans, for example spreading the DiPCo mics and the song stems.
7. **Display text:**
   - The `StatusLine` says "Placeholder voices · synthesised music" and should show `credits.line`.
   - `show` and `episode` are filled with neutral placeholders (Apollo 11 / 1, Awe Plant / 1, DiPCo dinner party / 2) because the type requires them. The `${show} · Ep ${episode}` hint should probably go.
8. **`playwright.config.ts`:** `channel: "chrome"` is no longer needed for these files (see the decode test below).

## Audio format and decode test

- **Format:** MP3 (MPEG-1 Layer III, LAME through ffmpeg), mono for every track, with the Xing/LAME header so decoders trim the encoder delay.
  - Apollo and DiPCo: 32 kHz CBR at 48 and 40 kbit/s.
  - The song: 44.1 kHz VBR `-q:a 7`.
- **Why mono for the song:** every stereo master in the song except `19 KEY5fx` is dual-mono (L/R correlation 1.00), and even the published mix correlates at 0.99. So mono loses nothing, and panning is the mixer's job.
- **Why MP3:** the engine fetches each file and calls `AudioContext.decodeAudioData`. MP3 decodes in all the target browsers. AAC in `.m4a` depends on proprietary codecs.
- **Lengths:** all tracks of a session have the same sample count, so they decode to the same length: 6,816,000 / 6,458,034 / 4,080,000 samples. ffmpeg decodes to exactly 213.0000 s, 146.4407 s and 127.5000 s.
- **Decode test:** `scripts/decode_test.py` loads a page that calls `decodeAudioData` on every file in Playwright's own bundled Chromium builds on this Mac:
  - Chrome for Testing 148.0.7778.96 (`chromium-1223`) and chrome-headless-shell 156.0.8078.4 (`chromium_headless_shell-1248`).
  - All 15 MP3s decoded, at the right durations (213.0000 / 146.4407 / 127.5000 s). Output is in `checks/decode.txt`.
  - The same test also decoded the app's current `night-ferry/s01.m4a` in both builds. The failure noted in `playwright.config.ts` ("Playwright's own Chromium doesn't" decode AAC) **did not reproduce on this machine**. It may be specific to other platforms or builds, for example Linux CI Chromium without proprietary codecs. That is unconfirmed. MP3 removes the question either way.
  - **Safari and Firefox were not tested** (no WebKit or Firefox build was available). MP3 support in `decodeAudioData` is standard there, but that is unconfirmed here.
- **Clipping:** no decoded sample reaches ±0.999 in any track. Peaks range from −1.4 to −17 dBFS (`checks/qc.json`).

## Session 1: Apollo 11 landing (`apollo11-landing`)

### Sources (all in the Internet Archive item `Apollo11Audio`, NASA JSC)

- **`550-AAG`:** "Landing from AOS thru just after landing Flight Director and Air to Ground" (catalogue: NASA-Audio-Archive_Digital-Audio-File_Metadata).
  - It is a two-track tape. In the original WAV (48 kHz, 24-bit, stereo, Pro Tools BWF), the **left channel is the air-to-ground loop** (crew and CAPCOM) and the **right channel is the Flight Director's loop**. I identified the channels by listening logic plus ASR used only to locate passages.
  - The two channels are uncorrelated at zero lag (r ≈ 0.00 in every 30 s window). They are genuinely separate recordings, and because they are on one tape they share one timeline exactly.
- **`173-AAA`:** "Mission Commentary 304-322", MET 102:12 to 106:17. This is the public affairs broadcast: the air-to-ground loop with the PAO commentator mixed in. It is near dual-mono (L/R r ≈ 0.6 to 0.9), downmixed to mono.
- **Also checked and not used:**
  - `963-AAE` (FD loop cassette, AOS through landing): dual-mono, and no more separate than `550-AAG`.
  - `251-AAB` (Flight Director's loop, no times in the catalogue).
  - The onboard LM recording (`517-AAO`) is not in this item.
- **Fetching:** only the needed windows were fetched, by HTTP range on the original WAVs. For `550-AAG.wav`, the data chunk is at byte 1024 and a frame is 6 bytes (`scripts/fetch_wav_range.sh`).
  - `550-AAG.wav` 1680.000 to 1970.000 s (84 MB).
  - `173-AAA.wav` 1800.000 to 2130.000 s (95 MB).
- **The excerpt:**
  - From `550-AAG`: 1726.000 to 1939.000 s.
  - From `173-AAA`: 1863.65 to 2077.28 s of tape, warped onto those 213.000 s.
  - Session time 0 = GET 102:42:40. The excerpt runs from just before CAPCOM's "Eagle, looking great. You're GO." to just after "We're breathing again. Thanks a lot."

### Do the recordings share a timeline? Yes, after a time warp for the PAO tape

- The two loops on `550-AAG` share one tape, so no alignment is needed.
- The PAO broadcast carries the same air-to-ground audio. Windowed cross-correlation (300 to 3000 Hz, 4 s windows every 1 s, 169 good windows) gives its lag against the air-to-ground channel:
  - The lag drifts from +17.653 s to +18.279 s over the 213 s. That is a speed difference of about 0.29 %, and it is not quite linear: tape speed wanders.
  - I fitted a weighted smoothing spline (rms residual 12.8 ms) and resampled the PAO onto the `550-AAG` clock through it.
  - Checked after the warp in 60 windows: median offset 0.5 ms, 95th percentile 26 ms.
  - Caveat: soloing the air-to-ground and PAO tracks together gives a slight doubling or comb effect where they carry the same audio, because the residual is tens of ms and the two transfers differ.
- The air-to-ground clock matches NASA's GET. The aligned start of each transcribed line, against its printed GET (43 legible lines): median 0.0 s. Residuals are within ±1.5 s for 41 lines. Two lines are about 3 s off, both where untranscribed speech precedes the line. The transcript prints whole seconds.

### Transcript

- **Text:** NASA's **Technical Air-to-Ground Voice Transcription (GOSS NET 1)**, `AS11_TEC.pdf`, Tape 66/9 to 66/12, transcript pages 314 to 317 (PDF pages 316 to 319). I copied the text by hand from the page scans (the OCR is unreliable) into `scripts/apollo_text.py`.
  - Spelling, capitals and "..." are as printed.
  - One line printed only as "..." (04 06 44 51, LMP) is left out because it has no words.
  - Speaker codes are as printed. NASA's TEC and PAO transcripts both give "Roger. 1202. We copy it." to CC. I kept that, although some histories attribute it to Aldrin.
- **PAO line:** the commentator's own words ("Altitude 1600. 1400 feet. Still looking very good.") come from the Mission Commentary transcript `AS11_PAO.pdf` (7-20-69, GET 102:43:00, 307/1). They are on the PAO track.
- **Flight Director loop:** NASA did not transcribe it, so it has **no transcript segments**. I did not create any from speech recognition. Its "Low level" call (CONTROL) is a marker only. I located it with Whisper word times at 115.14 s (`scripts/find_low_level.py`), and the ASR heard "Low level? ... Low level."
- **Speakers:**

  | Code | Name                        |
  | ---- | --------------------------- |
  | CDR  | Neil A. Armstrong           |
  | LMP  | Edwin E. "Buzz" Aldrin Jr.  |
  | CC   | Charles M. Duke Jr., CAPCOM |
  | PAO  | Public Affairs Officer      |

  The transcript prints only the codes; the names are historical record. The PAO's name is not given in the transcript and I left it unnamed, so it is unconfirmed.

- **Segment times** are exact: the first spoken word's start to the last spoken word's end.
- **Word times** come from forced alignment. The method is in "Alignment" below. Then:
  - One hand correction: "Watch your" (line 04 06 44 04). The aligner put "Watch" on an earlier, untranscribed burst ("60", heard by ASR). The waveform shows silence from 81.6 to 84.5 s and speech from 84.6 s, so "Watch" was set to 84.56 to 84.70 s and "your" to 84.70 to 84.78 s.
  - I checked three other suspicious first words against the waveform's energy and kept them ("Okay.", "Houston,", "600").
  - Whisper's own timestamps put "Houston" about 2 s later, in silence, so I did not use them.
- **Markers:**

  | Time   | Marker               | Note                          |
  | ------ | -------------------- | ----------------------------- |
  | 18.06  | 1202 alarm           | CC "Roger. 1202. We copy it." |
  | 115.14 | Low level            | FD loop                       |
  | 141.52 | 60 seconds           |                               |
  | 179.22 | Contact light        |                               |
  | 203.62 | The Eagle has landed |                               |

### Levels

- Each track is set so its loudest half of 400 ms frames sits at −20 dBFS RMS, with peaks capped at −1 dBFS. Gains: air-to-ground −1.5 dB, FD loop +1.3 dB, PAO −4.4 dB.
- Fades are 30 ms. There is no noise reduction: the tape hiss and the Quindar tones are the real thing.

### Length: 3:33, longer than the 2 to 3 minutes asked

The brief asks for the 1202 alarm, the low-level call, contact light and the landing with CAPCOM's reply. In the GET they span 102:42:58 to 102:46:15, which is 3 min 17 s, so 2 to 3 minutes cannot hold them all. I kept them all. For a 3:00 cut, set `CUT = (79.0, 259.0)` in `scripts/build_apollo.py`. That starts at "540 feet" and drops the 1202 call, and it keeps low level, the 60-second call, contact light and the landing with the reply.

## Session 2: The Light caught by the Stone (`light-caught-by-the-stone`)

- **Source:** archive.org `thelightmasters`. It has 28 masters (WAV, 44.1 kHz, all 234.92 s and sample-aligned) plus a 2024 mix by Kresimir K. I used archive.org's lossless FLAC derivatives of the WAVs.
- **Excerpt:**
  - Masters from 3.700 s, just before the first note at 3.81 s, for 36 bars at 59 bpm: 146.441 s, ending at 150.141 s.
  - It contains the horn intro, the groove, every sung line (vocals 40.67 to 146.66 s of the masters) and the kick-drum break. It ends as the drums drop out.
  - Fades: 30 ms in and 750 ms out. The fades are identical on every track.
- **Stems summed into 8 groups.** Each group is a plain sum at unity, then one common gain (−3.9 dB) so the sum of all groups peaks at −1 dBFS. This keeps the masters' own balance.

  | Group   | Masters                                                    |
  | ------- | ---------------------------------------------------------- |
  | drums   | BD, SN, HH, TOM1ohL, TOM2ohR, TOM3, PERC1pand, PERC2binghi |
  | bass    | BASS                                                       |
  | guitars | GT1skank, GT2solo                                          |
  | keys    | MELODICA, KEY1piano, KEY2wacu, KEY3hmnd, KEY4clav, KEY5fx  |
  | horns   | TRP1-3, SAX1-3, TBN                                        |
  | vox1    | ENG_VOX1                                                   |
  | vox2    | ENG_VOX2                                                   |
  | chorus  | ENG_CORO1, ENG_CORO2                                       |

- **Check against the published mix:**
  - The mix lines up with our stem sum at exactly the same offset (3.70 s), and the envelope correlation is 0.67.
  - Spectral balance (sum minus mix, each normalised): 20 to 120 Hz 0.0 dB, 120 to 500 Hz +2.1 dB, 500 Hz to 2 kHz −2.0 dB, 2 to 6 kHz +0.9 dB, 6 to 16 kHz −7.4 dB. The 2024 remaster is brighter, which is expected from mastering EQ.
  - No major part is missing.
  - Each group's share of the sum: bass −1.4 dB, drums −9.9, chorus −13.7, keys −14.3, horns −14.5, vox1 −16.1, vox2 −18.2, guitars −20.9. The guitar parts are sparse in this section.
  - The raw stems are bass-heavy, as unmixed masters usually are; the mixer is there for that.
- **Lyrics:**
  - The text is the lyrics published verbatim in the item's description, from "as infering the light caught by the stone" to "has access to all", 25 lines. Spelling such as "infering" and "overstand" is kept.
  - All 25 lines are sung in the excerpt. The heading line "REALITY IS HIDDEN..........." is not sung there.
  - Segment (line) times come from forced alignment on Vocal 1 + Vocal 2. Lines are attributed to "Pablo C. Budassi and Tatiana Pino", because the item does not say which voice is on which stem.
  - Line starts agree with an independent Whisper pass on the vocal within a few tenths of a second (for example, "the interior of a knowledge plant": 73.54 s against Whisper 73.6 s).
  - Word times inside sung lines are rougher than for speech, because the acoustic model was trained on read speech.
- **Markers** are measured from the stems:

  | Time   | Marker         | Measured from                                      |
  | ------ | -------------- | -------------------------------------------------- |
  | 0      | Intro: horns   |                                                    |
  | 18.30  | Groove         | the horns stop                                     |
  | 36.88  | Vocals         |                                                    |
  | 97.25  | Break: no kick | kick silent from 100.95 to 108.81 s of the masters |
  | 105.11 | Full band      |                                                    |
  | 137.84 | Last line      |                                                    |

## Session 3: Dinner party (`dinner-party`)

- **Source:** DiPCo session S02 (dev set), close-talk files `S02_P05.wav` to `S02_P08.wav` (16 kHz, 16-bit, mono, 1800.59 s) and the transcript `S02.json`.
- **How it was fetched:**
  - The Zenodo record is a single 13.4 GB `.tgz`, so I did not download it.
  - The corpus's `LICENSE.txt` and `README.md` were read from the Zenodo archive itself, by streaming it and stopping after the first entries (`scripts/dipco_peek.py`).
  - I also stream-extracted `S02.json` from Zenodo. It is byte-identical to the Hugging Face mirror's copy (md5 `a8af835f4aec89a02b3af0db1f73cc2a`).
  - The close-talk WAVs came per file from the Hugging Face mirror `huckiyang/DiPCo`. Streaming them from Zenodo was abandoned because the eval set comes first in the archive and the stream ran at about 1 MB/s, which would take hours.
  - **The WAVs themselves were not checksum-verified against Zenodo.** Only their format and sizes look right. The mirror's LICENSE is byte-identical to Zenodo's.
- **Why S02:** the mirror has complete close-talk sets (all four mics) only for S02, S04 and S10. I ranked every 2-minute window before the music starts by turns, speakers and words. In S02, 18.50 to 146.00 s is lively, involves all four people, and is innocuous small talk about food:
  - lasagna;
  - someone who had never had an orange;
  - fruit at the office;
  - how the food is.

  It names no private person. People are referred to only as "somebody" or "she was from michigan".
  - **For you to judge:** one speaker jokes that their manager said to take just one orange ("frugality ... or being greedy").
  - An alternative window, about vegetarian cheese, jello and Oreos, is S02 132 to 256 s; set `CUT` in `scripts/build_dipco.py` to use it.

- **Processing, per microphone, all cut at identical sample positions:**
  - A 70 Hz high-pass.
  - A gentle **gate driven by the corpus's own utterance times** for that mic's wearer: −14 dB outside the wearer's utterances, which are padded by 0.25 s, with 80 ms ramps. It tames the other speakers' bleed and never cuts transcribed speech. The gates are open 20 to 30 % of the time.
  - Resampling 16 to 32 kHz, so every session is MPEG-1 MP3.
  - Levelling of the loudest quarter of 400 ms frames to −20 dBFS, with peaks capped at −1 dBFS. Gains are +24.8, +9.0, +15.0 and +26.4 dB. These close-talk mics were recorded quietly, so the noise floor rises with the gain.
  - 30 ms fades.
- **Transcript:**
  - Text, speaker, start and end come from `S02.json` (its close-talk times), verbatim, including tags such as `[laugh]` and `[noise]` and spellings such as `hmmm` and `uhhh`.
  - Speakers are labelled "Speaker 1 (P05)" to "Speaker 4 (P08)", in the corpus's own ids.
  - Word times come from forced alignment within each utterance, on the speaker's own mic, and are clamped inside the corpus's utterance span.
  - Five short backchannels ("hmmm", "yeah") aligned with low confidence; their times are approximate.
  - Utterances overlap (see the loader note).
- **Markers:** 0.00 Lasagna, 31.29 Never had an orange, 57.56 Fruit at the office, 114.09 The food tonight.

## Alignment (all sessions)

- The text always comes from the source. The model only places the given words in time.
- The aligner is `torchaudio.functional.forced_align` (CTC) with the `WAV2VEC2_ASR_BASE_960H` English model. A `<star>` token (as in torchaudio's tutorial) before each Apollo line soaks up untranscribed speech and noise.
- Numbers are aligned on their spoken form ("1202" as "twelve oh two", "3 1/2" as "three and a half"; the table is in `apollo_text.py`). They are displayed as printed.
- A tidy step trims words that grew implausibly long by swallowing a pause (the limit is 0.35 s + 0.11 s a letter) and keeps times monotonic.
- **Checks, in `checks/`:**
  - Words are monotonic, inside their segments and inside the session, and spell the text exactly.
  - Energy spot-check: every spoken word's span, 684 words in all, is louder than its track's quiet floor by at least 6 dB. One word failed and was fixed (above).
  - Independent second opinion: faster-whisper `small.en` word timestamps against ours, for matching words (`checks/asr_crosscheck.txt`). Whisper's timestamps are themselves approximate, and they run consistently 45 to 90 ms earlier than ours.

    | Track                | Words matched | Median difference | 90th percentile |
    | -------------------- | ------------- | ----------------- | --------------- |
    | Apollo air-to-ground | 124           | 100 ms            | 340 ms          |
    | DiPCo P05            | 38            | 60 ms             | 265 ms          |
    | DiPCo P06            | 52            | 50 ms             | 177 ms          |
    | DiPCo P07            | 78            | 70 ms             | 362 ms          |
    | DiPCo P08            | 32            | 80 ms             | 412 ms          |

- **Expected quality:**
  - About 0.1 s for most words in clean speech, good enough to highlight words as they play.
  - Worse for Apollo's noisiest passages and for sung words.
  - Line and segment boundaries are reliable.

## Re-running

`sh scripts/build_all.sh` from this folder does the whole thing: venv, fetch, build, checks, decode test. It needs about 1.5 GB while it runs (venv, models, sources); `dl/` and `work/` can be deleted afterwards. Individual steps:

- `scripts/fetch_*.sh`: fetch the sources.
- `scripts/build_{apollo,song,dipco}.py`: build each session.
- `scripts/qc.py`: the checks.
- `scripts/decode_test.py`: the browser decode test.
- Investigation helpers: `chan_stats.py`, `xcorr.py`, `asr_scan.py`, `asr_words.py`, `stem_map.py`, `dipco_windows.py`, `dipco_show.py`. ASR was used only to locate passages and to cross-check timing, never as transcript text.

The model weights (wav2vec2 base, 360 MB; Whisper base.en and small.en) live in `.torch/` and `.models/` inside this folder. `.gitignore` excludes `.venv`, the model folders, `dl/` and `work/`.
