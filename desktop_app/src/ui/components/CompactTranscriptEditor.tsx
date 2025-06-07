import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Play, 
  Pause, 
  Edit3,
  Users,
  User,
  Clock,
  Volume2,
  RotateCcw,
  Trash2
} from 'lucide-react';
import { Button } from './ui_/button';
import { cn } from '../lib/utils';
import type { TranscriptionSegment, Speaker } from '../types';

interface CompactTranscriptEditorProps {
  transcription: TranscriptionSegment[];
  speakers: Speaker[];
  currentTime: number;
  isPlaying: boolean;
  duration: number;
  onSegmentEdit: (segmentId: string, newText: string) => void;
  onSegmentRegenerate: (segmentId: string) => void;
  onSeek: (time: number) => void;
  onPlay: () => void;
  onPause: () => void;
}

export function CompactTranscriptEditor({
  transcription,
  speakers,
  currentTime,
  isPlaying,
  duration,
  onSegmentEdit,
  onSegmentRegenerate,
  onSeek,
  onPlay,
  onPause
}: CompactTranscriptEditorProps) {
  const [editingSegment, setEditingSegment] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const activeSegmentRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to current segment
  useEffect(() => {
    if (activeSegmentRef.current && containerRef.current) {
      const container = containerRef.current;
      const element = activeSegmentRef.current;
      
      const containerRect = container.getBoundingClientRect();
      const elementRect = element.getBoundingClientRect();
      
      const isVisible = (
        elementRect.top >= containerRect.top &&
        elementRect.bottom <= containerRect.bottom
      );
      
      if (!isVisible) {
        element.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'nearest'
        });
      }
    }
  }, [currentTime]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getSpeakerColor = (speakerId: string): string => {
    const speaker = speakers.find(s => s.id === speakerId);
    return speaker?.color || '#6b7280';
  };

  const getSpeakerName = (speakerId: string): string => {
    const speaker = speakers.find(s => s.id === speakerId);
    return speaker?.name || `Speaker ${speakerId}`;
  };

  const getCurrentSegment = () => {
    return transcription.find(segment => 
      currentTime >= segment.start && currentTime <= segment.end
    );
  };

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

  const currentSegment = getCurrentSegment();

  return (
    <div className="h-full flex flex-col bg-zinc-900">
      {/* Compact Header with Mini Controls */}
      <div className="flex-shrink-0 bg-zinc-800 border-b border-zinc-700 px-3 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-xs text-zinc-400">
            <Clock className="w-3 h-3" />
            <span>{formatTime(currentTime)}</span>
          </div>
          
          <div className="flex items-center space-x-1">
            <button
              onClick={isPlaying ? onPause : onPlay}
              className="p-1 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
            >
              {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3 ml-0.5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Transcript Content - Compact */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-y-auto px-3 py-2 space-y-2"
      >
        {transcription.map((segment) => {
          const isActive = currentSegment?.id === segment.id;
          const isEditing = editingSegment === segment.id;
          const speakerColor = getSpeakerColor(segment.speaker);
          const speakerName = getSpeakerName(segment.speaker);
          
          return (
            <motion.div
              key={segment.id}
              ref={isActive ? activeSegmentRef : undefined}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`group relative bg-zinc-800 rounded border transition-all duration-200 ${
                isActive 
                  ? 'border-blue-500 ring-1 ring-blue-500/30 shadow-md' 
                  : 'border-zinc-700 hover:border-zinc-600'
              }`}
            >
              {/* Compact Segment Header */}
              <div className="flex items-center justify-between p-2 border-b border-zinc-700">
                <div className="flex items-center space-x-2">
                  <div 
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: speakerColor }}
                  />
                  <span className="text-xs font-medium text-white truncate max-w-20">
                    {speakerName}
                  </span>
                  <button
                    onClick={() => onSeek(segment.start)}
                    className="text-xs text-zinc-400 hover:text-white transition-colors font-mono"
                  >
                    {formatTime(segment.start)}
                  </button>
                </div>
                
                <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEditStart(segment)}
                    className="h-5 w-5"
                  >
                    <Edit3 className="h-2.5 w-2.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onSegmentRegenerate(segment.id)}
                    className="h-5 w-5"
                  >
                    <RotateCcw className="h-2.5 w-2.5" />
                  </Button>
                </div>
              </div>
              
              {/* Compact Text Content */}
              <div className="p-2">
                {isEditing ? (
                  <div className="space-y-2">
                    <textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      className="w-full min-h-[40px] bg-zinc-700 border border-zinc-600 rounded px-2 py-1 text-xs text-white resize-y focus:outline-none focus:border-blue-500"
                      autoFocus
                      rows={2}
                    />
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        onClick={() => handleEditSave(segment.id)}
                        className="h-6 text-xs px-2"
                      >
                        Save
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleEditCancel}
                        className="h-6 text-xs px-2"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p 
                    className="text-sm text-white leading-relaxed cursor-pointer hover:bg-zinc-700/50 rounded p-1 -m-1 transition-colors"
                    onClick={() => handleEditStart(segment)}
                  >
                    {segment.text}
                  </p>
                )}
              </div>
              
              {/* Compact Confidence Score */}
              {segment.confidence !== undefined && (
                <div className="px-2 pb-2">
                  <div className="flex items-center space-x-1 text-xs text-zinc-500">
                    <span>Conf:</span>
                    <div className="flex-1 bg-zinc-700 rounded-full h-1">
                      <div 
                        className={`h-full rounded-full ${
                          segment.confidence > 0.8 ? 'bg-green-500' :
                          segment.confidence > 0.6 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${segment.confidence * 100}%` }}
                      />
                    </div>
                    <span className="w-8 text-right">{Math.round(segment.confidence * 100)}%</span>
                  </div>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
      
      {/* Compact Progress Bar */}
      <div className="flex-shrink-0 bg-zinc-800 border-t border-zinc-700 p-2">
        <div className="w-full bg-zinc-700 rounded-full h-1 relative">
          <div 
            className="bg-blue-500 h-full rounded-full transition-all duration-100"
            style={{ width: `${(currentTime / duration) * 100}%` }}
          />
          {/* Speaker segments on progress bar */}
          {transcription.map((segment) => {
            const startPercent = (segment.start / duration) * 100;
            const widthPercent = ((segment.end - segment.start) / duration) * 100;
            const speakerColor = getSpeakerColor(segment.speaker);
            
            return (
              <div
                key={segment.id}
                className="absolute top-0 h-full opacity-40 cursor-pointer hover:opacity-70 transition-opacity rounded-full"
                style={{
                  left: `${startPercent}%`,
                  width: `${widthPercent}%`,
                  backgroundColor: speakerColor,
                }}
                onClick={() => onSeek(segment.start)}
                title={`${getSpeakerName(segment.speaker)} - ${formatTime(segment.start)}`}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
