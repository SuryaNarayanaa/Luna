import { useState, useEffect } from 'react'
import VideoPlayer from './components/VideoPlayer'
import './App.css'

interface TranscriptionSegment {
  start: number;
  end: number;
  text: string;
}

function App() {
  const [transcriptions, setTranscriptions] = useState<TranscriptionSegment[]>([]);
  const [availableFiles, setAvailableFiles] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<string>('transcription.json');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  const API_BASE = 'http://localhost:8000';

  useEffect(() => {
    loadAvailableFiles();
  }, []);

  useEffect(() => {
    if (selectedFile) {
      loadTranscription(selectedFile);
    }
  }, [selectedFile]);

  const loadAvailableFiles = async () => {
    try {
      const response = await fetch(`${API_BASE}/transcriptions`);
      const data = await response.json();
      setAvailableFiles(data.files);
      if (data.files.length > 0 && !selectedFile) {
        setSelectedFile(data.files[0]);
      }
    } catch (err) {
      setError('Failed to load transcription files');
      console.error('Error loading files:', err);
    }
  };

  const loadTranscription = async (filename: string) => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE}/transcription/${filename}`);
      const data = await response.json();
      
      if (data.error) {
        setError(data.error);
      } else {
        setTranscriptions(data.transcription);
      }
    } catch (err) {
      setError('Failed to load transcription data');
      console.error('Error loading transcription:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading transcription...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <h2>Error</h2>
        <p>{error}</p>
        <button onClick={() => window.location.reload()}>Retry</button>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>LUNA - Video Transcription Player</h1>
        <div className="file-selector">
          <label htmlFor="transcription-select">Transcription: </label>
          <select 
            id="transcription-select"
            value={selectedFile} 
            onChange={(e) => setSelectedFile(e.target.value)}
          >
            {availableFiles.map(file => (
              <option key={file} value={file}>{file}</option>
            ))}
          </select>
        </div>
      </header>
      
      <main className="app-main">
        <VideoPlayer
          videoUrl={`${API_BASE}/video`}
          transcription={transcriptions}
        />
      </main>
    </div>
  )
}

export default App
