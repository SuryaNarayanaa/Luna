import { 
  LayoutDashboard, 
  FileText, 
  AudioLines, 
  Download, 
  Settings, 
  Save, 
  FolderOpen 
} from 'lucide-react';
import { Button } from './ui_/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui_/select';
import { cn } from '../lib/utils';

interface LeftSidebarProps {
  activeTab: string;
  currentProject?: string;
  projects: Array<{ id: string; name: string }>;
  onTabChange: (tab: string) => void;
  onProjectChange: (projectId: string) => void;
  onSave: () => void;
  onLoad: () => void;
}

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'transcripts', label: 'Transcripts', icon: FileText },
  { id: 'tracks', label: 'Tracks', icon: AudioLines },
  { id: 'exports', label: 'Exports', icon: Download },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export function LeftSidebar({
  activeTab,
  currentProject,
  projects,
  onTabChange,
  onProjectChange,
  onSave,
  onLoad,
}: LeftSidebarProps) {
  return (
    <div className="w-64 bg-zinc-950 border-r border-zinc-800 flex flex-col">
      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={cn(
                "nav-item w-full",
                activeTab === item.id && "active"
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Project Switcher */}
      <div className="p-4 border-t border-zinc-800 space-y-3">
        <div className="space-y-2">
          <label className="text-xs font-medium text-neutral-400 uppercase tracking-wide">
            Project Session
          </label>
          <Select value={currentProject} onValueChange={onProjectChange}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select project..." />
            </SelectTrigger>
            <SelectContent>
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Save/Load Buttons */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onSave}
            className="flex-1 h-8"
          >
            <Save className="h-3 w-3 mr-1" />
            Save
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onLoad}
            className="flex-1 h-8"
          >
            <FolderOpen className="h-3 w-3 mr-1" />
            Load
          </Button>
        </div>
      </div>
    </div>
  );
}
