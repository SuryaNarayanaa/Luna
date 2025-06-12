// Compact version of TimelinePanel for split view
import React, { useState } from 'react';
import { Volume2, VolumeX, ZoomIn, ZoomOut } from 'lucide-react';

export default function CompactTimelinePanel({
  tracks,
  speakers,
  currentTime,
  duration,
  selectedSpeaker,
  onSeek,
  onTrackUpdate,
  onSegmentMove,
}) {
  const [zoom, setZoom] = useState(0.8);
  const pixelsPerSecond = 30 * zoom;
  const timelineWidth = duration * pixelsPerSecond;

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleTimelineClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const time = (x / timelineWidth) * duration;
    onSeek(Math.max(0, Math.min(duration, time)));
  };

  const handleZoomIn = () => setZoom(prev => Math.min(prev * 1.2, 3));
  const handleZoomOut = () => setZoom(prev => Math.max(prev / 1.2, 0.2));

  return (
    <div className="flex-1 flex flex-col bg-zinc-900 h-full overflow-hidden">
      {/* Compact Header */}
      <div className="p-3 border-b border-zinc-800 bg-zinc-900/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {/* Compact Zoom Controls */}
            <button
              onClick={handleZoomOut}
              className="p-1 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded transition-colors"
              title="Zoom out"
            >
              <ZoomOut className="w-3 h-3" />
            </button>
            <span className="text-xs text-zinc-500 w-8 text-center">
              {(zoom * 100).toFixed(0)}%
            </span>
            <button
              onClick={handleZoomIn}
              className="p-1 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded transition-colors"
              title="Zoom in"
            >
              <ZoomIn className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Compact Timeline Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Time Ruler */}
        <div className="h-6 bg-zinc-900 border-b border-zinc-800 relative overflow-x-auto">
          <div 
            className="h-full relative"
            style={{ width: `${timelineWidth}px` }}
          >
            {Array.from({ length: Math.ceil(duration / 10) }, (_, i) => (
              <div
                key={i}
                className="absolute top-0 h-full flex items-end text-xs text-zinc-400"
                style={{ left: `${(i * 10 / duration) * timelineWidth}px` }}
              >
                <div className="w-px bg-zinc-700 h-2" />
                <span className="px-1 text-xs">{i * 10}s</span>
              </div>
            ))}
            
            {/* Compact Playhead */}
            <div
              className="absolute top-0 w-0.5 h-full bg-blue-500 z-10"
              style={{ left: `${(currentTime / duration) * timelineWidth}px` }}
            />
          </div>
        </div>

        {/* Track Area */}
        <div className="flex-1 overflow-auto">
          <div 
            className="relative cursor-pointer"
            style={{ 
              width: `${timelineWidth}px`,
              height: `${tracks.length * 50}px`
            }}
            onClick={handleTimelineClick}
          >
            {tracks
              .filter(track => !selectedSpeaker || track.segments.some(_ => 
                speakers.find(s => s.id === selectedSpeaker)?.name === track.name.split(' ')[0]
              ))              .map((track, trackIndex) => {
                const speaker = speakers.find(s => track.name.includes(s.name));
                return (
                  <div
                    key={track.id}
                    className="absolute w-full border-b border-zinc-800"
                    style={{ 
                      top: `${trackIndex * 50}px`,
                      height: '50px'
                    }}
                  >
                    {/* Track Background */}
                    <div className="w-full h-full bg-zinc-900/10" />

                    {/* Simplified Track Header */}
                    <div className="absolute left-2 top-1 flex items-center gap-1.5">
                      <div className="text-xs text-zinc-400 font-medium truncate max-w-16">
                        {track.name.split(' ')[0]}
                      </div>
                      {speaker && (
                        <div 
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: speaker.color }}
                          title={speaker.name}
                        />
                      )}
                    </div>

                    {/* Compact Track Controls */}
                    <div className="absolute right-2 top-1 flex items-center gap-1">
                      <div className="flex items-center gap-0.5">                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.1"
                          value={track.volume}
                          onChange={(e) => onTrackUpdate(track.id, { volume: parseFloat(e.target.value) })}
                          className="w-8 h-4 compact-volume-slider"
                          title={`Volume: ${Math.round(track.volume * 100)}%`}
                        />
                      </div>
                      <button
                        onClick={() => onTrackUpdate(track.id, { muted: !track.muted })}
                        className={`p-0.5 rounded transition-colors ${
                          track.muted
                            ? 'bg-red-500 text-white'
                            : 'text-zinc-500 hover:text-white hover:bg-zinc-700'
                        }`}
                        title={track.muted ? 'Unmute' : 'Mute'}
                      >
                        {track.muted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                      </button>                    </div>

                    {/* Track Segments */}
                    {track.segments.map((segment) => {
                      const segmentLeft = (segment.start / duration) * timelineWidth;
                      const segmentWidth = ((segment.end - segment.start) / duration) * timelineWidth;
                      const isCurrentSegment = currentTime >= segment.start && currentTime <= segment.end;

                      return (
                        <div
                          key={segment.id}
                          className={`absolute h-8 top-2 rounded cursor-move transition-all ${
                            isCurrentSegment ? 'ring-1 ring-blue-500' : ''
                          }`}
                          style={{
                            left: `${segmentLeft}px`,
                            width: `${segmentWidth}px`,
                            backgroundColor: segment.color,
                            opacity: 0.8
                          }}
                          title={`${track.name}: ${formatTime(segment.start)} - ${formatTime(segment.end)}`}
                        >
                          <div className="w-full h-full rounded bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                        </div>
                      );
                    })}

                    {/* Mini Waveform */}
                    <div className="absolute inset-0 opacity-20 pointer-events-none">
                      <svg width="100%" height="48" className="text-zinc-500">
                        {Array.from({ length: 50 }).map((_, i) => (
                          <rect
                            key={i}
                            x={`${i * 2}%`}
                            y={24 - Math.random() * 12}
                            width="1.5%"
                            height={Math.random() * 12}
                            fill="currentColor"
                          />
                        ))}
                      </svg>
                    </div>
                  </div>
                );
              })}

            {/* Playhead Line */}
            <div
              className="absolute top-0 w-0.5 bg-blue-500 pointer-events-none z-20"
              style={{ 
                left: `${(currentTime / duration) * timelineWidth}px`,
                height: `${tracks.length * 50}px`
              }}
            />
          </div>
        </div>
      </div>

      {/* Compact Footer */}
      <div className="p-2 border-t border-zinc-800 bg-zinc-900/30">
        <div className="flex items-center justify-between text-xs text-zinc-400">
          <span>{formatTime(currentTime)}</span>
          <span>{tracks.length} tracks</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>
    </div>
  );
}
