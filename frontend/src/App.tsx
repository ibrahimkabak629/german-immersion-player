import { useEffect, useRef, useState } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { SettingsProvider, useSettings } from './context/SettingsContext';
import { LearningDataProvider, useLearningData } from './context/LearningDataContext';
import { PlaybackProvider, type VideoPlayerHandle } from './context/PlaybackContext';
import { AppShell } from './components/layout/AppShell';
import { TopBar } from './components/layout/TopBar';
import { VideoPlayer } from './components/video/VideoPlayer';
import { VideoSourceBar } from './components/video/VideoSourceBar';
import { ProcessingOverlay } from './components/video/ProcessingOverlay';
import { ProcessingErrorPanel } from './components/video/ProcessingErrorPanel';
import { DownloadBar } from './components/video/DownloadBar';
import { TranscriptPanel } from './components/transcript/TranscriptPanel';
import { AITutorChat } from './components/tutor/AITutorChat';
import { SettingsPanel } from './components/settings/SettingsPanel';
import { WordBankPanel } from './components/wordbank/WordBankPanel';
import { GrammarPopover, type GrammarTarget } from './components/grammar/GrammarPopover';
import { PostVideoPopup, type PracticeOption } from './components/popup/PostVideoPopup';
import { PracticeModal } from './components/practice/PracticeModal';
import { DailyChallenge } from './components/practice/DailyChallenge';
import { useVideoProcessing } from './hooks/useVideoProcessing';
import { DEMO, DEMO_SEGMENTS, DEMO_TITLE, DEMO_VIDEO_URL } from './lib/demoFixture';
import type { GermanLevel, Segment } from './types/segment';

function AppContent() {
  const [level, setLevel] = useState<GermanLevel>('B1');
  const videoPlayerRef = useRef<VideoPlayerHandle>(null);
  const { state: processing, start, reset } = useVideoProcessing();
  const { settings, setSetting } = useSettings();
  const { wordBank, recordWatchedVideo } = useLearningData();

  const [wordBankOpen, setWordBankOpen] = useState(false);
  const [dailyChallengeOpen, setDailyChallengeOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [practiceMode, setPracticeMode] = useState<PracticeOption | null>(null);
  const [grammarTarget, setGrammarTarget] = useState<GrammarTarget | null>(null);
  const [showPostVideoPopup, setShowPostVideoPopup] = useState(false);

  const segments = DEMO ? DEMO_SEGMENTS : processing.status === 'ready' ? processing.segments : [];
  const recordedRef = useRef<string | null>(null);

  useEffect(() => {
    if (DEMO) {
      if (recordedRef.current !== 'demo' && settings.wordBank) {
        recordedRef.current = 'demo';
        recordWatchedVideo(DEMO_TITLE, level, DEMO_SEGMENTS);
      }
      return;
    }
    if (processing.status !== 'ready' || !settings.wordBank) return;
    const key = processing.videoFile.name + processing.segments.length;
    if (recordedRef.current === key) return;
    recordedRef.current = key;
    recordWatchedVideo(processing.title, processing.level, processing.segments);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processing.status === 'ready' ? processing.videoFile : null]);

  function handleWordClick(word: string, segment: Segment) {
    setGrammarTarget({ word, german: segment.translated, english: segment.original });
  }

  function handleVideoEnded() {
    if (settings.postVideoPopup) setShowPostVideoPopup(true);
  }

  function handlePracticeSelect(option: PracticeOption) {
    setShowPostVideoPopup(false);
    setPracticeMode(option);
  }

  let videoArea;
  if (DEMO) {
    videoArea = (
      <VideoPlayer
        ref={videoPlayerRef}
        source={{ kind: 'url', url: DEMO_VIDEO_URL }}
        segments={DEMO_SEGMENTS}
        onSourceChange={reset}
        onWordClick={settings.grammarExplainer ? handleWordClick : undefined}
        onEnded={handleVideoEnded}
      />
    );
  } else if (processing.status === 'ready') {
    videoArea = (
      <div className="flex h-full flex-col gap-3">
        <div className="min-h-0 flex-1">
          <VideoPlayer
            ref={videoPlayerRef}
            source={{ kind: 'file', file: processing.videoFile }}
            segments={processing.segments}
            onSourceChange={reset}
            onWordClick={settings.grammarExplainer ? handleWordClick : undefined}
            onEnded={handleVideoEnded}
          />
        </div>
        <DownloadBar videoFile={processing.videoFile} srtBlob={processing.srtBlob} />
      </div>
    );
  } else if (processing.status === 'processing') {
    videoArea = <ProcessingOverlay step={processing.step} />;
  } else if (processing.status === 'error') {
    videoArea = <ProcessingErrorPanel message={processing.message} onRetry={reset} />;
  } else {
    videoArea = <VideoSourceBar onSourceChange={(source) => start(source, level)} />;
  }

  const currentTitle = DEMO ? DEMO_TITLE : processing.status === 'ready' ? processing.title : null;
  const videoWordBank = currentTitle ? wordBank.filter((e) => e.videoTitle === currentTitle) : [];

  return (
    <PlaybackProvider videoPlayerRef={videoPlayerRef}>
      <AppShell
        topBar={
          <TopBar
            level={level}
            onLevelChange={setLevel}
            onWordBank={() => setWordBankOpen(true)}
            onDailyChallenge={() => setDailyChallengeOpen(true)}
            onSettings={() => setSettingsOpen(true)}
          />
        }
        videoArea={videoArea}
        transcriptPanel={
          <TranscriptPanel segments={segments} onWordClick={settings.grammarExplainer ? handleWordClick : undefined} />
        }
        tutorPanel={<AITutorChat level={level} segments={segments} />}
        onWordBank={() => setWordBankOpen(true)}
        onDailyChallenge={() => setDailyChallengeOpen(true)}
        onSettings={() => setSettingsOpen(true)}
      />

      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <WordBankPanel open={wordBankOpen} onClose={() => setWordBankOpen(false)} />
      <DailyChallenge open={dailyChallengeOpen} onClose={() => setDailyChallengeOpen(false)} />
      <PracticeModal mode={practiceMode} onClose={() => setPracticeMode(null)} segments={segments} wordBank={videoWordBank} />
      <GrammarPopover
        target={grammarTarget}
        onClose={() => setGrammarTarget(null)}
        level={level}
        videoTitle={currentTitle ?? 'this video'}
      />

      <PostVideoPopup
        open={showPostVideoPopup && settings.postVideoPopup}
        onSkip={() => setShowPostVideoPopup(false)}
        onDontAskAgain={() => {
          setSetting('postVideoPopup', false);
          setShowPostVideoPopup(false);
        }}
        onSelect={handlePracticeSelect}
      />
    </PlaybackProvider>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <SettingsProvider>
        <LearningDataProvider>
          <AppContent />
        </LearningDataProvider>
      </SettingsProvider>
    </ThemeProvider>
  );
}
