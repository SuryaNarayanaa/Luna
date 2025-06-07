import { Sun, Moon, Save, Clock, Zap } from 'lucide-react';

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
  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const getAutosaveIcon = () => {
    switch (autosaveStatus) {
      case 'saved':
        return <Save className="w-4 h-4 text-green-500" />;
      case 'saving':
        return <Zap className="w-4 h-4 text-yellow-500 animate-pulse" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-orange-500" />;
    }
  };

  const getAutosaveText = () => {
    switch (autosaveStatus) {
      case 'saved':
        return 'Saved';
      case 'saving':
        return 'Saving...';
      case 'pending':
        return 'Pending';
    }
  };

  return (
    <div className="h-12 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between px-4">
      {/* Left Section - Logo & Project Info */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
            <span className="text-white text-xs font-bold">L</span>
          </div>
          <span className="text-sm font-medium text-zinc-200">Luna</span>
        </div>
        
        <div className="text-zinc-500">•</div>
        
        <div className="flex items-center gap-2">
          <span className="text-sm text-zinc-300 max-w-64 truncate">
            {projectName}
          </span>
          <div className="flex items-center gap-1 text-xs text-zinc-500">
            {getAutosaveIcon()}
            <span>{getAutosaveText()}</span>
          </div>
        </div>
      </div>

      {/* Center Section - Timeline Info */}
      <div className="flex items-center gap-4 text-sm text-zinc-400">
        <span>{formatTime(currentTime)} / {formatTime(duration)}</span>
      </div>

      {/* Right Section - Global Controls */}
      <div className="flex items-center gap-2">
        {/* Hotkey Info */}
        <div className="hidden md:flex items-center gap-2 text-xs text-zinc-500 mr-4">
          <kbd className="px-1.5 py-0.5 bg-zinc-800 rounded border border-zinc-700">⌘P</kbd>
          <span>Play</span>
          <kbd className="px-1.5 py-0.5 bg-zinc-800 rounded border border-zinc-700">⌘E</kbd>
          <span>Export</span>
          <kbd className="px-1.5 py-0.5 bg-zinc-800 rounded border border-zinc-700">⌘R</kbd>
          <span>Regen</span>
        </div>

        {/* Theme Toggle */}
        <button
          onClick={onToggleTheme}
          className="p-2 rounded-lg hover:bg-zinc-800 transition-colors"
          title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
        >
          {isDark ? (
            <Sun className="w-4 h-4 text-zinc-400" />
          ) : (
            <Moon className="w-4 h-4 text-zinc-400" />
          )}
        </button>
      </div>
    </div>
  );
}
