export interface TranscriptionSegment {
  id: string;
  start: number;
  end: number;
  text: string;
  speaker: string;
  confidence: number;
}

// Enhanced type for transcript segments with editing capabilities
export interface TranscriptSegment {
  id: string;
  start: number;
  end: number;
  text: string;
  speaker: Speaker;
  confidence: number;
  isEditable: boolean;
}

export interface Speaker {
  id: string;
  name: string;
  color: string;
  avatar?: string;
}

export interface AudioTrack {
  id: string;
  name: string;
  segments: AudioSegment[];
  muted: boolean;
  volume: number;
  solo: boolean;
}

export interface AudioSegment {
  id: string;
  start: number;
  end: number;
  trackId: string;
  speaker?: string;
  gain: number;
}

export interface Project {
  id: string;
  name: string;
  transcription: TranscriptionSegment[];
  speakers: Speaker[];
  tracks: AudioTrack[];
  duration: number;
  settings: ProjectSettings;
}

export interface ProjectSettings {
  exportFormat: 'wav' | 'mp3' | 'flac';
  sampleRate: number;
  speakerSplit: boolean;
  chapterMarkers: boolean;
  macros: {
    removeFiller: boolean;
    removeStutter: boolean;
    adjustPacing: boolean;
    adjustProsody: boolean;
  };
}

export interface TTSSettings {
  voiceModel: string;
  pitch: number;
  speed: number;
  emotion: string;
}

export interface WaveformData {
  peaks: Float32Array;
  duration: number;
  sampleRate: number;
}

// Timeline track types
export interface TimelineTrack {
  id: string;
  name: string;
  type: 'audio' | 'music' | 'sfx';
  segments: TimelineSegment[];
  muted: boolean;
  volume: number;
  solo: boolean;
}

export interface TimelineSegment {
  id: string;
  start: number;
  end: number;
  color: string;
  trackId: string;
  gain: number;
}

// Enhanced UI State Types
export interface ViewState {
  activeView: 'video' | 'transcript' | 'timeline' | 'split';
  splitRatio: number;
  transcriptOverlay: boolean;
  dockableLayout: Record<string, { position: string; size: number }>;
}

export interface PlayerState {
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  volume: number;
  playbackRate: number;
  loop: boolean;
  transcriptSync: boolean;
  selectedSpeaker?: string;
}

export interface EditState {
  selectedSegment?: string;
  undoStack: Record<string, UndoAction[]>;
  regenHistory: RegenerationLog[];
  macroQueue: MacroOperation[];
}

export interface UndoAction {
  type: 'edit' | 'split' | 'merge' | 'speaker_assign' | 'delete';
  timestamp: number;
  data: any;
  segmentId: string;
}

export interface RegenerationLog {
  segmentId: string;
  timestamp: number;
  originalText: string;
  newText: string;
  ttsSettings: TTSSettings;
  audioGenerated: boolean;
}

export interface MacroOperation {
  type: 'remove_filler' | 'remove_stutter' | 'adjust_pacing' | 'adjust_prosody';
  segmentId: string;
  applied: boolean;
  settings: Record<string, any>;
}

export interface ExportSettings {
  format: 'wav' | 'mp3' | 'flac';
  quality: 'low' | 'medium' | 'high' | 'lossless';
  splitSpeakers: boolean;
  includeChapters: boolean;
  embedTranscript: boolean;
  transcriptFormat: 'json' | 'srt' | 'vtt';
}

export interface SpeakerStats {
  speakerId: string;
  totalTime: number;
  segmentCount: number;
  averageConfidence: number;
  wordsPerMinute: number;
}
