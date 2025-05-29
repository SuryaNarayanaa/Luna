import React, { useState, useRef, useEffect } from 'react';
import './VideoPlayer.css';

interface TranscriptionSegment {
  start: number;
  end: number;
  text: string;
}

interface VideoPlayerProps {
  videoUrl: string;
  transcription: TranscriptionSegment[];
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ videoUrl, transcription }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentSubtitle, setCurrentSubtitle] = useState<string>('');

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      
      // Find current subtitle
      const current = transcription.find(
        segment => video.currentTime >= segment.start && video.currentTime <= segment.end
      );
      setCurrentSubtitle(current?.text || '');
    };

    const handleLoadedMetadata = () => {
      setDuration(video.duration);
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
    };
  }, [transcription]);

  const togglePlayPause = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
    } else {
      video.play();
    }
  };

  const handleSeek = (event: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;

    const seekTime = (parseFloat(event.target.value) / 100) * duration;
    video.currentTime = seekTime;
  };

  const jumpToSegment = (startTime: number) => {
    const video = videoRef.current;
    if (!video) return;

    video.currentTime = startTime;
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="video-player-container">
      <div className="video-wrapper">
        <video
          ref={videoRef}
          src={videoUrl}
          className="video-element"
          onClick={togglePlayPause}
        />
        
        {/* Subtitle Overlay */}
        {currentSubtitle && (
          <div className="subtitle-overlay">
            {currentSubtitle}
          </div>
        )}
        
        {/* Video Controls */}
        <div className="video-controls">
          <button onClick={togglePlayPause} className="play-pause-btn">
            {isPlaying ? '⏸️' : '▶️'}
          </button>
          
          <span className="time-display">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
          
          <input
            type="range"
            min="0"
            max="100"
            value={progress}
            onChange={handleSeek}
            className="seek-bar"
          />
        </div>
      </div>

      {/* Transcription Panel */}
      <div className="transcription-panel">
        <h3>Transcription</h3>
        <div className="transcription-list">
          {transcription.map((segment, index) => (
            <div
              key={index}
              className={`transcription-segment ${
                currentTime >= segment.start && currentTime <= segment.end ? 'active' : ''
              }`}
              onClick={() => jumpToSegment(segment.start)}
            >
              <span className="timestamp">
                {formatTime(segment.start)} - {formatTime(segment.end)}
              </span>
              <p className="text">{segment.text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default VideoPlayer;
