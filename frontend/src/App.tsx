import { useRef, useState } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { PlaybackProvider, type VideoPlayerHandle } from './context/PlaybackContext';
import { AppShell } from './components/layout/AppShell';
import { TopBar } from './components/layout/TopBar';
import { VideoPlayer } from './components/video/VideoPlayer';
import { VideoSourceBar } from './components/video/VideoSourceBar';
import { ProcessingOverlay } from './components/video/ProcessingOverlay';
import { ProcessingErrorPanel } from './components/video/ProcessingErrorPanel';
import { TranscriptPanel } from './components/transcript/TranscriptPanel';
import { AITutorChat } from './components/tutor/AITutorChat';
import { useVideoProcessing } from './hooks/useVideoProcessing';
import type { GermanLevel } from './types/segment';

function AppContent() {
  const [level, setLevel] = useState<GermanLevel>('B1');
  const videoPlayerRef = useRef<VideoPlayerHandle>(null);
  const { state: processing, start, reset } = useVideoProcessing();

  const segments = processing.status === 'ready' ? processing.segments : [];

  let videoArea;
  if (processing.status === 'ready') {
    videoArea = (
      <VideoPlayer
        ref={videoPlayerRef}
        source={{ kind: 'file', file: processing.videoFile }}
        segments={processing.segments}
        onSourceChange={reset}
      />
    );
  } else if (processing.status === 'processing') {
    videoArea = <ProcessingOverlay step={processing.step} />;
  } else if (processing.status === 'error') {
    videoArea = <ProcessingErrorPanel message={processing.message} onRetry={reset} />;
  } else {
    videoArea = <VideoSourceBar onSourceChange={(source) => start(source, level)} />;
  }

  return (
    <PlaybackProvider videoPlayerRef={videoPlayerRef}>
      <AppShell
        topBar={<TopBar level={level} onLevelChange={setLevel} />}
        videoArea={videoArea}
        transcriptPanel={<TranscriptPanel segments={segments} />}
        tutorPanel={<AITutorChat level={level} segments={segments} />}
      />
    </PlaybackProvider>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}
