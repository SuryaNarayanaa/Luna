import { useState, useRef, useEffect } from 'react';
import { RotateCcw, Edit3, Play, Pause, FastForward, Clock, Volume2, Trash2, Split, Users, User } from 'lucide-react';
import { Button } from './ui_/button';
import { cn } from '../lib/utils';
import type { TranscriptionSegment, Speaker } from '../types';

interface TranscriptEditorProps {
  transcription: TranscriptionSegment[];
  speakers: Speaker[];
  currentTime: number;
  isPlaying: boolean;
  duration: number;
  volume: number;
  onSegmentEdit: (segmentId: string, newText: string) => void;
  onSegmentRegenerate: (segmentId: string) => void;
  onSeek: (time: number) => void;
  onPlay: () => void;
  onPause: () => void;
  onSpeakerChange?: (segmentId: string, speakerId: string) => void;
  onDeleteSegment?: (segmentId: string) => void;
  onSplitSegment?: (segmentId: string, position: number) => void;
}

const getSpeakerColor = (speakerId: string, speakers: Speaker[]): string => {
  const speaker = speakers.find(s => s.id === speakerId);
  return speaker?.color || '#6366f1';
};

export function TranscriptEditor({
  transcription,
  speakers,
  currentTime,
  isPlaying = false,
  duration = 0,
  volume = 1,
  onSegmentEdit,
  onSegmentRegenerate,
  onSeek,
  onPlay = () => {},
  onPause = () => {},
  onSpeakerChange,
  onDeleteSegment,
  onSplitSegment
}: TranscriptEditorProps) {
  const [editingSegment, setEditingSegment] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to current segment
  useEffect(() => {
    const currentSegment = transcription.find(
      seg => currentTime >= seg.start && currentTime <= seg.end
    );
    
    if (currentSegment && containerRef.current) {
      const segmentElement = containerRef.current.querySelector(
        `[data-segment-id="${currentSegment.id}"]`
      );
      if (segmentElement) {
        segmentElement.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'nearest' 
        });
      }
    }
  }, [currentTime, transcription]);

  const handleEditStart = (segment: TranscriptionSegment) => {
    setEditingSegment(segment.id);
    setEditText(segment.text);
  };

  const handleEditSave = (segmentId: string) => {
    if (editText.trim()) {
      onSegmentEdit(segmentId, editText.trim());
    }
    setEditingSegment(null);
    setEditText('');
  };

  const handleEditCancel = () => {
    setEditingSegment(null);
    setEditText('');
  };
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getCurrentSegment = () => {
    return transcription.find(seg => 
      currentTime >= seg.start && currentTime <= seg.end
    );
  };

  return (
    <div className="h-full flex flex-col bg-zinc-900">
      {/* Editor Header with Controls */}
      <div className="flex-shrink-0 bg-zinc-800 border-b border-zinc-700 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h2 className="text-lg font-semibold text-white">Transcript Editor</h2>
            <div className="flex items-center space-x-2 text-sm text-zinc-400">
              <Clock className="w-4 h-4" />
              <span>{formatTime(currentTime)} / {formatTime(duration)}</span>
            </div>
          </div>
          
          {/* Mini Transport Controls */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => onSeek(Math.max(0, currentTime - 10))}
              className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-700 rounded-lg transition-colors"
              title="Rewind 10s"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            
            <button
              onClick={isPlaying ? onPause : onPlay}
              className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
            </button>
            
            <button
              onClick={() => onSeek(Math.min(duration, currentTime + 10))}
              className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-700 rounded-lg transition-colors"
              title="Forward 10s"
            >
              <FastForward className="w-4 h-4" />
            </button>
            
            <div className="h-6 w-px bg-zinc-600 mx-2" />
            
            <div className="flex items-center space-x-1">
              <Volume2 className="w-4 h-4 text-zinc-400" />
              <span className="text-sm text-zinc-400">{Math.round(volume * 100)}%</span>
            </div>
          </div>        </div>
      </div>

      

      {/* Transcript Content */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-y-auto p-6 space-y-4"
      >
        {transcription.map((segment) => {
          const speakerColor = getSpeakerColor(segment.speaker, speakers);
          const speaker = speakers.find(s => s.id === segment.speaker);
          const isActive = currentTime >= segment.start && currentTime <= segment.end;
          const isEditing = editingSegment === segment.id;

          return (
            <div
              key={segment.id}
              data-segment-id={segment.id}
              className={cn(
                "speaker-block p-4",
                isActive && "ring-2 ring-blue-500 ring-opacity-50"
              )}
              style={{
                borderLeftColor: speakerColor,
                borderLeftWidth: '4px',
              }}
            >
              {/* Speaker Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: speakerColor }}
                  />
                  <span className="text-sm font-medium text-white">
                    {speaker?.name || `Speaker ${segment.speaker}`}
                  </span>
                  <button
                    onClick={() => onSeek(segment.start)}
                    className="text-xs text-neutral-400 hover:text-white transition-colors font-mono"
                  >
                    {formatTime(segment.start)}
                  </button>
                </div>
                
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEditStart(segment)}
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Edit3 className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onSegmentRegenerate(segment.id)}
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <RotateCcw className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              {/* Transcript Text */}
              {isEditing ? (
                <div className="space-y-2">
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    className="w-full min-h-[60px] bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-white resize-y focus:outline-none focus:border-blue-500"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleEditSave(segment.id)}
                    >
                      Save
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleEditCancel}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <p 
                  className="transcript-line cursor-pointer group"
                  onClick={() => handleEditStart(segment)}
                >
                  {segment.text}
                </p>
              )}

              {/* Confidence Score */}
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs text-neutral-400">
                  Confidence: {Math.round(segment.confidence * 100)}%
                </span>
        
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
}
