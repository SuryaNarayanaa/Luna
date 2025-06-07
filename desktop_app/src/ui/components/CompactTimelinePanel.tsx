import { useState, useRef, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Eye, 
  EyeOff,
  Headphones,
  Clock,
  ZoomIn,
  ZoomOut
} from 'lucide-react';
import type { TimelineTrack, Speaker } from '../types';

interface CompactTimelinePanelProps {
  tracks: TimelineTrack[];
  speakers: Speaker[];
  currentTime: number;
  duration: number;
  selectedSpeaker?: string;
  onSeek: (time: number) => void;
  onTrackUpdate: (trackId: string, updates: any) => void;
  onSegmentMove: (segmentId: string, newStart: number) => void;
}

export function CompactTimelinePanel({
  tracks,
  speakers,
  currentTime,
  duration,
  selectedSpeaker,
  onSeek,
  onTrackUpdate,
  onSegmentMove
}: CompactTimelinePanelProps) {
  const [zoomLevel, setZoomLevel] = useState(1);
  const [scrollPosition, setScrollPosition] = useState(0);
  const timelineRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleTimelineClick = useCallback((e: React.MouseEvent) => {
    if (!timelineRef.current) return;
    
    const rect = timelineRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const timelineWidth = rect.width;
    const newTime = (clickX / timelineWidth) * duration * zoomLevel + scrollPosition;
    
    onSeek(Math.max(0, Math.min(duration, newTime)));
  }, [duration, zoomLevel, scrollPosition, onSeek]);

  const handleTrackMute = (trackId: string, muted: boolean) => {
    onTrackUpdate(trackId, { muted });
  };

  const handleTrackSolo = (trackId: string, solo: boolean) => {
    onTrackUpdate(trackId, { solo });
  };

  const handleTrackVolume = (trackId: string, volume: number) => {
    onTrackUpdate(trackId, { volume });
  };

  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev * 1.5, 10));
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev / 1.5, 0.1));
  };

  // Calculate visible duration based on zoom
  const visibleDuration = duration / zoomLevel;
  const timelineWidth = 100; // percentage

  return (
    <div className="h-full flex flex-col bg-zinc-900">
      {/* Compact Header */}
      <div className="flex-shrink-0 bg-zinc-800 border-b border-zinc-700 px-3 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-xs text-zinc-400">
            <Clock className="w-3 h-3" />
            <span>{formatTime(currentTime)}</span>
          </div>
          
          <div className="flex items-center space-x-1">
            <button
              onClick={handleZoomOut}
              className="p-1 text-zinc-400 hover:text-white hover:bg-zinc-700 rounded transition-colors"
              title="Zoom out"
            >
              <ZoomOut className="w-3 h-3" />
            </button>
            <span className="text-xs text-zinc-500">{Math.round(zoomLevel * 100)}%</span>
            <button
              onClick={handleZoomIn}
              className="p-1 text-zinc-400 hover:text-white hover:bg-zinc-700 rounded transition-colors"
              title="Zoom in"
            >
              <ZoomIn className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Timeline Content */}
      <div className="flex-1 overflow-hidden">
        {/* Time Ruler - Compact */}
        <div className="h-6 bg-zinc-800 border-b border-zinc-700 relative">
          <div 
            ref={timelineRef}
            className="h-full relative cursor-pointer"
            onClick={handleTimelineClick}
          >
            {/* Time markers */}
            {Array.from({ length: Math.ceil(visibleDuration / 10) + 1 }).map((_, i) => {
              const time = i * 10 + scrollPosition;
              if (time > duration) return null;
              
              const position = ((time - scrollPosition) / visibleDuration) * 100;
              
              return (
                <div
                  key={i}
                  className="absolute top-0 h-full border-l border-zinc-600"
                  style={{ left: `${position}%` }}
                >
                  <span className="absolute top-0.5 left-1 text-xs text-zinc-400">
                    {formatTime(time)}
                  </span>
                </div>
              );
            })}
            
            {/* Playhead */}
            <div
              className="absolute top-0 w-0.5 h-full bg-blue-500 z-20 pointer-events-none"
              style={{
                left: `${((currentTime - scrollPosition) / visibleDuration) * 100}%`,
                display: currentTime >= scrollPosition && currentTime <= scrollPosition + visibleDuration ? 'block' : 'none'
              }}
            />
          </div>
        </div>

        {/* Tracks - Compact */}
        <div className="flex-1 overflow-y-auto">
          {tracks.map((track) => (
            <div key={track.id} className="border-b border-zinc-800 last:border-b-0">
              {/* Track Header - Very Compact */}
              <div className="h-8 bg-zinc-800 border-b border-zinc-700 flex items-center px-2">
                <div className="flex items-center space-x-1 flex-1 min-w-0">
                  <span className="text-xs font-medium text-white truncate max-w-16">
                    {track.name}
                  </span>
                  
                  <div className="flex items-center space-x-1 ml-auto">
                    {/* Solo */}
                    <button
                      onClick={() => handleTrackSolo(track.id, !track.solo)}
                      className={`p-0.5 rounded text-xs transition-colors ${
                        track.solo 
                          ? 'bg-yellow-600 text-white' 
                          : 'text-zinc-400 hover:text-white hover:bg-zinc-700'
                      }`}
                      title="Solo"
                    >
                      <Headphones className="w-2.5 h-2.5" />
                    </button>
                    
                    {/* Mute */}
                    <button
                      onClick={() => handleTrackMute(track.id, !track.muted)}
                      className={`p-0.5 rounded transition-colors ${
                        track.muted 
                          ? 'text-red-400 bg-red-900/20' 
                          : 'text-zinc-400 hover:text-white hover:bg-zinc-700'
                      }`}
                      title="Mute"
                    >
                      {track.muted ? <VolumeX className="w-2.5 h-2.5" /> : <Volume2 className="w-2.5 h-2.5" />}
                    </button>
                    
                    {/* Volume Slider - Very Small */}
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={track.volume}
                      onChange={(e) => handleTrackVolume(track.id, parseFloat(e.target.value))}
                      className="w-8 h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer"
                      style={{
                        background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${track.volume * 100}%, #52525b ${track.volume * 100}%, #52525b 100%)`
                      }}
                    />
                  </div>
                </div>
              </div>
              
              {/* Track Timeline - Compact */}
              <div className="h-12 bg-zinc-900 relative">
                {/* Waveform Background */}
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full h-6 bg-zinc-800 rounded-sm flex items-end justify-center space-x-px px-1">
                    {Array.from({ length: 50 }).map((_, i) => (
                      <div
                        key={i}
                        className="bg-zinc-600 opacity-50"
                        style={{
                          width: '2px',
                          height: `${Math.random() * 100}%`,
                          minHeight: '2px',
                        }}
                      />
                    ))}
                  </div>
                </div>
                
                {/* Track Segments */}
                {track.segments.map((segment) => {
                  const startPercent = ((segment.start - scrollPosition) / visibleDuration) * 100;
                  const widthPercent = ((segment.end - segment.start) / visibleDuration) * 100;
                  
                  if (startPercent > 100 || startPercent + widthPercent < 0) return null;
                  
                  return (
                    <motion.div
                      key={segment.id}
                      className="absolute top-1 h-10 rounded cursor-pointer border border-opacity-50 hover:border-opacity-100 transition-all"
                      style={{
                        left: `${Math.max(0, startPercent)}%`,
                        width: `${Math.min(widthPercent, 100 - Math.max(0, startPercent))}%`,
                        backgroundColor: segment.color,
                        borderColor: segment.color
                      }}
                      whileHover={{ scale: 1.02 }}
                      onClick={() => onSeek(segment.start)}
                    >
                      {/* Segment Content - Very Minimal */}
                      <div className="p-1 h-full flex items-center">
                        <div className="text-xs text-white/90 font-medium truncate">
                          {track.type === 'audio' ? '♪' : '♫'}
                        </div>
                      </div>
                      
                      {/* Resize Handles - Tiny */}
                      <div className="absolute left-0 top-0 w-1 h-full bg-white/20 cursor-w-resize opacity-0 hover:opacity-100 transition-opacity" />
                      <div className="absolute right-0 top-0 w-1 h-full bg-white/20 cursor-e-resize opacity-0 hover:opacity-100 transition-opacity" />
                    </motion.div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Compact Progress/Overview */}
      <div className="flex-shrink-0 bg-zinc-800 border-t border-zinc-700 p-2">
        <div className="w-full bg-zinc-700 rounded-full h-1 relative cursor-pointer" onClick={handleTimelineClick}>
          <div 
            className="bg-blue-500 h-full rounded-full transition-all duration-100"
            style={{ width: `${(currentTime / duration) * 100}%` }}
          />
          
          {/* Track overview on progress bar */}
          {tracks.map((track) => 
            track.segments.map((segment) => {
              const startPercent = (segment.start / duration) * 100;
              const widthPercent = ((segment.end - segment.start) / duration) * 100;
              
              return (
                <div
                  key={segment.id}
                  className="absolute top-0 h-full opacity-40 rounded-full"
                  style={{
                    left: `${startPercent}%`,
                    width: `${widthPercent}%`,
                    backgroundColor: segment.color,
                  }}
                />
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
