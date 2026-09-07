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
- dubber.py: Fish Audio voice cloning, emotion tags, audio normalization
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

### SUGGESTED NEXT STEPS
1. Run a real video through the pipeline end-to-end to confirm Groq word timings land correctly
2. Speaker diarization — detect who is speaking, assign different cloned voices
3. Context-aware translation — pass full transcript for consistent terminology
4. Job queue system for concurrent video processing
5. Progress dashboard (words learned, minutes watched, CEFR progress over time)
