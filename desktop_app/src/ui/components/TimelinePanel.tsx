import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Volume2, 
  VolumeX, 
  Lock, 
  Scissors,
  Copy,
  Trash2,
  ZoomIn,
  ZoomOut,
  RotateCcw
} from 'lucide-react';
import type { TimelineTrack, Speaker } from '../types';

interface TimelinePanelProps {
  tracks: TimelineTrack[];
  speakers: Speaker[];
  currentTime: number;
  duration: number;
  selectedSpeaker?: string;
  onSeek: (time: number) => void;
  onTrackUpdate: (trackId: string, updates: Partial<TimelineTrack>) => void;
  onSegmentMove: (segmentId: string, newStart: number) => void;
}

export function TimelinePanel({
  tracks,
  speakers,
  currentTime,
  duration,
  selectedSpeaker,
  onSeek,
  onTrackUpdate,
  onSegmentMove
}: TimelinePanelProps) {  const [zoom, setZoom] = useState(1);
  const [scrollPosition] = useState(0);
  const [draggedSegment, setDraggedSegment] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; segmentId: string } | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const rulerRef = useRef<HTMLDivElement>(null);

  const pixelsPerSecond = 50 * zoom;
  const timelineWidth = duration * pixelsPerSecond;
  const playheadPosition = (currentTime / duration) * timelineWidth;

  // Generate time markers
  const timeMarkers = [];
  const interval = Math.max(1, Math.floor(10 / zoom)); // Adjust interval based on zoom
  for (let i = 0; i <= duration; i += interval) {
    timeMarkers.push(i);
  }

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleTimelineClick = (e: React.MouseEvent) => {
    if (timelineRef.current) {
      const rect = timelineRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left + scrollPosition;
      const time = (x / timelineWidth) * duration;
      onSeek(Math.max(0, Math.min(duration, time)));
    }
  };

  const handleSegmentDragStart = (e: React.MouseEvent, segmentId: string) => {
    e.stopPropagation();
    setDraggedSegment(segmentId);
  };

  const handleSegmentDrag = (e: React.MouseEvent) => {
    if (draggedSegment && timelineRef.current) {
      const rect = timelineRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left + scrollPosition;
      const newTime = (x / timelineWidth) * duration;
      onSegmentMove(draggedSegment, Math.max(0, Math.min(duration, newTime)));
    }
  };

  const handleSegmentDragEnd = () => {
    setDraggedSegment(null);
  };

  const handleContextMenu = (e: React.MouseEvent, segmentId: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, segmentId });
  };

  const handleZoomIn = () => setZoom(prev => Math.min(prev * 1.5, 10));
  const handleZoomOut = () => setZoom(prev => Math.max(prev / 1.5, 0.1));

  // Close context menu when clicking elsewhere
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-zinc-950">
      {/* Timeline Header */}
      <div className="border-b border-zinc-800 p-4 bg-zinc-900/50">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-white">Timeline Editor</h2>
          <div className="flex items-center space-x-3">
            {/* Zoom Controls */}
            <div className="flex items-center space-x-2">
              <button
                onClick={handleZoomOut}
                className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded transition-colors"
                title="Zoom out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-xs text-zinc-500 w-12 text-center">
                {(zoom * 100).toFixed(0)}%
              </span>
              <button
                onClick={handleZoomIn}
                className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded transition-colors"
                title="Zoom in"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>

            {/* Timeline Info */}
            <div className="text-sm text-zinc-400">
              {tracks.length} tracks • {formatTime(duration)}
            </div>
          </div>
        </div>

        {/* Track Controls */}
        <div className="grid grid-cols-4 gap-2 text-xs">
          <div className="text-zinc-500 font-medium">Track</div>
          <div className="text-zinc-500 font-medium">Volume</div>
          <div className="text-zinc-500 font-medium">Solo/Mute</div>
          <div className="text-zinc-500 font-medium">Actions</div>
        </div>
      </div>

      {/* Timeline Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Track List */}        <div className="w-80 border-r border-zinc-800 bg-zinc-900/30 overflow-y-auto">
          {tracks
            .filter(track => !selectedSpeaker || track.segments.some(_ => 
              speakers.find(s => s.id === selectedSpeaker)?.name === track.name.split(' ')[0]
            ))
            .map((track) => (
              <div key={track.id} className="border-b border-zinc-800 p-4">
                <div className="space-y-3">
                  {/* Track Header */}
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-medium text-white truncate">
                        {track.name}
                      </h3>
                      <p className="text-xs text-zinc-500">
                        {track.type} • {track.segments.length} segments
                      </p>
                    </div>
                    <div className={`w-3 h-3 rounded-full ${
                      track.type === 'audio' ? 'bg-blue-500' :
                      track.type === 'music' ? 'bg-purple-500' :
                      'bg-green-500'
                    }`} />
                  </div>

                  {/* Volume Control */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-zinc-500">Volume</span>
                      <span className="text-xs text-zinc-400">
                        {Math.round(track.volume * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={track.volume}
                      onChange={(e) => onTrackUpdate(track.id, { volume: parseFloat(e.target.value) })}
                      className="w-full h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>

                  {/* Solo/Mute Controls */}
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => onTrackUpdate(track.id, { solo: !track.solo })}
                      className={`px-2 py-1 text-xs rounded transition-colors ${
                        track.solo
                          ? 'bg-yellow-600 text-white'
                          : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
                      }`}
                    >
                      S
                    </button>
                    <button
                      onClick={() => onTrackUpdate(track.id, { muted: !track.muted })}
                      className={`p-1 rounded transition-colors ${
                        track.muted
                          ? 'bg-red-600 text-white'
                          : 'text-zinc-400 hover:text-white hover:bg-zinc-700'
                      }`}
                    >
                      {track.muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                    </button>
                    <button className="p-1 text-zinc-400 hover:text-white hover:bg-zinc-700 rounded transition-colors">
                      <Lock className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
        </div>

        {/* Timeline Visualization */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Time Ruler */}
          <div 
            ref={rulerRef}
            className="h-8 bg-zinc-900 border-b border-zinc-800 relative overflow-hidden"
          >
            <div 
              className="h-full relative"
              style={{ width: `${timelineWidth}px`, marginLeft: `-${scrollPosition}px` }}
            >
              {timeMarkers.map((time) => (
                <div
                  key={time}
                  className="absolute top-0 h-full flex flex-col justify-between text-xs text-zinc-400"
                  style={{ left: `${(time / duration) * timelineWidth}px` }}
                >
                  <div className="w-px bg-zinc-700 h-full" />
                  <span className="px-1 bg-zinc-900">{formatTime(time)}</span>
                </div>
              ))}
              
              {/* Playhead */}
              <div
                className="absolute top-0 w-0.5 h-full bg-blue-500 z-10"
                style={{ left: `${playheadPosition}px` }}
              >
                <div className="w-3 h-3 bg-blue-500 rounded-full absolute -top-1 -left-1" />
              </div>
            </div>
          </div>

          {/* Track Lanes */}
          <div 
            ref={timelineRef}
            className="flex-1 overflow-auto cursor-crosshair"
            onClick={handleTimelineClick}
            onMouseMove={draggedSegment ? handleSegmentDrag : undefined}
            onMouseUp={handleSegmentDragEnd}
          >
            <div 
              className="relative"
              style={{ 
                width: `${timelineWidth}px`,
                height: `${tracks.length * 80}px`
              }}
            >              {tracks
                .filter(track => !selectedSpeaker || track.segments.some(_ => 
                  speakers.find(s => s.id === selectedSpeaker)?.name === track.name.split(' ')[0]
                ))
                .map((track, trackIndex) => (
                  <div
                    key={track.id}
                    className="absolute w-full h-20 border-b border-zinc-800"
                    style={{ top: `${trackIndex * 80}px` }}
                  >
                    {/* Track Background */}
                    <div className="w-full h-full bg-zinc-900/20" />

                    {/* Track Segments */}
                    {track.segments.map((segment) => {
                      const segmentLeft = (segment.start / duration) * timelineWidth;
                      const segmentWidth = ((segment.end - segment.start) / duration) * timelineWidth;
                      const isCurrentSegment = currentTime >= segment.start && currentTime <= segment.end;

                      return (
                        <motion.div
                          key={segment.id}
                          className={`absolute h-16 top-2 rounded-lg cursor-move transition-all ${
                            isCurrentSegment ? 'ring-2 ring-blue-500' : ''
                          } ${draggedSegment === segment.id ? 'opacity-50' : ''}`}
                          style={{
                            left: `${segmentLeft}px`,
                            width: `${segmentWidth}px`,
                            backgroundColor: segment.color,
                            opacity: 0.8
                          }}
                          onMouseDown={(e) => handleSegmentDragStart(e, segment.id)}
                          onContextMenu={(e) => handleContextMenu(e, segment.id)}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          {/* Segment Content */}
                          <div className="p-2 h-full overflow-hidden">
                            <div className="text-xs font-medium text-white truncate">
                              Segment {segment.id}
                            </div>
                            <div className="text-xs text-white/70">
                              {formatTime(segment.start)} - {formatTime(segment.end)}
                            </div>
                            <div className="text-xs text-white/50">
                              Gain: {Math.round(segment.gain * 100)}%
                            </div>
                          </div>

                          {/* Resize Handles */}
                          <div className="absolute left-0 top-0 w-1 h-full bg-white/20 cursor-w-resize hover:bg-white/40" />
                          <div className="absolute right-0 top-0 w-1 h-full bg-white/20 cursor-e-resize hover:bg-white/40" />

                          {/* Crossfade Markers */}
                          <div className="absolute left-1 top-1 w-2 h-2 bg-white/30 rounded-full" />
                          <div className="absolute right-1 top-1 w-2 h-2 bg-white/30 rounded-full" />
                        </motion.div>
                      );
                    })}

                    {/* Waveform Visualization (Mock) */}
                    <div className="absolute inset-0 opacity-30 pointer-events-none">
                      <svg width="100%" height="80" className="text-zinc-400">
                        {Array.from({ length: 100 }).map((_, i) => (
                          <rect
                            key={i}
                            x={`${i}%`}
                            y={40 - Math.random() * 30}
                            width="1%"
                            height={Math.random() * 30}
                            fill="currentColor"
                          />
                        ))}
                      </svg>
                    </div>
                  </div>
                ))}

              {/* Playhead Line */}
              <div
                className="absolute top-0 w-0.5 bg-blue-500 pointer-events-none z-20"
                style={{ 
                  left: `${playheadPosition}px`,
                  height: `${tracks.length * 80}px`
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="fixed bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl z-50 py-1"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button className="w-full px-3 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-700 flex items-center space-x-2">
            <Scissors className="w-4 h-4" />
            <span>Split Segment</span>
          </button>
          <button className="w-full px-3 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-700 flex items-center space-x-2">
            <Copy className="w-4 h-4" />
            <span>Duplicate</span>
          </button>
          <button className="w-full px-3 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-700 flex items-center space-x-2">
            <RotateCcw className="w-4 h-4" />
            <span>Regenerate Audio</span>
          </button>
          <div className="border-t border-zinc-700 my-1" />
          <button className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-zinc-700 flex items-center space-x-2">
            <Trash2 className="w-4 h-4" />
            <span>Delete</span>
          </button>
        </motion.div>
      )}
    </div>
  );
}
