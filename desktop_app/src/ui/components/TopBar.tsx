import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Sun, 
  Moon,
  Save,
  Clock,
  Mic,
  Settings
} from 'lucide-react';

interface TopBarProps {
  projectName: string;
  autosaveStatus: 'saved' | 'saving' | 'pending';
  isDark: boolean;
  onToggleTheme: () => void;
  currentTime: number;
  duration: number;
}

export function TopBar({ 
  projectName, 
  autosaveStatus, 
  isDark, 
  onToggleTheme,
  currentTime,
  duration 
}: TopBarProps) {
  const [showHotkeys, setShowHotkeys] = useState(false);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusColor = () => {
    switch (autosaveStatus) {
      case 'saved': return 'text-green-400';
      case 'saving': return 'text-yellow-400';
      case 'pending': return 'text-orange-400';
      default: return 'text-gray-400';
    }
  };

  const getStatusText = () => {
    switch (autosaveStatus) {
      case 'saved': return 'All changes saved';
      case 'saving': return 'Saving...';
      case 'pending': return 'Unsaved changes';
      default: return 'Unknown';
    }
  };

  return (
    <header className="h-12 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between px-4 relative">
      {/* Left Section - Logo & Project */}
      <div className="flex items-center space-x-4">
        {/* Luna Logo */}
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
            <Mic className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-white">Luna</span>
        </div>

        {/* Project Name */}
        <div className="flex items-center space-x-2 text-sm">
          <span className="text-zinc-400">•</span>
          <span className="text-zinc-200 max-w-xs truncate">{projectName}</span>
        </div>

        {/* Autosave Status */}
        <motion.div 
          className="flex items-center space-x-1 text-xs"
          animate={{ scale: autosaveStatus === 'saving' ? [1, 1.05, 1] : 1 }}
          transition={{ duration: 0.5, repeat: autosaveStatus === 'saving' ? Infinity : 0 }}
        >
          <Save className={`w-3 h-3 ${getStatusColor()}`} />
          <span className={getStatusColor()}>{getStatusText()}</span>
        </motion.div>
      </div>

      {/* Center Section - Time Display */}
      <div className="flex items-center space-x-2 text-sm">
        <Clock className="w-4 h-4 text-zinc-400" />
        <span className="text-zinc-300 font-mono">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
      </div>

      {/* Right Section - Controls */}
      <div className="flex items-center space-x-3">
        {/* Hotkeys Info */}
        <div className="relative">
          <button
            onMouseEnter={() => setShowHotkeys(true)}
            onMouseLeave={() => setShowHotkeys(false)}
            className="text-zinc-400 hover:text-zinc-200 transition-colors text-xs px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700"
          >
            Hotkeys
          </button>
          
          {showHotkeys && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute right-0 top-full mt-2 bg-zinc-800 border border-zinc-700 rounded-lg p-3 text-xs text-zinc-300 w-48 z-50"
            >
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span>Play/Pause</span>
                  <span className="text-zinc-500">⌘P</span>
                </div>
                <div className="flex justify-between">
                  <span>Export</span>
                  <span className="text-zinc-500">⌘E</span>
                </div>
                <div className="flex justify-between">
                  <span>Regenerate</span>
                  <span className="text-zinc-500">⌘R</span>
                </div>
                <div className="flex justify-between">
                  <span>Split View</span>
                  <span className="text-zinc-500">⌘⇧T</span>
                </div>
                <div className="flex justify-between">
                  <span>Transcript</span>
                  <span className="text-zinc-500">⌘1</span>
                </div>
                <div className="flex justify-between">
                  <span>Timeline</span>
                  <span className="text-zinc-500">⌘2</span>
                </div>
              </div>
            </motion.div>
          )}
        </div>

        {/* Theme Toggle */}
        <button
          onClick={onToggleTheme}
          className="p-2 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors"
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* Settings */}        <button className="p-2 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors">
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
