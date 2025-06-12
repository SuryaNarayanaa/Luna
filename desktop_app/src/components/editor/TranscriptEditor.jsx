import React, { useState, useRef, useEffect } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { 
  Play, 
  Pause, 
  Edit, 
  RotateCcw, 
  Save, 
  X, 
  ChevronRight,
  Clock,
  User,
  Search,
  Filter,
  Volume2,
  MousePointer,
  Keyboard,
  SkipBack,
  SkipForward,
  Wand2,
  Mic,
  Eye,
  CheckCircle,
  XCircle,
  Sliders,
  Zap,
  Settings,
  ChevronDown,
  ChevronUp,
  Scissors,
  Copy,
  Trash2,
  RotateCw,
  PanelRightOpen,
  PanelRightClose
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Slider } from '../ui/Slider';

// Macro configurations
const macroOptions = [
  {
    id: 'removeFiller',
    name: 'Remove Fillers',
    description: 'Remove "um", "uh", "like", "you know"',
    icon: Filter,
    color: 'text-blue-400',
    settings: {
      aggressiveness: { min: 1, max: 10, default: 5, label: 'Aggressiveness' },
      preserveNatural: { default: true, label: 'Preserve Natural Flow' }
    }
  },
  {
    id: 'adjustPacing',
    name: 'Adjust Pacing',
    description: 'Optimize speech rhythm and pauses',
    icon: Clock,
    color: 'text-green-400',
    settings: {
      paceMultiplier: { min: 0.5, max: 2, default: 1, step: 0.1, label: 'Pace Multiplier' },
      pauseDuration: { min: 0.1, max: 2, default: 0.5, step: 0.1, label: 'Pause Duration (s)' }
    }
  },
  {
    id: 'removeStutter',
    name: 'Remove Stutters',
    description: 'Clean up repeated words and sounds',
    icon: Mic,
    color: 'text-orange-400',
    settings: {
      sensitivity: { min: 1, max: 10, default: 7, label: 'Detection Sensitivity' },
      keepFirst: { default: true, label: 'Keep First Occurrence' }
    }
  },
  {
    id: 'enhanceClarity',
    name: 'Enhance Clarity',
    description: 'Improve pronunciation and enunciation',
    icon: Volume2,
    color: 'text-purple-400',
    settings: {
      enhancement: { min: 1, max: 10, default: 5, label: 'Enhancement Level' },
      preserveAccent: { default: true, label: 'Preserve Accent' }
    }
  }
];

export default function TranscriptEditor({
  transcription,
  speakers,
  currentTime,
  isPlaying,
  duration,
  volume,
  onSegmentEdit,
  onSegmentRegenerate,
  onSeek,
  onPlay,
  onPause,
  // New props for integrated editing
  selectedSegment,
  undoStack = [],
  redoStack = [],
  macroSettings = {},
  onSegmentSelect,
  onMacroApply,
  onMacroPreview,
  onUndo,
  onRedo,
  onMacroSettingsChange
}) {
  const [editingSegment, setEditingSegment] = useState(null);
  const [editText, setEditText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSpeaker, setSelectedSpeaker] = useState('all');
  const [autoScroll, setAutoScroll] = useState(true);
  const [showEditingTools, setShowEditingTools] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [previewResults, setPreviewResults] = useState(null);
  const [processingMacro, setProcessingMacro] = useState(null);
  const [activeEditingSegment, setActiveEditingSegment] = useState(null);
  
  const segmentRefs = useRef({});
  const containerRef = useRef(null);

  // Auto-scroll to current segment
  useEffect(() => {
    if (autoScroll) {
      const currentSegment = transcription.find(
        seg => currentTime >= seg.start && currentTime <= seg.end
      );
      if (currentSegment && segmentRefs.current[currentSegment.id]) {
        segmentRefs.current[currentSegment.id].scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
      }
    }
  }, [currentTime, autoScroll, transcription]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  const handleEditStart = (segment) => {
    setEditingSegment(segment.id);
    setEditText(segment.text);
    setActiveEditingSegment(segment);
    if (onSegmentSelect) {
      onSegmentSelect(segment);
    }
  };

  const handleEditSave = () => {
    if (editingSegment) {
      onSegmentEdit(editingSegment, editText);
      setEditingSegment(null);
      setEditText('');
      setActiveEditingSegment(null);
      setShowEditingTools(false);
    }
  };

  const handleEditCancel = () => {
    setEditingSegment(null);
    setEditText('');
    setActiveEditingSegment(null);
    setShowEditingTools(false);
  };

  // Macro processing functions
  const simulateMacroProcessing = async (macroId, segment, settings) => {
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    let processedText = segment.text;
    
    switch (macroId) {
      case 'removeFiller':
        processedText = processedText.replace(/\b(um|uh|like|you know|actually)\b/gi, '');
        processedText = processedText.replace(/\s+/g, ' ').trim();
        break;
      case 'adjustPacing':
        processedText = processedText.replace(/\./g, '... ');
        break;
      case 'removeStutter':
        processedText = processedText.replace(/\b(\w+)\s+\1\b/gi, '$1');
        break;
      case 'enhanceClarity':
        processedText = processedText.replace(/\b(gonna|wanna|gotta)\b/gi, (match) => {
          const replacements = { gonna: 'going to', wanna: 'want to', gotta: 'got to' };
          return replacements[match.toLowerCase()];
        });
        break;
    }
    
    return {
      originalText: segment.text,
      processedText,
      confidence: Math.random() * 0.3 + 0.7,
      changes: Math.floor(Math.random() * 5) + 1
    };
  };

  const handleMacroPreview = async (macroId) => {
    if (!activeEditingSegment) return;
    
    setProcessingMacro(macroId);
    setPreviewMode(true);
    
    try {
      const result = await simulateMacroProcessing(macroId, activeEditingSegment, macroSettings[macroId] || {});
      setPreviewResults(result);
      setEditText(result.processedText);
      if (onMacroPreview) {
        onMacroPreview(macroId, result);
      }
    } catch (error) {
      console.error('Macro preview failed:', error);
    } finally {
      setProcessingMacro(null);
    }
  };

  const handleMacroApply = async (macroId) => {
    if (!activeEditingSegment) return;
    
    try {
      const result = await simulateMacroProcessing(macroId, activeEditingSegment, macroSettings[macroId] || {});
      setEditText(result.processedText);
      if (onMacroApply) {
        onMacroApply(macroId, activeEditingSegment.id, result);
      }
    } catch (error) {
      console.error('Macro apply failed:', error);
    }
  };

  const getSpeaker = (speakerId) => {
    return speakers.find(s => s.id === speakerId);
  };  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      handleEditSave();
    } else if (e.key === 'Escape') {
      handleEditCancel();
    }
  };

  // Filter transcription based on search and speaker
  const filteredTranscription = transcription.filter(segment => {
    const matchesSearch = searchQuery === '' || 
      segment.text.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSpeaker = selectedSpeaker === 'all' || 
      segment.speaker === selectedSpeaker;
    return matchesSearch && matchesSpeaker;
  });

  // Keyboard shortcuts for transcript editor
  useHotkeys('cmd+f, ctrl+f', (e) => {
    e.preventDefault();
    document.querySelector('input[placeholder="Search transcript..."]')?.focus();
  });

  useHotkeys('j', () => {
    const currentIndex = filteredTranscription.findIndex(
      seg => currentTime >= seg.start && currentTime <= seg.end
    );
    if (currentIndex < filteredTranscription.length - 1) {
      onSeek(filteredTranscription[currentIndex + 1].start);
    }
  });

  useHotkeys('k', () => {
    const currentIndex = filteredTranscription.findIndex(
      seg => currentTime >= seg.start && currentTime <= seg.end
    );
    if (currentIndex > 0) {
      onSeek(filteredTranscription[currentIndex - 1].start);
    }
  });

  useHotkeys('e', () => {
    const currentSegment = filteredTranscription.find(
      seg => currentTime >= seg.start && currentTime <= seg.end
    );
    if (currentSegment && !editingSegment) {
      handleEditStart(currentSegment);
    }
  });  return (
    <div className="flex-1 flex bg-zinc-950 h-full">
      {/* Main Transcript Area */}
      <div className="flex-1 flex flex-col transition-all duration-300">
        {/* Enhanced Header */}
        <div className="border-b border-zinc-800 bg-zinc-900/50 flex-shrink-0">
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-lg font-semibold text-white">Transcript Editor</h2>
                <div className="text-sm text-zinc-400 mt-1">
                  {filteredTranscription.length} segments • {formatTime(duration)} • {speakers.length} speakers
                </div>
              </div>
              
              {/* Controls */}
              <div className="flex items-center space-x-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setAutoScroll(!autoScroll)}
                  className={`${autoScroll ? 'bg-blue-600 text-white' : 'text-zinc-400'}`}
                >
                  Auto-scroll
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowEditingTools(!showEditingTools)}
                  className={`${showEditingTools ? 'bg-purple-600 text-white' : 'text-zinc-400'}`}
                  title="Toggle editing tools"
                >
                  {showEditingTools ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={isPlaying ? onPause : onPlay}
                  className="text-zinc-300"
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </Button>
              </div>
            </div>            {/* Search and Filter Bar */}
            <div className="flex items-center space-x-3">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Search transcript..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <select
                  value={selectedSpeaker}
                  onChange={(e) => setSelectedSpeaker(e.target.value)}
                  className="pl-10 pr-8 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Speakers</option>
                  {speakers.map(speaker => (
                    <option key={speaker.id} value={speaker.id}>
                      {speaker.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Transcript Content */}
        <div 
          ref={containerRef}
          className="flex-1 overflow-y-auto overflow-x-hidden"
          style={{ maxHeight: 'calc(100vh - 200px)' }}
        >
          <div className="p-4 space-y-3">
            {filteredTranscription.map((segment, index) => {
              const speaker = getSpeaker(segment.speaker);
              const isActive = currentTime >= segment.start && currentTime <= segment.end;
              const isEditing = editingSegment === segment.id;
              const duration = segment.end - segment.start;

              return (
                <div
                  key={segment.id}
                  ref={el => segmentRefs.current[segment.id] = el}
                  className={`group relative p-4 rounded-lg border-2 transition-all duration-200 ${
                    isActive 
                      ? 'border-blue-500 bg-blue-500/10 shadow-lg shadow-blue-500/20' 
                      : 'border-zinc-700/50 bg-zinc-800/50 hover:border-zinc-600 hover:bg-zinc-800/80'
                  }`}
                >
                  {/* Segment Header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      {/* Speaker Avatar */}
                      <div className="flex items-center space-x-2">
                        <div 
                          className="w-4 h-4 rounded-full ring-2 ring-zinc-600"
                          style={{ backgroundColor: speaker?.color || '#666' }}
                        />
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-white">
                            {speaker?.name || 'Unknown Speaker'}
                          </span>
                          <div className="flex items-center space-x-2 text-xs text-zinc-400">
                            <Clock className="w-3 h-3" />
                            <span>{formatTime(segment.start)} - {formatTime(segment.end)}</span>
                            <span>({formatTime(duration)})</span>
                            <span className="text-zinc-500">•</span>
                            <span className={`${segment.confidence > 0.9 ? 'text-green-400' : segment.confidence > 0.7 ? 'text-yellow-400' : 'text-red-400'}`}>
                              {Math.round(segment.confidence * 100)}% confidence
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Segment Controls */}
                    <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onSeek(segment.start)}
                        className="text-zinc-400 hover:text-white h-8 w-8 p-0"
                        title="Jump to segment"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          handleEditStart(segment);
                          setShowEditingTools(true);
                        }}
                        className="text-zinc-400 hover:text-white h-8 w-8 p-0"
                        title="Edit segment"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onSegmentRegenerate(segment.id)}
                        className="text-zinc-400 hover:text-orange-400 h-8 w-8 p-0"
                        title="Regenerate with TTS"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Segment Content */}
                  {isEditing ? (
                    <div className="space-y-3">
                      <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="w-full p-3 bg-zinc-700 border border-zinc-600 rounded-lg text-white resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                        rows={Math.max(2, Math.ceil(editText.length / 80))}
                        autoFocus
                      />
                      <div className="flex items-center justify-between">
                        <div className="text-xs text-zinc-400">
                          Press Ctrl+Enter to save, Esc to cancel
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleEditCancel}
                            className="text-zinc-400 hover:text-white"
                          >
                            <X className="w-4 h-4 mr-1" />
                            Cancel
                          </Button>
                          <Button
                            variant="default"
                            size="sm"
                            onClick={handleEditSave}
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                          >
                            <Save className="w-4 h-4 mr-1" />
                            Save
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div 
                      className="text-white leading-relaxed cursor-pointer hover:bg-zinc-700/30 p-2 rounded transition-colors"
                      onClick={() => handleEditStart(segment)}
                    >
                      {searchQuery && segment.text.toLowerCase().includes(searchQuery.toLowerCase()) ? (
                        <span
                          dangerouslySetInnerHTML={{
                            __html: segment.text.replace(
                              new RegExp(searchQuery, 'gi'),
                              match => `<mark class="bg-yellow-400 text-black px-1 rounded">${match}</mark>`
                            )
                          }}
                        />
                      ) : (
                        segment.text
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {filteredTranscription.length === 0 && (
              <div className="text-center py-12">
                <div className="text-zinc-400 mb-2">No segments found</div>
                <div className="text-zinc-500 text-sm">
                  Try adjusting your search or filter criteria
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Controls */}
        <div className="p-4 border-t border-zinc-800 flex items-center justify-between flex-shrink-0 bg-zinc-900/50">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              onClick={isPlaying ? onPause : onPlay}
              className="text-white"
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
            <div className="text-sm text-zinc-400">
              {Math.round(currentTime)}s / {Math.round(duration)}s
            </div>
          </div>
          
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <Keyboard className="w-3 h-3" />
            <span>J/K: Next/Prev • E: Edit • ⌘F: Search • Space: Play/Pause</span>
          </div>
        </div>
      </div>      {/* Editing Tools Sidebar */}
      {showEditingTools && (
        <div className="w-80 border-l border-zinc-800 bg-zinc-950 flex flex-col flex-shrink-0">
          <div className="p-4 border-b border-zinc-800">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Editing Tools</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowEditingTools(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            {activeEditingSegment && (
              <div className="text-sm text-zinc-400 mt-1">
                Editing: {getSpeaker(activeEditingSegment.speaker)?.name || 'Unknown'} • {formatTime(activeEditingSegment.start)}
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Macro Tools */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-white flex items-center gap-2">
                <Wand2 className="w-4 h-4" />
                AI Macros
              </h4>
              
              {macroOptions.map((macro) => {
                const Icon = macro.icon;
                const isProcessing = processingMacro === macro.id;
                
                return (
                  <div key={macro.id} className="bg-zinc-800/50 rounded-lg p-3 border border-zinc-700">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Icon className={`w-4 h-4 ${macro.color}`} />
                        <div>
                          <h5 className="text-sm font-medium text-white">{macro.name}</h5>
                          <p className="text-xs text-zinc-400">{macro.description}</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex gap-2 mt-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleMacroPreview(macro.id)}
                        disabled={!activeEditingSegment || isProcessing}
                        className="flex-1 text-zinc-300 hover:text-white"
                      >
                        {isProcessing ? (
                          <>
                            <div className="w-3 h-3 border border-zinc-400 border-t-transparent rounded-full animate-spin mr-1" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <Eye className="w-3 h-3 mr-1" />
                            Preview
                          </>
                        )}
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleMacroApply(macro.id)}
                        disabled={!activeEditingSegment || isProcessing}
                        className="flex-1 bg-blue-600 hover:bg-blue-700"
                      >
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Apply
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Preview Results */}
            {previewResults && (
              <div className="bg-zinc-800/50 rounded-lg p-3 border border-blue-700">
                <h5 className="text-sm font-medium text-white mb-2 flex items-center gap-2">
                  <Eye className="w-4 h-4 text-blue-400" />
                  Preview Results
                </h5>
                <div className="space-y-2 text-xs">
                  <div>
                    <span className="text-zinc-400">Changes: </span>
                    <span className="text-green-400">{previewResults.changes} improvements</span>
                  </div>
                  <div>
                    <span className="text-zinc-400">Confidence: </span>
                    <span className="text-blue-400">{Math.round(previewResults.confidence * 100)}%</span>
                  </div>
                </div>
              </div>
            )}

            {/* Undo/Redo Controls */}
            {(undoStack.length > 0 || redoStack.length > 0) && (
              <div className="bg-zinc-800/50 rounded-lg p-3 border border-zinc-700">
                <h5 className="text-sm font-medium text-white mb-2 flex items-center gap-2">
                  <RotateCcw className="w-4 h-4" />
                  History
                </h5>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onUndo}
                    disabled={undoStack.length === 0}
                    className="flex-1 text-zinc-300 hover:text-white"
                  >
                    <RotateCcw className="w-3 h-3 mr-1" />
                    Undo ({undoStack.length})
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onRedo}
                    disabled={redoStack.length === 0}
                    className="flex-1 text-zinc-300 hover:text-white"
                  >
                    <RotateCw className="w-3 h-3 mr-1" />
                    Redo ({redoStack.length})
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
