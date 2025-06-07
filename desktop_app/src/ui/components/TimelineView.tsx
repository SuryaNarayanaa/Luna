import React, { useState, useRef } from 'react';
import { Volume2, VolumeX, Lock, Scissors, Copy } from 'lucide-react';
import { Button } from './ui_/button';
import { Slider } from './ui_/slider';
import { cn } from '../lib/utils';
import type { AudioTrack, Speaker } from '../types';

interface TimelineViewProps {
  tracks: AudioTrack[];
  speakers: Speaker[];
  currentTime: number;
  duration: number;
  onTrackUpdate: (trackId: string, updates: Partial<AudioTrack>) => void;
  onSegmentMove: (segmentId: string, newStart: number, newEnd: number) => void;
  onSegmentSplit: (segmentId: string, splitTime: number) => void;
  onSegmentCopy: (segmentId: string) => void;
  onSeek: (time: number) => void;
}

const TRACK_HEIGHT = 80;
const TIMELINE_ZOOM = 50; // pixels per second

export function TimelineView({
  tracks,
  speakers,
  currentTime,
  duration,
  onTrackUpdate,
  onSegmentMove,
  onSegmentSplit,
  onSegmentCopy,
  onSeek,
}: TimelineViewProps) {
  const [dragState, setDragState] = useState<{
    segmentId: string;
    startX: number;
    startTime: number;
    type: 'move' | 'resize-left' | 'resize-right';
  } | null>(null);
  
  const timelineRef = useRef<HTMLDivElement>(null);

  const getSpeakerColor = (speakerId: string): string => {
    const speaker = speakers.find(s => s.id === speakerId);
    return speaker?.color || '#6366f1';
  };

  const timeToPixels = (time: number): number => {
    return time * TIMELINE_ZOOM;
  };

  const pixelsToTime = (pixels: number): number => {
    return pixels / TIMELINE_ZOOM;
  };

  const handleMouseDown = (
    e: React.MouseEvent,
    segmentId: string,
    type: 'move' | 'resize-left' | 'resize-right'
  ) => {
    e.preventDefault();
    const segment = tracks
      .flatMap(track => track.segments)
      .find(seg => seg.id === segmentId);
    
    if (segment) {
      setDragState({
        segmentId,
        startX: e.clientX,
        startTime: type === 'resize-right' ? segment.end : segment.start,
        type,
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragState) return;

    const deltaX = e.clientX - dragState.startX;
    const deltaTime = pixelsToTime(deltaX);
    
    const segment = tracks
      .flatMap(track => track.segments)
      .find(seg => seg.id === dragState.segmentId);
    
    if (!segment) return;

    let newStart = segment.start;
    let newEnd = segment.end;

    switch (dragState.type) {
      case 'move':
        const duration = segment.end - segment.start;
        newStart = Math.max(0, dragState.startTime + deltaTime);
        newEnd = newStart + duration;
        break;
      case 'resize-left':
        newStart = Math.max(0, Math.min(dragState.startTime + deltaTime, segment.end - 0.1));
        break;
      case 'resize-right':
        newEnd = Math.max(segment.start + 0.1, dragState.startTime + deltaTime);
        break;
    }

    onSegmentMove(dragState.segmentId, newStart, newEnd);
  };

  const handleMouseUp = () => {
    setDragState(null);
  };

  const handleTimelineClick = (e: React.MouseEvent) => {
    if (dragState) return;
    
    const rect = timelineRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const x = e.clientX - rect.left;
    const time = pixelsToTime(x);
    onSeek(Math.max(0, Math.min(time, duration)));
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex-1 flex flex-col bg-zinc-900">
      {/* Timeline Header */}
      <div className="h-12 bg-zinc-800 border-b border-zinc-700 flex items-center">
        <div className="w-48 px-4 border-r border-zinc-700">
          <h3 className="text-sm font-medium text-white">Tracks</h3>
        </div>
        
        {/* Time Ruler */}
        <div 
          ref={timelineRef}
          className="flex-1 relative cursor-pointer"
          onClick={handleTimelineClick}
        >
          <div className="h-full flex items-center">
            {Array.from({ length: Math.ceil(duration / 10) + 1 }).map((_, i) => {
              const time = i * 10;
              return (
                <div
                  key={i}
                  className="absolute top-0 h-full border-l border-zinc-600"
                  style={{ left: timeToPixels(time) }}
                >
                  <span className="absolute -top-1 text-xs text-neutral-400 transform -translate-x-1/2">
                    {formatTime(time)}
                  </span>
                </div>
              );
            })}
          </div>
          
          {/* Playhead */}
          <div
            className="absolute top-0 w-0.5 h-full bg-red-500 z-20 pointer-events-none"
            style={{ left: timeToPixels(currentTime) }}
          />
        </div>
      </div>

      {/* Tracks */}
      <div 
        className="flex-1 overflow-auto"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >        {tracks.map((track, _) => (
          <div key={track.id} className="flex border-b border-zinc-800">
            {/* Track Controls */}
            <div className="w-48 bg-zinc-850 border-r border-zinc-700 p-3 flex flex-col justify-between">
              <div>
                <h4 className="text-sm font-medium text-white mb-2">{track.name}</h4>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onTrackUpdate(track.id, { muted: !track.muted })}
                      className={cn(
                        "h-6 w-6",
                        track.muted ? "text-red-400" : "text-neutral-400"
                      )}
                    >
                      {track.muted ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-neutral-400"
                    >
                      <Lock className="h-3 w-3" />
                    </Button>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-neutral-400 w-8">Vol</span>
                    <Slider
                      value={[track.volume]}
                      max={1}
                      step={0.01}
                      onValueChange={(value) => onTrackUpdate(track.id, { volume: value[0] })}
                      className="flex-1"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Track Timeline */}
            <div 
              className="flex-1 relative bg-zinc-900"
              style={{ height: TRACK_HEIGHT }}
            >
              {/* Track Background */}
              <div className="absolute inset-0 timeline-track" />
              
              {/* Audio Segments */}
              {track.segments.map((segment) => {
                const left = timeToPixels(segment.start);
                const width = timeToPixels(segment.end - segment.start);
                const speakerColor = segment.speaker ? getSpeakerColor(segment.speaker) : '#6366f1';

                return (
                  <div
                    key={segment.id}
                    className="audio-segment group cursor-move"
                    style={{
                      left,
                      width,
                      backgroundColor: speakerColor,
                    }}
                    onMouseDown={(e) => handleMouseDown(e, segment.id, 'move')}
                  >
                    {/* Resize Handles */}
                    <div
                      className="absolute left-0 top-0 w-2 h-full cursor-ew-resize bg-white opacity-0 group-hover:opacity-50"
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        handleMouseDown(e, segment.id, 'resize-left');
                      }}
                    />
                    <div
                      className="absolute right-0 top-0 w-2 h-full cursor-ew-resize bg-white opacity-0 group-hover:opacity-50"
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        handleMouseDown(e, segment.id, 'resize-right');
                      }}
                    />
                    
                    {/* Segment Content */}
                    <div className="absolute inset-2 text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="flex items-center justify-between h-full">
                        <span className="truncate">
                          {speakers.find(s => s.id === segment.speaker)?.name || 'Speaker'}
                        </span>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSegmentSplit(segment.id, segment.start + (segment.end - segment.start) / 2);
                            }}
                            className="h-4 w-4"
                          >
                            <Scissors className="h-2 w-2" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSegmentCopy(segment.id);
                            }}
                            className="h-4 w-4"
                          >
                            <Copy className="h-2 w-2" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
