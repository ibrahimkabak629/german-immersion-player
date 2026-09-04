# German Immersion Player — Frontend

A standalone UI shell for the German Immersion Player, built with Vite + React + TypeScript + Tailwind CSS.

**This pass uses mock data only** — there's no backend wiring yet. The mock transcript
(`src/data/mockTranscript.ts`) reuses real English text and timestamps from this repo's own
`test_output_dual.srt`, paired with hand-authored German. The `Segment` type
(`src/types/segment.ts`) intentionally mirrors the shape produced by
`src/core/subtitle_sync.py` (`start`, `end`, `original`, `translated`) so wiring this up to the
real transcriber → translator pipeline later is a drop-in data swap, not a rewrite.

## Run it

```bash
npm install
npm run dev
```

## Structure

- `src/components/video/` — player, controls, dual subtitle overlay, source (upload/URL) picker
- `src/components/transcript/` — scrollable, click-to-seek transcript panel
- `src/components/tutor/` — AI Tutor chat (scripted responses in `src/data/tutorResponses.ts`, no real LLM call yet)
- `src/components/controls/` — level selector, theme toggle
- `src/context/` — theme (dark-default, persisted) and playback (currentTime/duration/seek) state
- `src/hooks/useActiveSegment.ts` — binary-search subtitle sync against the segments array
