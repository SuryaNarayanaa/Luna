import { 
  Download, 
  Mic, 
  Volume2, 
  User, 
  BarChart3,
  AudioWaveform,
  FileText,
  Headphones,
  Sliders
} from 'lucide-react';
import { Button } from './ui_/button';
import { Slider } from './ui_/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui_/select';
import { cn } from '../lib/utils';
import type { Speaker, SpeakerStats, TTSSettings, ExportSettings } from '../types';

interface RightSidebarProps {
  speakers: Speaker[];
  speakerStats: SpeakerStats[];
  ttsSettings: TTSSettings;
  exportSettings: ExportSettings;
  macros: {
    removeFiller: boolean;
    removeStutter: boolean;
    adjustPacing: boolean;
    adjustProsody: boolean;
  };
  onTTSChange: (settings: Partial<TTSSettings>) => void;
  onExportChange: (settings: Partial<ExportSettings>) => void;
  onMacroToggle: (macro: keyof RightSidebarProps['macros']) => void;
  onExport: () => void;
  onTTSPreview: (speakerId?: string) => void;
}

const macroOptions = [
  { 
    key: 'removeFiller' as const, 
    label: 'Remove Filler Words', 
    description: 'uh, um, like, you know',
    icon: Mic
  },  { 
    key: 'removeStutter' as const, 
    label: 'Remove Stutters', 
    description: 'repeated words/sounds',
    icon: AudioWaveform
  },
  { 
    key: 'adjustPacing' as const, 
    label: 'Adjust Pacing', 
    description: 'optimize speech timing',
    icon: BarChart3
  },
  { 
    key: 'adjustProsody' as const, 
    label: 'Adjust Prosody', 
    description: 'intonation & rhythm',
    icon: Volume2
  },
];

const voiceModels = [
  { id: 'xtts-v2', name: 'XTTS v2 (High Quality)', type: 'neural' },
  { id: 'neural-voice-1', name: 'Neural Voice 1', type: 'neural' },
  { id: 'neural-voice-2', name: 'Neural Voice 2', type: 'neural' },
  { id: 'custom-voice-1', name: 'Custom Model', type: 'custom' }
];

const emotions = [
  { id: 'neutral', name: 'Neutral', description: 'Natural speaking tone' },
  { id: 'happy', name: 'Happy', description: 'Upbeat and cheerful' },
  { id: 'professional', name: 'Professional', description: 'Formal and clear' },
  { id: 'conversational', name: 'Conversational', description: 'Casual and friendly' },
  { id: 'dramatic', name: 'Dramatic', description: 'Expressive and engaging' }
];

const exportFormats = [
  { id: 'wav', name: 'WAV', description: 'Uncompressed audio' },
  { id: 'mp3', name: 'MP3', description: 'Compressed audio' },
  { id: 'flac', name: 'FLAC', description: 'Lossless compression' }
];

const qualitySettings = [
  { id: 'low', name: 'Low (128kbps)', size: 'Smaller file' },
  { id: 'medium', name: 'Medium (256kbps)', size: 'Balanced' },
  { id: 'high', name: 'High (320kbps)', size: 'Larger file' },
  { id: 'lossless', name: 'Lossless', size: 'Highest quality' }
];

export function RightSidebar({
  speakers,
  speakerStats,
  ttsSettings,
  exportSettings,
  macros,
  onTTSChange,
  onExportChange,
  onMacroToggle,
  onExport,
  onTTSPreview,
}: RightSidebarProps) {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatConfidence = (confidence: number) => {
    return `${Math.round(confidence * 100)}%`;
  };

  return (
    <div className="w-80 bg-zinc-950 border-l border-zinc-800 flex flex-col overflow-y-auto">
      {/* Speaker Statistics */}
      <div className="p-4 border-b border-zinc-800">
        <div className="flex items-center gap-2 mb-3">
          <User className="h-4 w-4 text-blue-400" />
          <h3 className="text-sm font-medium text-white">Speaker Statistics</h3>
        </div>
        <div className="space-y-3">
          {speakers.map((speaker) => {
            const stats = speakerStats.find(s => s.speakerId === speaker.id);
            if (!stats) return null;
            
            return (
              <div key={speaker.id} className="p-3 bg-zinc-900 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: speaker.color }}
                  />
                  <span className="text-sm font-medium text-white truncate">
                    {speaker.name}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-neutral-400">
                  <div>
                    <div className="text-neutral-300">{formatTime(stats.totalTime)}</div>
                    <div>Speaking time</div>
                  </div>
                  <div>
                    <div className="text-neutral-300">{stats.segmentCount}</div>
                    <div>Segments</div>
                  </div>
                  <div>
                    <div className="text-neutral-300">{formatConfidence(stats.averageConfidence)}</div>
                    <div>Confidence</div>
                  </div>
                  <div>
                    <div className="text-neutral-300">{Math.round(stats.wordsPerMinute)}</div>
                    <div>WPM</div>
                  </div>
                </div>
                <Button
                  onClick={() => onTTSPreview(speaker.id)}
                  className="w-full mt-2"
                  variant="outline"
                  size="sm"
                >
                  <Headphones className="h-3 w-3 mr-1" />
                  Preview Voice
                </Button>
              </div>
            );
          })}
        </div>
      </div>

      {/* TTS Controls */}
      <div className="p-4 border-b border-zinc-800">
        <div className="flex items-center gap-2 mb-3">
          <Mic className="h-4 w-4 text-green-400" />
          <h3 className="text-sm font-medium text-white">TTS Controls</h3>
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-medium text-neutral-400">Voice Model</label>
            <Select 
              value={ttsSettings.voiceModel} 
              onValueChange={(value) => onTTSChange({ voiceModel: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {voiceModels.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    <div className="flex flex-col">
                      <span>{model.name}</span>
                      <span className="text-xs text-neutral-500">{model.type}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-neutral-400">
              Pitch Adjustment: {ttsSettings.pitch > 0 ? '+' : ''}{ttsSettings.pitch.toFixed(1)}
            </label>
            <Slider
              value={[ttsSettings.pitch]}
              min={-1.0}
              max={1.0}
              step={0.1}
              onValueChange={(value) => onTTSChange({ pitch: value[0] })}
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-neutral-400">
              Speed: {ttsSettings.speed.toFixed(1)}x
            </label>
            <Slider
              value={[ttsSettings.speed]}
              min={0.5}
              max={2.0}
              step={0.1}
              onValueChange={(value) => onTTSChange({ speed: value[0] })}
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-neutral-400">Emotion & Style</label>
            <Select 
              value={ttsSettings.emotion} 
              onValueChange={(value) => onTTSChange({ emotion: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {emotions.map((emotion) => (
                  <SelectItem key={emotion.id} value={emotion.id}>
                    <div className="flex flex-col">
                      <span>{emotion.name}</span>
                      <span className="text-xs text-neutral-500">{emotion.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Editing Macros */}
      <div className="p-4 border-b border-zinc-800">
        <div className="flex items-center gap-2 mb-3">
          <Sliders className="h-4 w-4 text-purple-400" />
          <h3 className="text-sm font-medium text-white">Editing Macros</h3>
        </div>
        <div className="space-y-3">
          {macroOptions.map((macro) => {
            const IconComponent = macro.icon;
            return (
              <div key={macro.key} className="space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <IconComponent className="h-3 w-3 text-neutral-400" />
                    <label className="text-sm text-neutral-200">{macro.label}</label>
                  </div>
                  <button
                    onClick={() => onMacroToggle(macro.key)}
                    className={cn(
                      "w-10 h-5 rounded-full transition-colors relative",
                      macros[macro.key] ? "bg-purple-600" : "bg-zinc-700"
                    )}
                  >
                    <div
                      className={cn(
                        "w-4 h-4 bg-white rounded-full transition-transform absolute top-0.5",
                        macros[macro.key] ? "translate-x-5" : "translate-x-0.5"
                      )}
                    />
                  </button>
                </div>
                <p className="text-xs text-neutral-400 ml-5">{macro.description}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Export Settings */}
      <div className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Download className="h-4 w-4 text-orange-400" />
          <h3 className="text-sm font-medium text-white">Export Settings</h3>
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-medium text-neutral-400">Audio Format</label>
            <Select 
              value={exportSettings.format} 
              onValueChange={(value: any) => onExportChange({ format: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {exportFormats.map((format) => (
                  <SelectItem key={format.id} value={format.id}>
                    <div className="flex flex-col">
                      <span>{format.name}</span>
                      <span className="text-xs text-neutral-500">{format.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-neutral-400">Quality</label>
            <Select 
              value={exportSettings.quality} 
              onValueChange={(value: any) => onExportChange({ quality: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {qualitySettings.map((quality) => (
                  <SelectItem key={quality.id} value={quality.id}>
                    <div className="flex flex-col">
                      <span>{quality.name}</span>
                      <span className="text-xs text-neutral-500">{quality.size}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="my-3 border-t border-zinc-800" />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User className="h-3 w-3 text-neutral-400" />
                <label className="text-sm text-neutral-200">Split by Speaker</label>
              </div>
              <button
                onClick={() => onExportChange({ splitSpeakers: !exportSettings.splitSpeakers })}
                className={cn(
                  "w-10 h-5 rounded-full transition-colors relative",
                  exportSettings.splitSpeakers ? "bg-orange-600" : "bg-zinc-700"
                )}
              >
                <div
                  className={cn(
                    "w-4 h-4 bg-white rounded-full transition-transform absolute top-0.5",
                    exportSettings.splitSpeakers ? "translate-x-5" : "translate-x-0.5"
                  )}
                />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-3 w-3 text-neutral-400" />
                <label className="text-sm text-neutral-200">Chapter Markers</label>
              </div>
              <button
                onClick={() => onExportChange({ includeChapters: !exportSettings.includeChapters })}
                className={cn(
                  "w-10 h-5 rounded-full transition-colors relative",
                  exportSettings.includeChapters ? "bg-orange-600" : "bg-zinc-700"
                )}
              >
                <div
                  className={cn(
                    "w-4 h-4 bg-white rounded-full transition-transform absolute top-0.5",
                    exportSettings.includeChapters ? "translate-x-5" : "translate-x-0.5"
                  )}
                />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-3 w-3 text-neutral-400" />
                <label className="text-sm text-neutral-200">Embed Transcript</label>
              </div>
              <button
                onClick={() => onExportChange({ embedTranscript: !exportSettings.embedTranscript })}
                className={cn(
                  "w-10 h-5 rounded-full transition-colors relative",
                  exportSettings.embedTranscript ? "bg-orange-600" : "bg-zinc-700"
                )}
              >
                <div
                  className={cn(
                    "w-4 h-4 bg-white rounded-full transition-transform absolute top-0.5",
                    exportSettings.embedTranscript ? "translate-x-5" : "translate-x-0.5"
                  )}
                />
              </button>
            </div>
          </div>

          <Button
            onClick={onExport}
            className="w-full mt-6 bg-orange-600 hover:bg-orange-700"
            size="sm"
          >
            <Download className="h-3 w-3 mr-2" />
            Export Audio
          </Button>
        </div>
      </div>
    </div>
  );
}
