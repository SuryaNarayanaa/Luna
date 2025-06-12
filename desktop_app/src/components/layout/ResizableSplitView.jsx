import React, { useState, useRef, useEffect } from 'react';

export default function ResizableSplitView({
  leftComponent,
  rightComponent,
  initialSplitRatio = 0.5,
  onSplitRatioChange,
  leftTitle,
  rightTitle,
  className = ''
}) {
  const [splitRatio, setSplitRatio] = useState(initialSplitRatio);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef(null);

  const handleMouseDown = (e) => {
    setIsDragging(true);
    e.preventDefault();
  };

  const handleMouseMove = (e) => {
    if (!isDragging || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const newRatio = (e.clientX - rect.left) / rect.width;
    const clampedRatio = Math.max(0.2, Math.min(0.8, newRatio));
    
    setSplitRatio(clampedRatio);
    if (onSplitRatioChange) {
      onSplitRatioChange(clampedRatio);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging]);

  return (
    <div ref={containerRef} className={`flex h-full ${className}`}>
      {/* Left Panel */}
      <div 
        className="flex flex-col border-r border-zinc-800"
        style={{ width: `${splitRatio * 100}%` }}
      >
        {leftTitle && (
          <div className="p-2 border-b border-zinc-800 bg-zinc-900">
            <h3 className="text-sm font-medium text-white">{leftTitle}</h3>
          </div>
        )}
        <div className="flex-1 overflow-hidden">
          {leftComponent}
        </div>
      </div>

      {/* Resize Handle */}
      <div
        className={`w-1 bg-zinc-800 cursor-col-resize hover:bg-zinc-700 transition-colors ${
          isDragging ? 'bg-blue-500' : ''
        }`}
        onMouseDown={handleMouseDown}
      />

      {/* Right Panel */}
      <div 
        className="flex flex-col"
        style={{ width: `${(1 - splitRatio) * 100}%` }}
      >
        {rightTitle && (
          <div className="p-2 border-b border-zinc-800 bg-zinc-900">
            <h3 className="text-sm font-medium text-white">{rightTitle}</h3>
          </div>
        )}
        <div className="flex-1 overflow-hidden">
          {rightComponent}
        </div>
      </div>
    </div>
  );
}
