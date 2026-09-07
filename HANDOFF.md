## PROJECT: German Immersion Player
## Date: Day 4 Session

### WHAT WAS BUILT TODAY

**Speaker diarization**
- pyannote.audio (`speaker-diarization-3.1` + `segmentation-3.0`, both gated - needs
  `HUGGINGFACE_TOKEN` in `.env` with access accepted) runs on the Demucs-isolated vocals
  track, so background music doesn't confuse speaker embeddings
- Each transcribed segment gets labeled with its diarized speaker (nearest-turn fallback
  when Whisper's and pyannote's independently-computed timings don't overlap at a boundary)
- A speaker is only "confirmed" (worth cloning a voice for) once it accumulates >= 2s of
  total speaking time - filters out one-off diarization blips (meme sound effects,
  background voices) that would otherwise get their own bogus voice clone
- 2+ confirmed speakers: one Fish Audio voice cloned per speaker (from their longest
  turns), each segment dubbed in its own speaker's voice. A segment matched to an
  unconfirmed speaker is left as an untouched original-audio passthrough instead of
  being dubbed
- 0-1 confirmed speakers: identical to the pre-diarization single-voice-clone behavior -
  zero risk to existing videos
- Worked around two pyannote.audio 4.x quirks found during integration: it eager-loads a
  PLDA model from a second, unrelated gated repo even when the checkpoint's own
  AgglomerativeClustering never uses it (worked around with a narrow monkeypatch that
  falls back to None on 403); and it reads files via torchcodec, whose native DLLs
  wouldn't load on this machine (worked around by loading the waveform with `soundfile`
  and passing pyannote's documented `{"waveform", "sample_rate"}` dict instead)

**Security audit and fixes**
- Found and fixed a HIGH-severity SSRF in `/process-video`'s `url` field: it was fetched
  server-side with zero validation (full attacker control of scheme/host/port), which
  could reach cloud metadata endpoints or internal-only services. Now restricted to
  http(s), resolves the hostname, rejects any address that isn't publicly routable, and
  rejects redirects outright. Regression-tested.
- An old `.env` (real API key values) that had been committed to git history in an early
  commit was scrubbed from all 4 branches with `git filter-repo` and force-pushed; all
  affected keys (DeepL, Fish Audio, Groq, HuggingFace) have been rotated and verified
  working end-to-end
- Removed a stale, already-inactive Anthropic API key reference (the app never actually
  depended on it - Groq/DeepL fully cover translation)

**Context-aware translation**
- `translate_segments` now makes the whole video's transcript available as context
  instead of translating each segment in isolation, so a name or term translated one way
  in segment 1 doesn't drift into a different rendering by segment 20 - without resending
  the full transcript on every one of a video's N segment calls:
  - `translate_base_batch`: every segment's English text goes to DeepL in a single
    batched call instead of one call per segment, so DeepL's engine sees the whole
    document at once
  - `build_terminology_glossary`: one extra Groq pass over the full transcript up front,
    surfacing recurring proper nouns/terms/phrases and pinning down a single German
    rendering for each; that compact glossary (not the whole transcript) is then reused
    in every segment's refinement (`refine_translation_context`) and level-adaptation
    (`adapt_to_level`) call
- Verified directly: a name and a term repeated 6s apart in a test transcript came back
  identically rendered in both the first and last mention

**Job queue system**
- `src/api/jobs.py`: a minimal in-memory FIFO queue (`JobManager`) with a fixed pool of
  background worker threads - no Celery/Redis, appropriate for this app's scale.
  `MAX_CONCURRENT_JOBS = 1` by default: Demucs/pyannote/local-Whisper-fallback all share
  one CUDA device, so concurrent GPU work risks VRAM contention/OOM rather than any real
  speedup: one worker keeps jobs strictly sequential and safe
- `POST /process-video` now persists the input and returns `{job_id}` immediately instead
  of blocking until the whole pipeline finishes; `GET /jobs/{id}` reports
  status/step/queue_position/error; `GET /jobs/{id}/download` returns the result zip once
  done (409 if not ready yet) and cleans up the job's temp dir afterward. Finished jobs
  that are never downloaded are still evicted (and their temp dir removed) after 1 hour
- The old global `/progress` broadcast websocket was removed entirely - it broadcast to
  every connected client with no per-job scoping, which would have mixed one job's
  progress into another's UI under real concurrent load. Polling `GET /jobs/{id}` is
  inherently per-job-isolated by construction
- Frontend: `useVideoProcessing` now submits + polls (1.5s interval) instead of a single
  blocking request + websocket; a new `queued` processing state shows queue position via
  `ProcessingOverlay`
- Verified with a genuine concurrent test: submitted two different-length clips
  back-to-back, confirmed one was immediately `processing` while the other was `queued`
  at position 1, and confirmed each job's downloaded result matched its OWN input's
  duration exactly (not the other job's) - the actual "no data mixing" property

### CURRENT STATE OF EVERY MODULE
- transcriber.py: Groq Whisper large-v3 + word timestamps, GPU local fallback, confidence flagging
- diarizer.py: pyannote.audio speaker diarization, confirmed-speaker duration threshold,
  nearest-turn segment assignment
- translator.py: DeepL batched base translation + cross-video terminology glossary +
  Groq context refinement + CEFR adaptation, all glossary-aware for consistency
- dubber.py: Fish Audio voice cloning (single-voice and per-speaker), emotion tags, audio
  normalization, Demucs vocal/background separation with background remix,
  primary-stream-safe muxing, unconfirmed-speaker original-audio passthrough
- subtitle_sync.py: dual language SRT generation
- data_collector.py: saves every translation to cefr_training_data.jsonl
- src/api/jobs.py: in-memory job queue (JobManager), 1 worker thread by default
- src/api/main.py: FastAPI; /process-video enqueues and returns a job_id;
  /jobs/{id} and /jobs/{id}/download for status + result; SSRF-guarded url downloads
- frontend: React + Vite + TS; contexts for Theme, Settings, LearningData, Playback;
  useVideoProcessing polls the job queue instead of a blocking request + websocket

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
- Speaker diarization accuracy is inherently probabilistic - pyannote can occasionally
  split one speaker into two clusters or merge two distinct speakers into one, especially
  on short clips; the confirmed-speaker duration threshold guards against acting on a
  low-confidence split but doesn't eliminate misclassification
- Job queue state is in-memory only - a server restart loses all queued/in-progress job
  records, and any of their temp dirs on disk are orphaned (nothing can evict what's no
  longer in the dict). Eviction of finished-but-never-downloaded jobs is also opportunistic
  rather than timer-driven - it only runs when some job's status is next queried, so a
  job finished right before the server goes idle can sit past its 1-hour retention window
  until another request touches the queue. Fine for this app's current single-process
  deployment, would need a persistent store + a real timer to fully close these gaps
- MAX_CONCURRENT_JOBS is fixed at 1 for GPU safety - multiple submitted videos process
  strictly sequentially, not in parallel, even on hardware with GPU headroom to spare

### NEXT SESSION PLAN

**Progress dashboard**
- Words learned, minutes watched, CEFR progress over time
- Data already collected via video history + word bank localStorage; needs a dedicated view

**Possible follow-ups**
- Multi-speaker diarization has only been validated against a synthetic 2-speaker clip and
  ground-truth-injected turns (see prior session) - worth running through a real
  multi-speaker interview/dialogue video if one becomes available
- MAX_CONCURRENT_JOBS could be made configurable (env var) for deployments with GPU
  headroom to spare, or job records could be persisted to survive a server restart
