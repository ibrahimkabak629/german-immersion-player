# Handoff — German Immersion Player

Branch: `feature/subtitle-sync`. Last commit: `5844930 chore: stop tracking .env, add .gitignore`.

## 1. Module status

### `src/core/transcriber.py` — ✅ working
Whisper (`base` model) transcription with timestamps. Extracts audio via ffmpeg, transcribes, cleans up temp file. Tested end-to-end on `test_clip.mp4` (21 segments). No known issues.

### `src/core/translator.py` — ✅ working, but rate-limited
Gemini-based English→German translation with CEFR level control (A1–C2).
- Fixed today: the model was `gemini-2.0-flash`, which is dead (404). Switched to `gemini-3.6-flash` (the replacement Google's own API error pointed to).
- Fixed today: added exponential-backoff retry for transient `503 ServerError` ("model temporarily unavailable") — up to 4 attempts.
- **Not handled**: `429 RESOURCE_EXHAUSTED` (quota exhaustion) has no retry — see Known Bugs below. This is deliberate for now (retrying a *daily* quota with short backoff is pointless), but it means a single quota hit currently aborts `translate_segments()` entirely, discarding any translations already done in that batch.

### `src/core/subtitle_sync.py` — ✅ working
Generates `.srt` (single or dual-language) from timestamped segments. No known issues.

### `src/core/dubber.py` — ⚠️ code verified, untested end-to-end
German TTS + audio sync/mux pipeline.
- Originally built against ElevenLabs, then **switched to Fish Audio's REST API today** per request (`https://api.fish.audio/v1/tts`, model `s2.1-pro`, `FISH_AUDIO_API_KEY` from `.env`). Uses `requests` directly, no SDK.
- The ffmpeg sync/mux logic (`fit_audio_to_duration`, `build_dubbed_audio_track`, `mux_audio_with_video`) was validated with synthetic sine-wave audio clips of deliberately mismatched durations — segments landed exactly on target durations, final mux was frame-accurate. This is provider-agnostic and unaffected by the ElevenLabs→Fish Audio switch.
- **Blocked**: the one real end-to-end run (`tests/test_dubber.py`) failed at the TTS call with `402 Insufficient API credit` — the Fish Audio *API* credit (separate from platform credit) is empty. Auth and request format are both confirmed valid (a 402 means the request was accepted, just unfunded). **Never actually heard real Fish Audio output yet.**

### `frontend/` — ✅ working (mock data only)
Vite + React 18 + TypeScript + Tailwind v4 UI shell, built today. All 7 requested features implemented and manually verified in-browser: video player (file upload + URL, with CORS/bad-link error handling), dual German/English subtitle overlay synced to playback, A1–C2 level dropdown, dark/light toggle (dark default, persisted), scrollable transcript panel with click-to-seek and auto-scroll, AI Tutor chat panel (scripted responses, references the currently-playing line), video-majority layout. `npm run build` passes cleanly.
- **Not wired to the backend** — this was an explicit scope decision (see §5). `frontend/src/data/mockTranscript.ts` has real English text/timestamps (from `test_output_dual.srt`) with hand-written German, not live pipeline output.
- No automated tests exist for the frontend (manual browser verification only).

## 2. Known bugs and problems

1. **Gemini free-tier quota exhausted.** `generativelanguage.googleapis.com/generate_content_free_tier_requests`, limit 20/day for `gemini-3.6-flash`. Hit repeatedly today; requires either waiting for the daily reset or upgrading the Gemini API billing plan. Blocks: translating the remaining 18 of 21 real segments, and the pending character-count task (see §4).
2. **Fish Audio API credit is empty** (`402`). Blocks all real TTS output from `dubber.py` — the code path has never produced actual audio, only been validated structurally.
3. **`translate_segments()` discards partial progress on failure.** If segment 5 of 21 hits a quota error, segments 1–4's translations are lost (the function returns `None`, not partial results). Worth fixing if quota resets frequently.
4. **Old API keys are in git history.** `.env` (with real `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`) was committed directly in earlier commits (`53f83da` and before) before tracking was stopped today. Untracking (`5844930`) prevents *future* leaks but does not remove the keys already in history. **Recommend rotating those keys** if this repo is ever made public or shared, since `git log`/`git show` still exposes them.
5. **Frontend transcript covers only ~3 min / 21 segments** — matches the one test clip available; fine for the mock-data UI shell, but will need real pipeline output once wired up.

## 3. What was being worked on today

In order:
1. Fixed `translator.py` (dead model, retry logic) — committed.
2. Built `dubber.py` against ElevenLabs, validated ffmpeg logic, fixed a `-shortest`/keyframe cutoff bug — committed.
3. Switched `dubber.py` to Fish Audio per request — committed.
4. Ran `tests/test_dubber.py` end-to-end once real keys were in place — hit the Fish Audio 402, unresolved.
5. Cleaned up `.env` tracking (added `.gitignore`, `git rm --cached .env`) after a safety block on committing a live key — committed.
6. Added 3 MCP servers to Claude Code config: `21st` (21st.dev component generation), `context7`, `github` (GitHub Copilot MCP, with a PAT). All connected but **`21st` has never actually been used** — it was added mid-session and needs a session restart to load its tools; user opted to hand-build the frontend UI instead of waiting.
7. Attempted a character-count analysis of German translations across all 21 segments of `test_clip.mp4` — repeatedly blocked by the Gemini quota exhaustion in #1. Last attempt (first 3 segments only, no retry pacing per explicit request) also failed with `429`. **This task is incomplete — no character counts were ever produced.**
8. Built the full `frontend/` UI shell (the bulk of today's work) — see §1. This is done and verified working.

## 4. Next steps, in priority order

1. **Resolve the Fish Audio credit block** and run `tests/test_dubber.py` for the first real end-to-end dub. This is the single biggest unknown — the TTS output quality, voice, and whether `fit_audio_to_duration`'s speed-adjustment sounds natural on real speech (only tested on sine tones) are all unverified.
2. **Resolve the Gemini quota** (wait for daily reset, or upgrade billing) and:
   - Re-run the character-count task the user asked for: translate first 3 segments of `test_output.srt` at B1, count characters (was never completed — see §2.1, §3.7).
   - Then translate the remaining segments if a full 21-segment run is still wanted.
3. **Decide on and build the backend API layer** to wire `frontend/` to the real pipeline (transcriber → translator → dubber). Nothing exists yet — this was explicitly deferred today. Needs a framework decision (FastAPI is the natural fit given the existing Python codebase) and endpoint design (upload/transcribe, translate, dub, likely job-status polling given transcription/dubbing aren't instant).
4. **Fix `translate_segments()` to preserve partial results** on mid-batch failure (see §2.3), so a quota hit partway through doesn't discard already-completed work.
5. **Rotate the API keys** that are exposed in git history (see §2.4) if this repo will ever be shared or made public.
6. Optional: restart the Claude Code session to load the `21st` MCP server's tools, if there's a desire to revisit the frontend's component polish using it specifically (current build hand-rolled equivalent-quality components without it, so this is not blocking — just unused tooling sitting available).

## 5. Important technical decisions

- **Gemini model**: `gemini-2.0-flash` → `gemini-3.6-flash` (forced by deprecation, not a preference).
- **Retry policy**: `translator.py` retries `ServerError` (503) with exponential backoff, but *not* `ClientError`/429 (quota) — retrying a daily quota with a short backoff isn't productive, so those are left to fail fast.
- **TTS provider**: ElevenLabs → Fish Audio, per explicit request. Implementation is direct REST calls via `requests` (no SDK dependency), model `s2.1-pro`, voice via optional `reference_id` (omitted = Fish Audio's default voice).
- **ffmpeg mux fix**: `-shortest` combined with `-c:v copy` only cuts at keyframe boundaries (was overshooting target duration by several seconds in testing) — replaced with an explicit `-t` computed from `min(video_duration, audio_duration)` for frame-accurate output.
- **`.env` handling**: stopped tracking it in git today (`.gitignore` + `git rm --cached`) rather than rewriting history — a deliberate choice to avoid a destructive history rewrite; the tradeoff is old keys remain recoverable from history (see §2.4, §4.5).
- **Frontend stack**: Vite + React + TypeScript + Tailwind v4, **no component library** (no shadcn/Radix/MUI) — hand-rolled primitives, chosen specifically to avoid a "generic AI-generated UI" look, per explicit request. Fraunces (serif) for display/subtitle text + Geist for UI text, warm amber accent instead of indigo/violet, hairline borders over drop shadows.
- **Frontend scope**: standalone UI shell with mock data this pass, **not wired to a backend** — an explicit, discussed tradeoff (see next-steps §3) to get the design right before backend integration, rather than building both at once.
- **Frontend segment shape**: `frontend/src/types/segment.ts`'s `Segment` type intentionally mirrors `subtitle_sync.py`'s output shape (`start`, `end`, `original`, `translated`) so backend wiring later is a data-source swap, not a type rewrite.

## 6. Day 3 Plan

Core improvements to complete, in order:

### 1. UI Redesign (Priority 1)
- Complete premium redesign using 21st.dev MCP components
- Make it look like Linear/Vercel/Raycast quality
- Fix the "AI coded" look completely
- Dark/light mode polish
- Mobile responsive

### 2. Word-Level Subtitle Highlighting (Priority 2)
- Each word highlights in the subtitle as it is spoken
- Requires word-level timestamps from Groq Whisper
- This is the killer learning feature

### 3. Speaker Diarization (Priority 3)
- Detect who is speaking at each moment
- Assign different cloned voices per speaker
- Essential for multi-speaker videos

### 4. Context-Aware Translation (Priority 4)
- Pass full video transcript as context to DeepL/Groq
- Keep terminology consistent across whole video
- Fix slang and context mistakes

### 5. Job Queue System (Priority 5)
- Handle multiple videos processing at once
- Prevent server crashes under load
- Show position in queue to user

### 6. Progress Dashboard (Priority 6)
- Words learned tracker
- Minutes watched
- CEFR level progress
- Streak tracking
