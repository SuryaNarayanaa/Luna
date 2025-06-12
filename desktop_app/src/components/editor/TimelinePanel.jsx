import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Volume2, 
  VolumeX, 
  Lock, 
  Scissors,
  Copy,
  Trash2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Plus,
  Settings,
  User,
  Music,
  Mic
} from 'lucide-react';
import { useHotkeys } from 'react-hotkeys-hook';

export default function TimelinePanel({
  tracks,
  speakers,
  currentTime,
  duration,
  selectedSpeaker,
  onSeek,
  onTrackUpdate,
  onSegmentMove,
}) {
  const [zoom, setZoom] = useState(1);
  const [scrollPosition] = useState(0);
  const [draggedSegment, setDraggedSegment] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const timelineRef = useRef(null);
  const rulerRef = useRef(null);

  const pixelsPerSecond = 50 * zoom;
  const timelineWidth = duration * pixelsPerSecond;
  const playheadPosition = (currentTime / duration) * timelineWidth;

  // Generate time markers
  const timeMarkers = [];
  const interval = Math.max(1, Math.floor(10 / zoom)); // Adjust interval based on zoom
  for (let i = 0; i <= duration; i += interval) {
    timeMarkers.push(i);
  }

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleTimelineClick = (e) => {
    if (timelineRef.current) {
      const rect = timelineRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left + scrollPosition;
      const time = (x / timelineWidth) * duration;
      onSeek(Math.max(0, Math.min(duration, time)));
    }
  };

  const handleSegmentDragStart = (e, segmentId) => {
    e.stopPropagation();
    setDraggedSegment(segmentId);
  };

  const handleSegmentDrag = (e) => {
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

  const handleContextMenu = (e, segmentId) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, segmentId });
  };
  const handleZoomIn = () => setZoom(prev => Math.min(prev * 1.5, 10));
  const handleZoomOut = () => setZoom(prev => Math.max(prev / 1.5, 0.1));

  // Enhanced track management
  const getTrackIcon = (trackType) => {
    switch (trackType) {
      case 'audio': return <Mic className="w-4 h-4" />;
      case 'music': return <Music className="w-4 h-4" />;
      default: return <Volume2 className="w-4 h-4" />;
    }
  };

  const getTrackSpeaker = (trackId) => {
    return speakers.find(speaker => {
      const track = tracks.find(t => t.id === trackId);
      return track && track.name === speaker.name;
    });
  };

  const handleTrackVolumeChange = useCallback((trackId, volume) => {
    onTrackUpdate(trackId, { volume });
  }, [onTrackUpdate]);

  const handleTrackMute = useCallback((trackId) => {
    const track = tracks.find(t => t.id === trackId);
    onTrackUpdate(trackId, { muted: !track.muted });
  }, [tracks, onTrackUpdate]);

  const handleTrackSolo = useCallback((trackId) => {
    const track = tracks.find(t => t.id === trackId);
    onTrackUpdate(trackId, { solo: !track.solo });
  }, [tracks, onTrackUpdate]);

  // Keyboard shortcuts for timeline
  useHotkeys('plus, equals', (e) => {
    e.preventDefault();
    handleZoomIn();
  });

  useHotkeys('minus', (e) => {
    e.preventDefault();
    handleZoomOut();
  });

  useHotkeys('0', (e) => {
    e.preventDefault();
    setZoom(1);
  });

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
          <h2 className="text-lg font-semibold text-white">Timeline</h2>
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
        </div>      </div>      {/* Timeline Content */}
      <div className="flex-1 flex overflow-hidden">        {/* Simplified Track List */}
        <div className="w-72 border-r border-zinc-800 bg-zinc-900/30 overflow-y-auto">
          {tracks
            .filter(track => !selectedSpeaker || track.segments.some(_ => 
              speakers.find(s => s.id === selectedSpeaker)?.name === track.name.split(' ')[0]
            ))
            .map((track, trackIndex) => {
              const speaker = getTrackSpeaker(track.id);
              
              return (
                <div 
                  key={track.id} 
                  className="h-20 border-b border-zinc-800 px-3 py-2 hover:bg-zinc-800/30 transition-colors flex items-center"
                  style={{ 
                    // Sync with timeline visualization height
                    height: '80px',
                    borderBottomColor: trackIndex === tracks.length - 1 ? 'transparent' : undefined
                  }}
                >
                  <div className="flex-1 min-w-0">
                    {/* Track Header - Compact */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div className="text-zinc-400 flex-shrink-0">
                          {getTrackIcon(track.type)}
                        </div>
                        <h3 className="text-sm font-medium text-white truncate">
                          {track.name}
                        </h3>
                      </div>
                      
                      {/* Speaker Color & Info */}
                      {speaker && (
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <div 
                            className="w-2.5 h-2.5 rounded-full border border-zinc-600"
                            style={{ backgroundColor: speaker.color }}
                            title={`Speaker: ${speaker.name}`}
                          />
                          <span className="text-xs text-zinc-500 font-mono">
                            {track.segments.length}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Compact Controls Row */}
                    <div className="flex items-center gap-2">
                      {/* Volume Slider - Compact */}
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <Volume2 className="w-3 h-3 text-zinc-500 flex-shrink-0" />                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.1"
                          value={track.volume}
                          onChange={(e) => handleTrackVolumeChange(track.id, parseFloat(e.target.value))}
                          className="flex-1 timeline-track-slider"
                        />
                        <span className="text-xs text-zinc-400 w-7 text-right font-mono">
                          {Math.round(track.volume * 100)}
                        </span>
                      </div>

                      {/* Solo/Mute Buttons - Compact */}
                      <div className="flex gap-1 flex-shrink-0">
                        <button
                          onClick={() => handleTrackSolo(track.id)}
                          className={`w-6 h-6 rounded text-xs font-bold transition-all ${
                            track.solo 
                              ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/25' 
                              : 'bg-zinc-700 text-zinc-400 hover:bg-zinc-600 hover:text-white'
                          }`}
                          title="Solo track"
                        >
                          S
                        </button>
                        <button
                          onClick={() => handleTrackMute(track.id)}
                          className={`w-6 h-6 rounded flex items-center justify-center transition-all ${
                            track.muted 
                              ? 'bg-red-500 text-white shadow-lg shadow-red-500/25' 
                              : 'bg-zinc-700 text-zinc-400 hover:bg-zinc-600 hover:text-white'
                          }`}
                          title="Mute track"
                        >
                          {track.muted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
        </div>

        {/* Timeline Visualization */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Time Ruler */}
          <div className="h-8 border-b border-zinc-800 overflow-hidden relative bg-zinc-900/50">
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
            >
              {tracks
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
