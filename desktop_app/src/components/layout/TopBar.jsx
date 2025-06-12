import { Save, Clock, Zap } from 'lucide-react';
import { cn } from '../../utils';

export default function TopBar({
  projectName,
  autosaveStatus
}) {
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
      </div>      {/* Center Section - Spacer */}
      <div className="flex-1"></div>{/* Right Section - Global Controls */}
      <div className="flex items-center gap-2">
        {/* Shortcut Keys Toggle */}
        <div className="relative group">
          <button
            className="text-zinc-400 hover:text-zinc-200 transition-colors text-xs px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700"
          >
            Shortcuts
          </button>
          
          {/* Hover Tooltip */}
          <div className="absolute right-0 top-full mt-2 bg-zinc-800 border border-zinc-700 rounded-lg p-3 text-xs text-zinc-300 w-48 z-50 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            <div className="space-y-1">
              <div className="flex justify-between">
                <span>Play/Pause</span>
                <span className="text-zinc-500">Space</span>
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
              <div className="flex justify-between">
                <span>Edit Segment</span>
                <span className="text-zinc-500">E</span>
              </div>
              <div className="flex justify-between">
                <span>Next/Prev Segment</span>
                <span className="text-zinc-500">J/K</span>
              </div>
              <div className="flex justify-between">
                <span>Search</span>
                <span className="text-zinc-500">⌘F</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
