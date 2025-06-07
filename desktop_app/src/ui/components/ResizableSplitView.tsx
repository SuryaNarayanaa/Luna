import { useState, useRef, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { GripVertical, RotateCcw, Maximize2, Minimize2 } from 'lucide-react';

interface ResizableSplitViewProps {
  leftComponent: React.ReactNode;
  rightComponent: React.ReactNode;
  initialSplitRatio?: number;
  minLeftWidth?: number;
  minRightWidth?: number;
  maxLeftWidth?: number;
  maxRightWidth?: number;
  onSplitRatioChange?: (ratio: number) => void;
  leftTitle?: string;
  rightTitle?: string;
  className?: string;
}

export function ResizableSplitView({
  leftComponent,
  rightComponent,
  initialSplitRatio = 0.5,
  minLeftWidth = 300,
  minRightWidth = 300,
  maxLeftWidth = 0.8,
  maxRightWidth = 0.8,
  onSplitRatioChange,
  leftTitle = 'Left Panel',
  rightTitle = 'Right Panel',
  className = ''
}: ResizableSplitViewProps) {
  const [splitRatio, setSplitRatio] = useState(initialSplitRatio);
  const [isDragging, setIsDragging] = useState(false);
  const [isLeftCollapsed, setIsLeftCollapsed] = useState(false);
  const [isRightCollapsed, setIsRightCollapsed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStartX = useRef<number>(0);
  const dragStartRatio = useRef<number>(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragStartX.current = e.clientX;
    dragStartRatio.current = splitRatio;
    
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [splitRatio]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !containerRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const containerWidth = containerRect.width;
    const deltaX = e.clientX - dragStartX.current;
    const deltaRatio = deltaX / containerWidth;
    
    let newRatio = dragStartRatio.current + deltaRatio;
    
    // Apply constraints
    const minLeftRatio = minLeftWidth / containerWidth;
    const minRightRatio = minRightWidth / containerWidth;
    const maxLeftRatio = typeof maxLeftWidth === 'number' && maxLeftWidth <= 1 ? maxLeftWidth : maxLeftWidth / containerWidth;
    const maxRightRatio = typeof maxRightWidth === 'number' && maxRightWidth <= 1 ? maxRightWidth : maxRightWidth / containerWidth;
    
    newRatio = Math.max(minLeftRatio, Math.min(1 - minRightRatio, newRatio));
    newRatio = Math.max(1 - maxRightRatio, Math.min(maxLeftRatio, newRatio));
    
    setSplitRatio(newRatio);
    onSplitRatioChange?.(newRatio);
  }, [isDragging, minLeftWidth, minRightWidth, maxLeftWidth, maxRightWidth, onSplitRatioChange]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const resetSplit = () => {
    setSplitRatio(0.5);
    onSplitRatioChange?.(0.5);
  };

  const toggleLeftPanel = () => {
    if (isLeftCollapsed) {
      setSplitRatio(0.5);
      setIsLeftCollapsed(false);
    } else {
      setSplitRatio(0.02);
      setIsLeftCollapsed(true);
    }
  };

  const toggleRightPanel = () => {
    if (isRightCollapsed) {
      setSplitRatio(0.5);
      setIsRightCollapsed(false);
    } else {
      setSplitRatio(0.98);
      setIsRightCollapsed(true);
    }
  };

  const leftWidth = isLeftCollapsed ? '2%' : `${splitRatio * 100}%`;
  const rightWidth = isRightCollapsed ? '2%' : `${(1 - splitRatio) * 100}%`;

  return (
    <div ref={containerRef} className={`flex h-full relative ${className}`}>
      {/* Left Panel */}
      <motion.div
        className="overflow-hidden bg-zinc-900 border-r border-zinc-800 relative"
        style={{ width: leftWidth }}
        animate={{ width: leftWidth }}
        transition={{ duration: 0.2, ease: 'easeInOut' }}
      >
        {/* Left Panel Header */}
        <div className="h-10 bg-zinc-800 border-b border-zinc-700 flex items-center justify-between px-3 flex-shrink-0">
          <h3 className={`text-sm font-medium text-zinc-300 ${isLeftCollapsed ? 'hidden' : ''}`}>
            {leftTitle}
          </h3>
          <div className="flex items-center gap-1">
            {!isLeftCollapsed && (
              <button
                onClick={toggleLeftPanel}
                className="p-1 text-zinc-400 hover:text-white hover:bg-zinc-700 rounded transition-colors"
                title="Collapse panel"
              >
                <Minimize2 className="w-3 h-3" />
              </button>
            )}
            {isLeftCollapsed && (
              <button
                onClick={toggleLeftPanel}
                className="p-1 text-zinc-400 hover:text-white hover:bg-zinc-700 rounded transition-colors"
                title="Expand panel"
              >
                <Maximize2 className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
        
        {/* Left Panel Content */}
        <div className={`flex-1 overflow-hidden ${isLeftCollapsed ? 'hidden' : ''}`}>
          {leftComponent}
        </div>
      </motion.div>

      {/* Resizer Handle */}
      <div
        className={`w-1 bg-zinc-700 hover:bg-blue-500 cursor-col-resize relative group transition-colors duration-150 ${
          isDragging ? 'bg-blue-500' : ''
        }`}
        onMouseDown={handleMouseDown}
      >
        {/* Resize Handle Grip */}
        <div className="absolute inset-y-0 left-1/2 transform -translate-x-1/2 w-3 flex items-center justify-center">
          <GripVertical className="w-3 h-3 text-zinc-500 group-hover:text-blue-400 transition-colors" />
        </div>
        
        {/* Reset Button */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={resetSplit}
            className="p-1 bg-zinc-800 border border-zinc-600 rounded text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors"
            title="Reset split (50/50)"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Right Panel */}
      <motion.div
        className="overflow-hidden bg-zinc-900 relative"
        style={{ width: rightWidth }}
        animate={{ width: rightWidth }}
        transition={{ duration: 0.2, ease: 'easeInOut' }}
      >
        {/* Right Panel Header */}
        <div className="h-10 bg-zinc-800 border-b border-zinc-700 flex items-center justify-between px-3 flex-shrink-0">
          <h3 className={`text-sm font-medium text-zinc-300 ${isRightCollapsed ? 'hidden' : ''}`}>
            {rightTitle}
          </h3>
          <div className="flex items-center gap-1">
            {!isRightCollapsed && (
              <button
                onClick={toggleRightPanel}
                className="p-1 text-zinc-400 hover:text-white hover:bg-zinc-700 rounded transition-colors"
                title="Collapse panel"
              >
                <Minimize2 className="w-3 h-3" />
              </button>
            )}
            {isRightCollapsed && (
              <button
                onClick={toggleRightPanel}
                className="p-1 text-zinc-400 hover:text-white hover:bg-zinc-700 rounded transition-colors"
                title="Expand panel"
              >
                <Maximize2 className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
        
        {/* Right Panel Content */}
        <div className={`flex-1 overflow-hidden ${isRightCollapsed ? 'hidden' : ''}`}>
          {rightComponent}
        </div>
      </motion.div>
    </div>
  );
}
