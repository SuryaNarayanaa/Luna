import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useHotkeys } from 'react-hotkeys-hook';

// Components
import { TopBar } from './components/TopBar';
import { VideoPlayerSection } from './components/VideoPlayerSection';
import { TranscriptEditor } from './components/TranscriptEditor';
import { TimelinePanel } from './components/TimelinePanel';
import { CompactTranscriptEditor } from './components/CompactTranscriptEditor';
import { CompactTimelinePanel } from './components/CompactTimelinePanel';
import { ResizableSplitView } from './components/ResizableSplitView';
import { RightSidebar } from './components/RightSidebar';

// Types
import type {
  TranscriptionSegment,
  TranscriptSegment,
  TimelineTrack,
  Speaker,
  PlayerState,
  ViewState,
  EditState,
  TTSSettings,
  ExportSettings,
  UndoAction,
  RegenerationLog,
  SpeakerStats
} from './types';

function App() {
  // Core Player State
  const [playerState, setPlayerState] = useState<PlayerState>({
    currentTime: 0,
    duration: 180,
    isPlaying: false,
    volume: 1,
    playbackRate: 1,
    loop: false,
    transcriptSync: true,
    selectedSpeaker: undefined
  });
  // View State
  const [viewState, setViewState] = useState<ViewState>({
    activeView: 'video', // Start with video view
    splitRatio: 0.6,
    transcriptOverlay: false,
    dockableLayout: {}
  });

  // Edit State
  const [editState, setEditState] = useState<EditState>({
    selectedSegment: undefined,
    undoStack: {},
    regenHistory: [],
    macroQueue: []
  });
  // UI State
  const [isDark, setIsDark] = useState(true);
  const [selectedProject] = useState('current-project');
  const [autosaveStatus, setAutosaveStatus] = useState<'saved' | 'saving' | 'pending'>('saved');

  // Mock Data
  const [projects] = useState([
    { id: 'current-project', name: 'AI Ethics Podcast - Episode 1' },
    { id: 'project-2', name: 'Tech Talk - Future of Work' }
  ]);
  const [speakers] = useState<Speaker[]>([
    { id: 'host', name: 'Alex Chen', color: '#3b82f6', avatar: undefined },
    { id: 'guest', name: 'Dr. Sarah Martinez', color: '#10b981', avatar: undefined }
  ]);

  // Transcription data for the TranscriptEditor (uses speaker IDs)
  const [transcriptionData, setTranscriptionData] = useState<TranscriptionSegment[]>([
    {
      id: '1',
      start: 0,
      end: 5.2,
      text: "Welcome to our podcast. Today we're discussing the future of artificial intelligence and its impact on society.",
      speaker: 'host',
      confidence: 0.98
    },
    {
      id: '2',
      start: 5.2,
      end: 12.8,
      text: "That's a fascinating topic. I think AI will transform how we work, learn, and even think about creativity.",
      speaker: 'guest',
      confidence: 0.94
    },
    {
      id: '3',
      start: 12.8,
      end: 18.5,
      text: "Absolutely. But we also need to consider the ethical implications and ensure that AI development is responsible.",
      speaker: 'host',
      confidence: 0.96
    },
    {
      id: '4',
      start: 18.5,
      end: 26.2,
      text: "I completely agree. We need frameworks and policies that guide AI development while still encouraging innovation.",
      speaker: 'guest',
      confidence: 0.92
    },
    {
      id: '5',
      start: 26.2,
      end: 34.8,
      text: "Exactly. And it's not just about the technology itself, but how it integrates into our social and economic systems.",
      speaker: 'host',
      confidence: 0.97
    }
  ]);

  const [transcriptSegments, setTranscriptSegments] = useState<TranscriptSegment[]>([
    {
      id: '1',
      start: 0,
      end: 5.2,
      text: "Welcome to our podcast. Today we're discussing the future of artificial intelligence and its impact on society.",
      speaker: speakers[0],
      confidence: 0.98,
      isEditable: true
    },
    {
      id: '2',
      start: 5.2,
      end: 12.8,
      text: "That's a fascinating topic. I think AI will transform how we work, learn, and even think about creativity.",
      speaker: speakers[1],
      confidence: 0.94,
      isEditable: true
    },
    {
      id: '3',
      start: 12.8,
      end: 18.5,
      text: "Absolutely. But we also need to consider the ethical implications and ensure that AI development is responsible.",
      speaker: speakers[0],
      confidence: 0.96,
      isEditable: true
    }
  ]);

  const [timelineTracks] = useState<TimelineTrack[]>([
    {
      id: 'audio-host',
      name: 'Alex Chen',
      type: 'audio',
      segments: [
        { id: 'seg-1', start: 0, end: 5.2, color: '#3b82f6', trackId: 'audio-host', gain: 1 },
        { id: 'seg-3', start: 12.8, end: 18.5, color: '#3b82f6', trackId: 'audio-host', gain: 1 }
      ],
      muted: false,
      volume: 1,
      solo: false
    },
    {
      id: 'audio-guest',
      name: 'Dr. Sarah Martinez',
      type: 'audio',
      segments: [
        { id: 'seg-2', start: 5.2, end: 12.8, color: '#10b981', trackId: 'audio-guest', gain: 1 }
      ],
      muted: false,
      volume: 1,
      solo: false
    },
    {
      id: 'music-bg',
      name: 'Background Music',
      type: 'music',
      segments: [
        { id: 'music-1', start: 0, end: 45, color: '#8b5cf6', trackId: 'music-bg', gain: 0.3 },
        { id: 'music-2', start: 135, end: 180, color: '#8b5cf6', trackId: 'music-bg', gain: 0.3 }
      ],
      muted: false,
      volume: 0.6,
      solo: false
    }
  ]);

  // TTS Settings
  const [ttsSettings, setTtsSettings] = useState<TTSSettings>({
    voiceModel: 'xtts-v2',
    pitch: 0,
    speed: 1,
    emotion: 'neutral'
  });

  // Export Settings
  const [exportSettings, setExportSettings] = useState<ExportSettings>({
    format: 'wav',
    quality: 'high',
    splitSpeakers: true,
    includeChapters: true,
    embedTranscript: true,
    transcriptFormat: 'srt'
  });

  // Macros State
  const [macros, setMacros] = useState({
    removeFiller: false,
    removeStutter: false,
    adjustPacing: false,
    adjustProsody: false
  });

  // Speaker Stats (computed)
  const speakerStats: SpeakerStats[] = speakers.map(speaker => {
    const segments = transcriptSegments.filter(seg => seg.speaker.id === speaker.id);
    const totalTime = segments.reduce((acc, seg) => acc + (seg.end - seg.start), 0);
    const avgConfidence = segments.reduce((acc, seg) => acc + seg.confidence, 0) / segments.length || 0;
    const wordCount = segments.reduce((acc, seg) => acc + seg.text.split(' ').length, 0);
    
    return {
      speakerId: speaker.id,
      totalTime,
      segmentCount: segments.length,
      averageConfidence: avgConfidence,
      wordsPerMinute: totalTime > 0 ? (wordCount / (totalTime / 60)) : 0
    };
  });
  // Debug logging
  console.log('App Debug - transcriptSegments:', transcriptSegments);
  console.log('App Debug - viewState:', viewState);
  console.log('App Debug - speakers:', speakers);

  // Playback timer simulation
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (playerState.isPlaying) {
      intervalRef.current = setInterval(() => {
        setPlayerState(prev => {
          const newTime = prev.currentTime + 0.1; // Update every 100ms
          return newTime >= prev.duration 
            ? { ...prev, currentTime: prev.duration, isPlaying: false }
            : { ...prev, currentTime: newTime };
        });
      }, 100);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [playerState.isPlaying]);
  // Event Handlers
  const handlePlay = useCallback(() => {
    setPlayerState(prev => ({ ...prev, isPlaying: true }));
  }, []);

  const handlePause = useCallback(() => {
    setPlayerState(prev => ({ ...prev, isPlaying: false }));
  }, []);

  const handleSeek = useCallback((time: number) => {
    setPlayerState(prev => ({ ...prev, currentTime: time }));
  }, []);

  const handleSpeakerFocus = useCallback((speakerId?: string) => {
    setPlayerState(prev => ({ ...prev, selectedSpeaker: speakerId }));
  }, []);

  const handleViewChange = useCallback((view: ViewState['activeView']) => {
    setViewState(prev => ({ ...prev, activeView: view }));
  }, []);

  const handleSegmentEdit = useCallback((segmentId: string, newText: string) => {
    // Add to undo stack
    const undoAction: UndoAction = {
      type: 'edit',
      timestamp: Date.now(),
      data: { originalText: transcriptSegments.find(s => s.id === segmentId)?.text },
      segmentId
    };
    
    setEditState(prev => ({
      ...prev,
      undoStack: {
        ...prev.undoStack,
        [segmentId]: [...(prev.undoStack[segmentId] || []), undoAction]
      }
    }));

    setTranscriptSegments(prev =>
      prev.map(seg => seg.id === segmentId ? { ...seg, text: newText } : seg)
    );
    setAutosaveStatus('pending');
  }, [transcriptSegments]);

  const handleSegmentRegenerate = useCallback((segmentId: string) => {
    const segment = transcriptSegments.find(s => s.id === segmentId);
    if (!segment) return;

    const regenLog: RegenerationLog = {
      segmentId,
      timestamp: Date.now(),
      originalText: segment.text,
      newText: `[TTS Generated] ${segment.text}`, // Mock regeneration
      ttsSettings,
      audioGenerated: true
    };

    setEditState(prev => ({
      ...prev,
      regenHistory: [...prev.regenHistory, regenLog]
    }));

    console.log('Regenerating TTS for segment:', segmentId);
  }, [transcriptSegments, ttsSettings]);

  const handleSpeakerAssign = useCallback((segmentId: string, speakerId: string) => {
    const speaker = speakers.find(s => s.id === speakerId);
    if (!speaker) return;

    setTranscriptSegments(prev =>
      prev.map(seg => seg.id === segmentId ? { ...seg, speaker } : seg)
    );
  }, [speakers]);

  const handleMacroToggle = useCallback((macro: keyof typeof macros) => {
    setMacros(prev => ({ ...prev, [macro]: !prev[macro] }));
  }, []);  const handleTTSChange = useCallback((settings: Partial<TTSSettings>) => {
    setTtsSettings(prev => ({ ...prev, ...settings }));
  }, []);

  const handleExportChange = useCallback((settings: Partial<ExportSettings>) => {
    setExportSettings(prev => ({ ...prev, ...settings }));
  }, []);

  const handleExport = useCallback(() => {
    console.log('Exporting with settings:', exportSettings);
    // Implementation would call backend API
  }, [exportSettings]);

  // Hotkeys
  useHotkeys('mod+p', (e) => {
    e.preventDefault();
    playerState.isPlaying ? handlePause() : handlePlay();
  });

  useHotkeys('mod+e', (e) => {
    e.preventDefault();
    handleExport();
  });

  useHotkeys('mod+r', (e) => {
    e.preventDefault();
    if (editState.selectedSegment) {
      handleSegmentRegenerate(editState.selectedSegment);
    }
  });

  useHotkeys('mod+shift+t', (e) => {
    e.preventDefault();
    handleViewChange(viewState.activeView === 'split' ? 'transcript' : 'split');
  });

  useHotkeys('mod+1', (e) => {
    e.preventDefault();
    handleViewChange('transcript');
  });

  useHotkeys('mod+2', (e) => {
    e.preventDefault();
    handleViewChange('timeline');
  });

  return (
    <div className="h-screen bg-zinc-950 text-neutral-100 flex flex-col overflow-hidden">
      {/* Top Bar - Fixed Height */}
      <TopBar
        projectName={projects.find(p => p.id === selectedProject)?.name || 'Untitled Project'}
        autosaveStatus={autosaveStatus}
        isDark={isDark}
        onToggleTheme={() => setIsDark(!isDark)}
        currentTime={playerState.currentTime}
        duration={playerState.duration}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">        {/* Center Workspace */}
        <div className="flex-1 flex overflow-hidden">
          {/* Main Content */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Video Player Section - Only shown in video view */}
            {viewState.activeView === 'video' && (
              <VideoPlayerSection
                playerState={playerState}
                speakers={speakers}
                transcriptOverlay={viewState.transcriptOverlay}
                onPlay={handlePlay}
                onPause={handlePause}
                onSeek={handleSeek}
                onSpeakerFocus={handleSpeakerFocus}
                onToggleOverlay={() => 
                  setViewState(prev => ({ ...prev, transcriptOverlay: !prev.transcriptOverlay }))
                }
              />
            )}

            {/* Content Panels */}
            <div className="flex-1 flex flex-col overflow-hidden">
              <AnimatePresence mode="wait">                {/* Full-page Transcript View */}
                {viewState.activeView === 'transcript' && (
                  <motion.div
                    key="transcript-fullpage"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.2 }}
                    className="flex-1 overflow-hidden"
                  >
                    <TranscriptEditor
                      transcription={transcriptionData}
                      speakers={speakers}
                      currentTime={playerState.currentTime}
                      isPlaying={playerState.isPlaying}
                      duration={playerState.duration}
                      volume={playerState.volume}
                      onSegmentEdit={handleSegmentEdit}
                      onSegmentRegenerate={handleSegmentRegenerate}
                      onSeek={handleSeek}
                      onPlay={handlePlay}
                      onPause={handlePause}
                    />
                  </motion.div>
                )}

                {/* Video View Content - Show some default content */}
                {viewState.activeView === 'video' && (
                  <motion.div
                    key="video-content"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex-1 flex items-center justify-center bg-zinc-1050"
                  >
                    
                  </motion.div>
                )}{viewState.activeView === 'timeline' && (
                  <motion.div
                    key="timeline"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.2 }}
                    className="flex-1 overflow-hidden"
                  >
                    <TimelinePanel
                      tracks={timelineTracks}
                      speakers={speakers}
                      currentTime={playerState.currentTime}
                      duration={playerState.duration}
                      selectedSpeaker={playerState.selectedSpeaker}
                      onSeek={handleSeek}
                      onTrackUpdate={(trackId: string, updates: any) => {
                        console.log('Track update:', trackId, updates);
                      }}
                      onSegmentMove={(segmentId: string, newStart: number) => {
                        console.log('Segment move:', segmentId, newStart);
                      }}
                    />
                  </motion.div>
                )}                {viewState.activeView === 'split' && (
                  <motion.div
                    key="split"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex-1 overflow-hidden"
                  >
                    <ResizableSplitView
                      leftComponent={
                        <CompactTranscriptEditor
                          transcription={transcriptionData}
                          speakers={speakers}
                          currentTime={playerState.currentTime}
                          isPlaying={playerState.isPlaying}
                          duration={playerState.duration}
                          onSegmentEdit={handleSegmentEdit}
                          onSegmentRegenerate={handleSegmentRegenerate}
                          onSeek={handleSeek}
                          onPlay={handlePlay}
                          onPause={handlePause}
                        />
                      }
                      rightComponent={
                        <CompactTimelinePanel
                          tracks={timelineTracks}
                          speakers={speakers}
                          currentTime={playerState.currentTime}
                          duration={playerState.duration}
                          selectedSpeaker={playerState.selectedSpeaker}
                          onSeek={handleSeek}
                          onTrackUpdate={(trackId: string, updates: any) => {
                            console.log('Track update:', trackId, updates);
                          }}
                          onSegmentMove={(segmentId: string, newStart: number) => {
                            console.log('Segment move:', segmentId, newStart);
                          }}
                        />
                      }
                      initialSplitRatio={viewState.splitRatio}
                      onSplitRatioChange={(ratio: number) => 
                        setViewState(prev => ({ ...prev, splitRatio: ratio }))
                      }
                      leftTitle="Transcript"
                      rightTitle="Timeline"
                      className="h-full"
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>            {/* View Toggle Controls */}
            <div className="border-t border-zinc-800 p-2 flex items-center justify-center gap-2">
              <button
                onClick={() => handleViewChange('video')}
                className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                  viewState.activeView === 'video'
                    ? 'bg-blue-600 text-white'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                }`}
              >
                Video
              </button>
              <button
                onClick={() => handleViewChange('transcript')}
                className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                  viewState.activeView === 'transcript'
                    ? 'bg-blue-600 text-white'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                }`}
              >
                Transcript
              </button>
              <button
                onClick={() => handleViewChange('timeline')}
                className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                  viewState.activeView === 'timeline'
                    ? 'bg-blue-600 text-white'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                }`}
              >
                Timeline
              </button>
              <button
                onClick={() => handleViewChange('split')}
                className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                  viewState.activeView === 'split'
                    ? 'bg-blue-600 text-white'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                }`}
              >
                Split View
              </button>
            </div>
          </div>

          {/* Right Sidebar */}          <RightSidebar
            speakers={speakers}
            speakerStats={speakerStats}
            ttsSettings={ttsSettings}
            exportSettings={exportSettings}
            macros={macros}
            onTTSChange={handleTTSChange}
            onExportChange={handleExportChange}
            onMacroToggle={handleMacroToggle}
            onExport={handleExport}
            onTTSPreview={(speakerId?: string) => {
              console.log('TTS Preview for speaker:', speakerId);
            }}
          />
        </div>
      </div>
    </div>
  );
}

export default App;
