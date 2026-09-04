import { useRef, useState } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { PlaybackProvider, type VideoPlayerHandle } from './context/PlaybackContext';
import { AppShell } from './components/layout/AppShell';
import { TopBar } from './components/layout/TopBar';
import { VideoPlayer } from './components/video/VideoPlayer';
import { TranscriptPanel } from './components/transcript/TranscriptPanel';
import { AITutorChat } from './components/tutor/AITutorChat';
import { mockSegments } from './data/mockTranscript';
import type { GermanLevel, VideoSource } from './types/segment';

function AppContent() {
  const [level, setLevel] = useState<GermanLevel>('B1');
  const [source, setSource] = useState<VideoSource>(null);
  const videoPlayerRef = useRef<VideoPlayerHandle>(null);

  return (
    <PlaybackProvider videoPlayerRef={videoPlayerRef}>
      <AppShell
        topBar={<TopBar level={level} onLevelChange={setLevel} />}
        videoArea={
          <VideoPlayer ref={videoPlayerRef} source={source} segments={mockSegments} onSourceChange={setSource} />
        }
        transcriptPanel={<TranscriptPanel segments={mockSegments} />}
        tutorPanel={<AITutorChat level={level} segments={mockSegments} />}
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
