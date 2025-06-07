import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Edit3, 
  RotateCcw, 
  Clock,
  Users,
  Check,
  X
} from 'lucide-react';
import type { TranscriptSegment, Speaker } from '../types';

interface TranscriptPanelProps {
  segments: TranscriptSegment[];
  speakers: Speaker[];
  currentTime: number;
  selectedSegment?: string;
  selectedSpeaker?: string;
  macros: {
    removeFiller: boolean;
    removeStutter: boolean;
    adjustPacing: boolean;
    adjustProsody: boolean;
  };
  onSegmentEdit: (segmentId: string, newText: string) => void;
  onSegmentRegenerate: (segmentId: string) => void;
  onSpeakerAssign: (segmentId: string, speakerId: string) => void;
  onSegmentSelect: (segmentId: string) => void;
  onSeek: (time: number) => void;
  onMacroToggle: (macro: 'removeFiller' | 'removeStutter' | 'adjustPacing' | 'adjustProsody') => void;
}

export function TranscriptPanel({
  segments,
  speakers,
  currentTime,
  selectedSegment,
  selectedSpeaker,
  macros,
  onSegmentEdit,
  onSegmentRegenerate,
  onSpeakerAssign,
  onSegmentSelect,
  onSeek,
  onMacroToggle
}: TranscriptPanelProps) {
  const [editingSegment, setEditingSegment] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const editInputRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to current segment
  useEffect(() => {
    const currentSegment = segments.find(
      seg => currentTime >= seg.start && currentTime <= seg.end
    );
    if (currentSegment && containerRef.current) {
      const segmentElement = document.getElementById(`segment-${currentSegment.id}`);
      if (segmentElement) {
        segmentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [currentTime, segments]);

  const handleEditStart = (segment: TranscriptSegment) => {
    setEditingSegment(segment.id);
    setEditText(segment.text);
    onSegmentSelect(segment.id);
    setTimeout(() => editInputRef.current?.focus(), 0);
  };

  const handleEditSave = () => {
    if (editingSegment) {
      onSegmentEdit(editingSegment, editText);
      setEditingSegment(null);
      setEditText('');
    }
  };

  const handleEditCancel = () => {
    setEditingSegment(null);
    setEditText('');
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;  };

  const getSegmentDuration = (segment: TranscriptSegment) => {
    return segment.end - segment.start;
  };

  const macrosList = [
    { key: 'removeFiller' as const, label: 'Remove Filler', icon: '🗣️' },
    { key: 'removeStutter' as const, label: 'Remove Stutter', icon: '🔄' },
    { key: 'adjustPacing' as const, label: 'Adjust Pacing', icon: '⏱️' },
    { key: 'adjustProsody' as const, label: 'Adjust Prosody', icon: '🎵' }
  ];
  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-zinc-950">
      {/* Debug Info */}
      <div className="bg-red-900 text-white p-2 text-xs">
        DEBUG: {segments.length} segments received
      </div>
      
      {/* Header with Macro Controls */}
      <div className="border-b border-zinc-800 p-4 bg-zinc-900/50">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-white">Transcript Editor</h2>
          <div className="flex items-center space-x-2 text-sm text-zinc-400">
            <Users className="w-4 h-4" />
            <span>{segments.length} segments</span>
            <span>•</span>
            <Clock className="w-4 h-4" />
            <span>{formatTime(segments[segments.length - 1]?.end || 0)}</span>
          </div>
        </div>

        {/* Global Macro Controls */}
        <div className="flex flex-wrap gap-2">
          {macrosList.map((macro) => (
            <button
              key={macro.key}
              onClick={() => onMacroToggle(macro.key)}
              className={`px-3 py-1.5 text-xs rounded-lg border transition-all ${
                macros[macro.key]
                  ? 'bg-blue-600 border-blue-500 text-white'
                  : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700'
              }`}
            >
              <span className="mr-1">{macro.icon}</span>
              {macro.label}
            </button>
          ))}
        </div>
      </div>

      {/* Transcript Content */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4"
      >
        <AnimatePresence>
          {segments
            .filter(segment => !selectedSpeaker || segment.speaker.id === selectedSpeaker)
            .map((segment, index) => {
              const isCurrentSegment = currentTime >= segment.start && currentTime <= segment.end;
              const isSelected = selectedSegment === segment.id;
              const isEditing = editingSegment === segment.id;
              const duration = getSegmentDuration(segment);

              return (
                <motion.div
                  key={segment.id}
                  id={`segment-${segment.id}`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ delay: index * 0.05 }}
                  className={`border rounded-lg p-4 transition-all ${
                    isCurrentSegment 
                      ? 'border-blue-500 bg-blue-500/5' 
                      : isSelected
                      ? 'border-zinc-600 bg-zinc-800/50'
                      : 'border-zinc-800 bg-zinc-900/30 hover:bg-zinc-800/50'
                  }`}
                  onClick={() => onSegmentSelect(segment.id)}
                >
                  {/* Segment Header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      {/* Speaker Avatar & Name */}
                      <div className="flex items-center space-x-2">
                        <div 
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium"
                          style={{ backgroundColor: segment.speaker.color }}
                        >
                          {segment.speaker.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-white">
                            {segment.speaker.name}
                          </div>
                          <div className="text-xs text-zinc-500">
                            {formatTime(segment.start)} - {formatTime(segment.end)} 
                            <span className="ml-1">({duration.toFixed(1)}s)</span>
                          </div>
                        </div>
                      </div>

                      {/* Confidence Badge */}
                      <div className={`px-2 py-1 rounded text-xs ${
                        segment.confidence >= 0.95 
                          ? 'bg-green-500/20 text-green-400' 
                          : segment.confidence >= 0.85
                          ? 'bg-yellow-500/20 text-yellow-400'
                          : 'bg-red-500/20 text-red-400'
                      }`}>
                        {(segment.confidence * 100).toFixed(0)}%
                      </div>
                    </div>

                    {/* Segment Actions */}
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSeek(segment.start);
                        }}
                        className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-700 rounded transition-colors"
                        title="Jump to timestamp"
                      >
                        <Clock className="w-4 h-4" />
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditStart(segment);
                        }}
                        className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-700 rounded transition-colors"
                        title="Edit text"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSegmentRegenerate(segment.id);
                        }}
                        className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-700 rounded transition-colors"
                        title="Regenerate with TTS"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>

                      {/* Speaker Reassignment */}
                      <select
                        value={segment.speaker.id}
                        onChange={(e) => {
                          e.stopPropagation();
                          onSpeakerAssign(segment.id, e.target.value);
                        }}
                        className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-300"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {speakers.map((speaker) => (
                          <option key={speaker.id} value={speaker.id}>
                            {speaker.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Segment Content */}
                  <div className="ml-11">
                    {isEditing ? (
                      <div className="space-y-3">
                        <textarea
                          ref={editInputRef}
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          className="w-full bg-zinc-800 border border-zinc-600 rounded-lg p-3 text-white resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          rows={3}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && e.ctrlKey) {
                              handleEditSave();
                            } else if (e.key === 'Escape') {
                              handleEditCancel();
                            }
                          }}
                        />
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={handleEditSave}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors flex items-center space-x-1"
                          >
                            <Check className="w-3 h-3" />
                            <span>Save</span>
                          </button>
                          <button
                            onClick={handleEditCancel}
                            className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-white text-sm rounded-lg transition-colors flex items-center space-x-1"
                          >
                            <X className="w-3 h-3" />
                            <span>Cancel</span>
                          </button>
                          <div className="text-xs text-zinc-500">
                            Ctrl+Enter to save, Esc to cancel
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <p className="text-zinc-200 leading-relaxed">
                          {segment.text}
                        </p>
                        
                        {/* Applied Macros */}
                        {(macros.removeFiller || macros.removeStutter || macros.adjustPacing || macros.adjustProsody) && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {macros.removeFiller && (
                              <span className="px-2 py-0.5 bg-blue-500/20 text-blue-300 text-xs rounded">
                                Filler Removed
                              </span>
                            )}
                            {macros.removeStutter && (
                              <span className="px-2 py-0.5 bg-green-500/20 text-green-300 text-xs rounded">
                                Stutter Removed
                              </span>
                            )}
                            {macros.adjustPacing && (
                              <span className="px-2 py-0.5 bg-purple-500/20 text-purple-300 text-xs rounded">
                                Pacing Adjusted
                              </span>
                            )}
                            {macros.adjustProsody && (
                              <span className="px-2 py-0.5 bg-orange-500/20 text-orange-300 text-xs rounded">
                                Prosody Adjusted
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Current Time Indicator */}
                  {isCurrentSegment && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="absolute right-2 top-2"
                    >
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                    </motion.div>
                  )}
                </motion.div>
              );
            })}
        </AnimatePresence>

        {/* Empty State */}
        {segments.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Users className="w-12 h-12 text-zinc-600 mb-4" />
            <h3 className="text-lg font-medium text-zinc-400 mb-2">No transcript available</h3>
            <p className="text-zinc-500 text-sm">
              Upload an audio or video file to generate a transcript with speaker diarization.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
