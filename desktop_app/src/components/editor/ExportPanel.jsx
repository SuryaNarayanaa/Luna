import React, { useState, useCallback } from 'react';
import { 
  Download, 
  FileText, 
  Music, 
  User, 
  Settings, 
  CheckCircle,
  Clock,
  AlertCircle,
  FolderOpen,
  Copy,
  Share
} from 'lucide-react';
import { Button } from '../ui/Button';

export default function ExportPanel({
  transcriptSegments,
  speakers,
  tracks,
  exportSettings,
  onExportSettingsChange,
  onExport,
  className = ''
}) {
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportResults, setExportResults] = useState(null);
  const [exportType, setExportType] = useState('audio');

  const audioFormats = [
    { id: 'wav', name: 'WAV', description: 'Uncompressed, highest quality', extension: '.wav' },
    { id: 'mp3', name: 'MP3', description: 'Compressed, smaller file size', extension: '.mp3' },
    { id: 'flac', name: 'FLAC', description: 'Lossless compression', extension: '.flac' },
    { id: 'aac', name: 'AAC', description: 'Optimized for streaming', extension: '.aac' }
  ];

  const transcriptFormats = [
    { id: 'srt', name: 'SRT', description: 'SubRip subtitle format', extension: '.srt' },
    { id: 'vtt', name: 'WebVTT', description: 'Web Video Text Tracks', extension: '.vtt' },
    { id: 'txt', name: 'Plain Text', description: 'Simple text file', extension: '.txt' },
    { id: 'json', name: 'JSON', description: 'Machine-readable format', extension: '.json' },
    { id: 'docx', name: 'Word Document', description: 'Microsoft Word format', extension: '.docx' }
  ];

  const qualityOptions = [
    { id: 'low', name: 'Low (96 kbps)', bitrate: 96 },
    { id: 'medium', name: 'Medium (192 kbps)', bitrate: 192 },
    { id: 'high', name: 'High (320 kbps)', bitrate: 320 },
    { id: 'lossless', name: 'Lossless', bitrate: null }
  ];

  const handleExport = useCallback(async (type) => {
    setIsExporting(true);
    setExportProgress(0);
    setExportResults(null);

    try {
      // Simulate export process
      const result = await simulateExport(type, exportSettings);
      
      // Simulate progress updates
      for (let i = 0; i <= 100; i += 10) {
        setExportProgress(i);
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      setExportResults(result);
      onExport?.(type, result);
    } catch (error) {
      console.error('Export failed:', error);
      setExportResults({ error: error.message });
    } finally {
      setIsExporting(false);
    }
  }, [exportSettings, onExport]);

  // Simulate export process for demo
  const simulateExport = async (type, settings) => {
    await new Promise(resolve => setTimeout(resolve, 2000));

    const baseResult = {
      type,
      timestamp: Date.now(),
      settings: { ...settings }
    };

    switch (type) {
      case 'audio':
        return {
          ...baseResult,
          files: [
            {
              name: `podcast_final.${settings.format}`,
              size: '45.2 MB',
              path: `/exports/podcast_final.${settings.format}`,
              duration: '15:32'
            }
          ]
        };

      case 'transcript':
        return {
          ...baseResult,
          files: [
            {
              name: `transcript.${settings.transcriptFormat}`,
              size: '12.4 KB',
              path: `/exports/transcript.${settings.transcriptFormat}`,
              segments: transcriptSegments.length
            }
          ]
        };

      case 'speakers':
        return {
          ...baseResult,
          files: speakers.map(speaker => ({
            name: `${speaker.name.replace(/\s+/g, '_')}.${settings.format}`,
            size: `${(Math.random() * 20 + 5).toFixed(1)} MB`,
            path: `/exports/speakers/${speaker.name.replace(/\s+/g, '_')}.${settings.format}`,
            speaker: speaker.name
          }))
        };

      case 'bundle':
        return {
          ...baseResult,
          files: [
            {
              name: 'podcast_bundle.zip',
              size: '78.6 MB',
              path: '/exports/podcast_bundle.zip',
              contents: [
                'podcast_final.wav',
                'transcript.srt',
                'speaker_tracks/',
                'metadata.json'
              ]
            }
          ]
        };

      default:
        throw new Error(`Unknown export type: ${type}`);
    }
  };

  const calculateTotalDuration = () => {
    return transcriptSegments.reduce((total, segment) => 
      total + (segment.end - segment.start), 0
    );
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getExportDescription = (type) => {
    switch (type) {
      case 'audio':
        return 'Export the final merged audio file';
      case 'transcript':
        return 'Export transcript in various formats';
      case 'speakers':
        return 'Export separate audio tracks per speaker';
      case 'bundle':
        return 'Export everything in a single archive';
      default:
        return '';
    }
  };

  return (
    <div className={`flex-1 flex flex-col bg-zinc-950 overflow-hidden ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-zinc-800 bg-zinc-900/50">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-lg font-semibold text-white">Export</h2>
            <div className="text-sm text-zinc-400">
              {transcriptSegments.length} segments • {speakers.length} speakers • {formatDuration(calculateTotalDuration())}
            </div>
          </div>

          {/* Quick Export */}
          <Button
            onClick={() => handleExport('audio')}
            disabled={isExporting}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Download className="w-4 h-4 mr-1" />
            Quick Export
          </Button>
        </div>

        {/* Export Type Tabs */}
        <div className="flex gap-1 bg-zinc-800 rounded p-1">
          {[
            { id: 'audio', name: 'Audio', icon: Music },
            { id: 'transcript', name: 'Transcript', icon: FileText },
            { id: 'speakers', name: 'Speaker Tracks', icon: User },
            { id: 'bundle', name: 'Complete Bundle', icon: FolderOpen }
          ].map(({ id, name, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setExportType(id)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded text-xs transition-all ${
                exportType === id
                  ? 'bg-blue-600 text-white'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-700'
              }`}
            >
              <Icon className="w-3 h-3" />
              {name}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-6">
          {/* Export Progress */}
          {isExporting && (
            <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded">
              <div className="flex items-center gap-3 mb-3">
                <div className="animate-spin w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full" />
                <div>
                  <div className="text-sm text-blue-300">Exporting {exportType}...</div>
                  <div className="text-xs text-blue-400">{exportProgress}% complete</div>
                </div>
              </div>
              <div className="w-full bg-zinc-700 rounded-full h-2">
                <div 
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${exportProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Export Results */}
          {exportResults && !isExporting && (
            <div className={`p-4 rounded border ${
              exportResults.error 
                ? 'bg-red-500/10 border-red-500/30' 
                : 'bg-green-500/10 border-green-500/30'
            }`}>
              <div className="flex items-center gap-2 mb-3">
                {exportResults.error ? (
                  <AlertCircle className="w-4 h-4 text-red-400" />
                ) : (
                  <CheckCircle className="w-4 h-4 text-green-400" />
                )}
                <span className={`text-sm ${
                  exportResults.error ? 'text-red-300' : 'text-green-300'
                }`}>
                  {exportResults.error ? 'Export failed' : 'Export completed successfully'}
                </span>
              </div>

              {!exportResults.error && exportResults.files && (
                <div className="space-y-2">
                  {exportResults.files.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-zinc-800/30 rounded">
                      <div className="flex items-center gap-2">
                        <FileText className="w-3 h-3 text-zinc-400" />
                        <span className="text-sm text-zinc-300">{file.name}</span>
                        <span className="text-xs text-zinc-500">({file.size})</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-white">
                          <Copy className="w-3 h-3" />
                        </Button>
                        <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-white">
                          <Share className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {exportResults.error && (
                <div className="text-xs text-red-400">{exportResults.error}</div>
              )}
            </div>
          )}

          {/* Export Settings */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-white flex items-center gap-2">
              <Settings className="w-4 h-4" />
              {exportType.charAt(0).toUpperCase() + exportType.slice(1)} Settings
            </h3>

            {exportType === 'audio' && (
              <div className="space-y-4">
                {/* Audio Format */}
                <div className="space-y-2">
                  <label className="text-xs text-zinc-400">Format</label>
                  <div className="grid grid-cols-2 gap-2">
                    {audioFormats.map(format => (
                      <button
                        key={format.id}
                        onClick={() => onExportSettingsChange({ format: format.id })}
                        className={`p-3 rounded border text-left transition-all ${
                          exportSettings.format === format.id
                            ? 'border-blue-500 bg-blue-500/20'
                            : 'border-zinc-700 hover:border-zinc-600'
                        }`}
                      >
                        <div className="text-sm text-white">{format.name}</div>
                        <div className="text-xs text-zinc-400">{format.description}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Quality */}
                <div className="space-y-2">
                  <label className="text-xs text-zinc-400">Quality</label>
                  <select
                    value={exportSettings.quality}
                    onChange={(e) => onExportSettingsChange({ quality: e.target.value })}
                    className="w-full p-2 bg-zinc-800 border border-zinc-700 rounded text-white text-sm"
                  >
                    {qualityOptions.map(option => (
                      <option key={option.id} value={option.id}>
                        {option.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {exportType === 'transcript' && (
              <div className="space-y-4">
                {/* Transcript Format */}
                <div className="space-y-2">
                  <label className="text-xs text-zinc-400">Format</label>
                  <div className="grid grid-cols-1 gap-2">
                    {transcriptFormats.map(format => (
                      <button
                        key={format.id}
                        onClick={() => onExportSettingsChange({ transcriptFormat: format.id })}
                        className={`p-3 rounded border text-left transition-all ${
                          exportSettings.transcriptFormat === format.id
                            ? 'border-blue-500 bg-blue-500/20'
                            : 'border-zinc-700 hover:border-zinc-600'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-sm text-white">{format.name}</div>
                            <div className="text-xs text-zinc-400">{format.description}</div>
                          </div>
                          <span className="text-xs text-zinc-500">{format.extension}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Include Options */}
                <div className="space-y-3">
                  <label className="text-xs text-zinc-400">Include</label>
                  <div className="space-y-2">
                    {[
                      { key: 'includeTimestamps', label: 'Timestamps' },
                      { key: 'includeSpeakers', label: 'Speaker labels' },
                      { key: 'includeConfidence', label: 'Confidence scores' }
                    ].map(option => (
                      <label key={option.key} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={exportSettings[option.key]}
                          onChange={(e) => onExportSettingsChange({ [option.key]: e.target.checked })}
                          className="w-3 h-3 text-blue-600 rounded"
                        />
                        <span className="text-sm text-zinc-300">{option.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {exportType === 'speakers' && (
              <div className="space-y-4">
                {/* Speaker Selection */}
                <div className="space-y-2">
                  <label className="text-xs text-zinc-400">Select Speakers</label>
                  <div className="space-y-2">
                    {speakers.map(speaker => (
                      <label key={speaker.id} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={exportSettings.selectedSpeakers?.includes(speaker.id) ?? true}
                          onChange={(e) => {
                            const current = exportSettings.selectedSpeakers || speakers.map(s => s.id);
                            const updated = e.target.checked
                              ? [...current, speaker.id]
                              : current.filter(id => id !== speaker.id);
                            onExportSettingsChange({ selectedSpeakers: updated });
                          }}
                          className="w-3 h-3 text-blue-600 rounded"
                        />
                        <div 
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: speaker.color }}
                        />
                        <span className="text-sm text-zinc-300">{speaker.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Common Options */}
            <div className="space-y-3">
              <label className="text-xs text-zinc-400">Additional Options</label>
              <div className="space-y-2">
                {[
                  { key: 'includeMetadata', label: 'Include metadata file' },
                  { key: 'normalizeAudio', label: 'Normalize audio levels' },
                  { key: 'removeBackground', label: 'Remove background noise' }
                ].map(option => (
                  <label key={option.key} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={exportSettings[option.key]}
                      onChange={(e) => onExportSettingsChange({ [option.key]: e.target.checked })}
                      className="w-3 h-3 text-blue-600 rounded"
                    />
                    <span className="text-sm text-zinc-300">{option.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Export Actions */}
          <div className="space-y-3">
            <div className="flex gap-2">
              <Button
                onClick={() => handleExport(exportType)}
                disabled={isExporting}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Download className="w-4 h-4 mr-1" />
                Export {exportType.charAt(0).toUpperCase() + exportType.slice(1)}
              </Button>
            </div>
            
            <p className="text-xs text-zinc-500 text-center">
              {getExportDescription(exportType)}
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-zinc-800 bg-zinc-900/30">
        <div className="text-xs text-zinc-500 text-center">
          Files will be saved to your default downloads folder
        </div>
      </div>
    </div>
  );
}
