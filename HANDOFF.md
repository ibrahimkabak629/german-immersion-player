## PROJECT: German Immersion Player
## Date: Day 3 Session

### WHAT WAS BUILT TODAY

**UI redesign (premium pass)**
- Full visual overhaul: new brand mark/favicon, refined oklch tokens, gradient-border accents
- Sliding-pill CEFR level selector, Linear-style icon rail, real chat UI for the AI tutor
- Fully mobile responsive (tab-switched transcript/tutor below 1024px)

**Player features**
- Per-line instant replay: replay icon on every transcript line + R shortcut for the current line
- Playback speed control: 0.5x-1.5x dropdown, </> shortcuts, persisted, affects video+dubbed audio together
- Subtitle delay control: +/-0.25s steps, -3s..+3s range, reset, saved per video (display timing only)
- Learning modes: Listening / Reading (default) / Speaking, M cycles, persisted
  - Listening: subtitles hidden behind a hint, "Show subtitle" reveal after the line ends
  - Speaking: auto-pauses after each line, mic record + playback of your attempt, Resume
- Word-level subtitle highlighting (see below)

**Learning features**
- Settings panel: 8 toggles, all persisted to localStorage
- Word bank: auto-extracted German words, Groq lookups, star/learned, filters
- Grammar explainer: tap any German word for meaning/grammar/why/examples via /ask-tutor
- Daily challenge: 5 mixed questions from watch history, optional streak
- Post-video popup: practice prompt with flashcards / fill-blank / quiz / grammar
- Video history: date, level, duration, % watched, words learned, resume, delete
- Level-up suggestions: after 3 consecutive 80%+ results, a dismissable "try B2?" nudge
- Exports: word bank as Anki CSV + plain CSV, transcript as side-by-side PDF
- German keyboard helper: floating ä ö ü ß bar that follows focus into any text input

**Dubbing pipeline fixes**
- Video quality fix: found and fixed the real bug behind dubbed videos losing quality
  (e.g. 1080p looking like 480p). `-c:v copy` was already in place, but
  `mux_audio_with_video` mapped video with the bare `-map 0:v`, which matches every
  video stream in the input — including embedded thumbnail/cover-art streams some
  MP4s carry, which some players show instead of the real footage. Fixed with
  `-map 0:v:0` to pin to the primary video stream only. Validated on a synthetic
  1080p+thumbnail reproduction case and on real `test_clip.mp4` — output resolution
  now matches input exactly, with `-c:v copy` confirming no re-encode.
- Background music preservation: added Demucs (`htdemucs`, GPU-accelerated on the
  RTX 4070) to separate vocals from background music/ambiance before transcription.
  Only the vocals get transcribed and translated; the dubbed German voice is mixed
  back over the ORIGINAL background track (with ducking) instead of replacing all
  audio. New `preserve_background` toggle on `/process-video` (default enabled),
  falls back to the original full-audio-replacement behavior automatically if
  Demucs is missing or separation fails. Also fixed a real `amix` bug found while
  testing: ffmpeg's `duration=longest` doesn't reliably zero-pad a shorter stream,
  so the dubbed voice could bleed/hold open under the background for the rest of
  the video — fixed by explicitly padding the voice track to the background's
  length before mixing.

### WORD-LEVEL TIMESTAMPS (Feature 7 details)
- transcriber.py requests `timestamp_granularities: ["segment", "word"]` from Groq;
  local Whisper fallback uses `word_timestamps=True`
- Groq returns word timings at the top level, so they're mapped onto segments by time range
- SRT can't carry word data, so the backend now also writes `segments.json` into the result zip;
  the frontend prefers it and falls back to parsing the dual SRT when absent
- Highlighting runs on requestAnimationFrame (timeupdate only fires ~4x/sec and lags visibly),
  but only re-renders when the word index changes
- Whisper times the spoken ENGLISH audio, so the English line is exact; the German line is a
  rewrite with no timings of its own and is highlighted proportionally
- Segments without timings render plain — graceful segment-level fallback

### CURRENT STATE OF EVERY MODULE
- transcriber.py: Groq Whisper large-v3 + word timestamps, GPU local fallback, confidence flagging
- translator.py: DeepL base + Groq context refinement + CEFR adaptation; passes word timings through
- dubber.py: Fish Audio voice cloning, emotion tags, audio normalization, Demucs
  vocal/background separation with background remix, primary-stream-safe muxing
- subtitle_sync.py: dual language SRT generation
- data_collector.py: saves every translation to cefr_training_data.jsonl
- src/api/main.py: FastAPI; /process-video zip now includes segments.json alongside SRT + video
- frontend: React + Vite + TS; contexts for Theme, Settings, LearningData, Playback

### LOCALSTORAGE KEYS
`gip-theme`, `gip-level`, `gip-settings`, `gip-word-bank`, `gip-watch-history`,
`gip-streak`, `gip-playback-rate`, `gip-learning-mode`, `gip-subtitle-offsets`,
`gip-level-progress`

### DEV NOTE
Open the app with `?demo=1` to load a short public-domain clip with fake dual-language
segments (including word timings on 2 of 3 segments, the third deliberately without, to
exercise the fallback). Lets every player feature be tested without running the pipeline.

### KNOWN BUGS / LIMITATIONS STILL OUTSTANDING
- Pronunciation scoring is a settings toggle only — no scoring model is integrated.
  Speaking mode records and plays back, but does not score. Needs a speech model to be real.
- Voice sounds slightly AI dubbed (Fish Audio free tier limitation)
- Russian transcription accuracy needs more testing with large-v3
- B2 level on songs still needs verification after CEFR prompt fix
- Word-level timing for the GERMAN line is proportional, not true per-word timing —
  real German timings would require forced alignment against the dubbed audio
- Word timings not yet verified against a real Groq response; the parsing/normalization
  is unit-tested against both dict and object shapes, but an end-to-end run through the
  live API would confirm the field names match

### NEXT SESSION PLAN

**Speaker diarization (next priority)**
- Use pyannote.audio to detect who is speaking when in multi-speaker videos
- Clone a separate voice for each unique speaker detected
- Match each transcribed segment to the correct speaker's cloned voice during dubbing
- Use speaker voice verification to distinguish main speakers from meme sound effects,
  background voices, or non-speech audio — anything that doesn't match a confirmed
  speaker gets left untouched in the original audio rather than being dubbed
- Must gracefully fall back to current single-speaker behavior if only one speaker is
  detected or diarization fails
- Flag if pyannote.audio needs a HuggingFace token for model access

**Still remaining after that**
- Context-aware translation — pass full transcript for consistent terminology
- Job queue system for concurrent video processing
- Progress dashboard (words learned, minutes watched, CEFR progress over time)
