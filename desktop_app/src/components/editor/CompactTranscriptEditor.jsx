// Compact version of TranscriptEditor for split view
import React, { useState } from 'react';
import { Play, Edit, RotateCcw } from 'lucide-react';
import { Button } from '../ui/Button';

export default function CompactTranscriptEditor({
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
}) {
  const [editingSegment, setEditingSegment] = useState(null);
  const [editText, setEditText] = useState('');

  const handleEditStart = (segment) => {
    setEditingSegment(segment.id);
    setEditText(segment.text);
  };

  const handleEditSave = () => {
    if (editingSegment) {
      onSegmentEdit(editingSegment, editText);
      setEditingSegment(null);
      setEditText('');
    }
  };

  const getSpeaker = (speakerId) => {
    return speakers.find(s => s.id === speakerId);
  };

  return (
    <div className="flex-1 flex flex-col bg-zinc-900 h-full">


      {/* Compact Transcript Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {transcription.map((segment) => {
          const speaker = getSpeaker(segment.speaker);
          const isActive = currentTime >= segment.start && currentTime <= segment.end;
          const isEditing = editingSegment === segment.id;

          return (
            <div
              key={segment.id}
              className={`p-2 rounded border text-sm transition-all ${
                isActive 
                  ? 'border-blue-500 bg-blue-500 bg-opacity-10' 
                  : 'border-zinc-700 bg-zinc-800'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1">
                  {speaker && (
                    <div 
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: speaker.color }}
                    />
                  )}
                  <span className="text-xs text-white font-medium">
                    {speaker?.name || 'Unknown'}
                  </span>
                  <span className="text-xs text-neutral-500">
                    {Math.round(segment.start)}s
                  </span>
                </div>
                
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onSeek(segment.start)}
                    className="text-neutral-400 hover:text-white p-1"
                  >
                    <Play className="h-2 w-2" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEditStart(segment)}
                    className="text-neutral-400 hover:text-white p-1"
                  >
                    <Edit className="h-2 w-2" />
                  </Button>
                </div>
              </div>

              {isEditing ? (
                <div className="space-y-1">
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    className="w-full p-1 bg-zinc-700 border border-zinc-600 rounded text-white text-xs resize-none"
                    rows="2"
                    autoFocus
                  />
                  <div className="flex gap-1">
                    <Button size="sm" onClick={handleEditSave} className="text-xs px-2 py-1">
                      Save
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setEditingSegment(null)} className="text-xs px-2 py-1">
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-neutral-200 text-xs leading-relaxed">
                  {segment.text}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
