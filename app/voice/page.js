'use client';

import { useState, useRef, useEffect } from 'react';
import Nav from '../components/Nav';

const INTENT_LABELS = {
  clock_in: 'Clock In',
  clock_out: 'Clock Out',
  add_comment: 'Add Comment',
  create_daily_log: 'Daily Log',
  update_status: 'Update Status',
  search_job: 'Search Job',
  create_job: 'Create Job',
  unknown: 'Unknown',
};

const INTENT_COLORS = {
  clock_in: '#22c55e',
  clock_out: '#f59e0b',
  add_comment: '#38bdf8',
  create_daily_log: '#a78bfa',
  update_status: '#f472b6',
  search_job: '#6ee7b7',
  create_job: '#5d47fa',
  unknown: '#6b7280',
};

export default function VoiceCommandPage() {
  const [state, setState] = useState('idle'); // idle, recording, processing
  const [transcription, setTranscription] = useState('');
  const [parsedCommand, setParsedCommand] = useState(null);
  const [error, setError] = useState('');
  const [history, setHistory] = useState([]);
  const [executing, setExecuting] = useState(false);
  const [executeResult, setExecuteResult] = useState(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);

  // Load settings from localStorage
  const getApiKey = () => {
    try { return localStorage.getItem('bb_api_key') || ''; } catch { return ''; }
  };
  const getGrantKey = () => {
    try { return localStorage.getItem('bb_grant_key') || ''; } catch { return ''; }
  };

  // Load history from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('bb_voice_history');
      if (saved) setHistory(JSON.parse(saved));
    } catch { /* ok */ }
  }, []);

  const saveHistory = (newHistory) => {
    setHistory(newHistory);
    try { localStorage.setItem('bb_voice_history', JSON.stringify(newHistory.slice(0, 20))); } catch { /* ok */ }
  };

  const startRecording = async () => {
    setError('');
    setTranscription('');
    setParsedCommand(null);
    setExecuteResult(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        await processAudio(blob);
      };

      mediaRecorder.start();
      setState('recording');
    } catch (err) {
      setError('Microphone access denied. Please allow microphone access and try again.');
      setState('idle');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setState('processing');
    }
  };

  const processAudio = async (blob) => {
    setState('processing');
    const apiKey = getApiKey();
    if (!apiKey) {
      setError('Please configure your Anthropic API key in Setup first.');
      setState('idle');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('audio', blob, 'recording.webm');
      formData.append('apiKey', apiKey);

      const res = await fetch('/api/voice/transcribe', { method: 'POST', body: formData });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to process audio');
        setState('idle');
        return;
      }

      setTranscription(data.transcription);
      setParsedCommand({
        intent: data.intent,
        params: data.params,
        confirmation: data.confirmation,
      });
      setState('idle');
    } catch (err) {
      setError('Failed to process audio. Please try again.');
      setState('idle');
    }
  };

  const handleConfirm = async () => {
    if (!parsedCommand) return;
    setExecuting(true);
    setExecuteResult(null);

    const grantKey = getGrantKey();
    const apiKey = getApiKey();

    if (!grantKey) {
      setError('Please configure your JobTread grant key in Setup first.');
      setExecuting(false);
      return;
    }

    try {
      const res = await fetch('/api/voice/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intent: parsedCommand.intent,
          params: parsedCommand.params,
          grantKey,
          apiKey,
        }),
      });
      const data = await res.json();

      setExecuteResult(data);

      // Add to history
      const entry = {
        id: Date.now(),
        transcription,
        intent: parsedCommand.intent,
        confirmation: parsedCommand.confirmation,
        success: data.success,
        message: data.message || data.error,
        timestamp: new Date().toISOString(),
      };
      saveHistory([entry, ...history]);

      setParsedCommand(null);
      setTranscription('');
    } catch (err) {
      setExecuteResult({ success: false, message: 'Execution failed: ' + err.message });
    } finally {
      setExecuting(false);
    }
  };

  const handleCancel = () => {
    setParsedCommand(null);
    setTranscription('');
    setState('idle');
  };

  const handleMicClick = () => {
    if (state === 'recording') {
      stopRecording();
    } else if (state === 'idle') {
      startRecording();
    }
  };

  return (
    <div style={styles.page}>
      <Nav />
      <div style={styles.container}>
        <div style={styles.hero}>
          <h1 style={styles.title}>Voice Commands</h1>
          <p style={styles.subtitle}>Talk to JobTread with your voice</p>
        </div>

        {/* Microphone Button */}
        <div style={styles.micSection}>
          <button
            onClick={handleMicClick}
            disabled={state === 'processing'}
            style={{
              ...styles.micBtn,
              ...(state === 'recording' ? styles.micRecording : {}),
              ...(state === 'processing' ? styles.micProcessing : {}),
            }}
          >
            {state === 'processing' ? (
              <div style={styles.micSpinner} />
            ) : (
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
                <path d="M19 10v2a7 7 0 01-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            )}
          </button>
          <p style={styles.micLabel}>
            {state === 'idle' && 'Tap to speak'}
            {state === 'recording' && 'Listening... tap to stop'}
            {state === 'processing' && 'Processing...'}
          </p>
        </div>

        {/* Error */}
        {error && (
          <div style={styles.errorBox}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
            {error}
          </div>
        )}

        {/* Transcription */}
        {transcription && (
          <div style={styles.transcriptionBox}>
            <div style={styles.transcriptionLabel}>You said:</div>
            <div style={styles.transcriptionText}>"{transcription}"</div>
          </div>
        )}

        {/* Parsed Command */}
        {parsedCommand && (
          <div style={styles.commandBox}>
            <div style={styles.commandHeader}>
              <span
                style={{
                  ...styles.intentBadge,
                  background: (INTENT_COLORS[parsedCommand.intent] || '#6b7280') + '20',
                  color: INTENT_COLORS[parsedCommand.intent] || '#6b7280',
                  borderColor: (INTENT_COLORS[parsedCommand.intent] || '#6b7280') + '40',
                }}
              >
                {INTENT_LABELS[parsedCommand.intent] || parsedCommand.intent}
              </span>
            </div>
            <p style={styles.commandConfirmation}>{parsedCommand.confirmation}</p>
            {parsedCommand.params && Object.keys(parsedCommand.params).length > 0 && (
              <div style={styles.paramsList}>
                {Object.entries(parsedCommand.params).map(([key, value]) => (
                  <div key={key} style={styles.paramItem}>
                    <span style={styles.paramKey}>{key}:</span>
                    <span style={styles.paramValue}>{String(value)}</span>
                  </div>
                ))}
              </div>
            )}
            <div style={styles.commandActions}>
              <button
                onClick={handleConfirm}
                disabled={executing}
                style={styles.confirmBtn}
              >
                {executing ? 'Executing...' : 'Confirm'}
              </button>
              <button onClick={handleCancel} style={styles.cancelBtn}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Execute Result */}
        {executeResult && (
          <div style={{
            ...styles.resultBox,
            borderColor: executeResult.success ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)',
            background: executeResult.success ? 'rgba(34,197,94,0.06)' : 'rgba(239,68,68,0.06)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {executeResult.success ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
              )}
              <span style={{ color: executeResult.success ? '#22c55e' : '#ef4444', fontWeight: 600 }}>
                {executeResult.message || (executeResult.success ? 'Done!' : 'Failed')}
              </span>
            </div>
          </div>
        )}

        {/* History */}
        {history.length > 0 && (
          <div style={styles.historySection}>
            <h2 style={styles.historyTitle}>Recent Commands</h2>
            <div style={styles.historyList}>
              {history.map((entry) => (
                <div key={entry.id} style={styles.historyItem}>
                  <div style={styles.historyTop}>
                    <span
                      style={{
                        ...styles.historyBadge,
                        background: (INTENT_COLORS[entry.intent] || '#6b7280') + '20',
                        color: INTENT_COLORS[entry.intent] || '#6b7280',
                      }}
                    >
                      {INTENT_LABELS[entry.intent] || entry.intent}
                    </span>
                    <span style={styles.historyTime}>
                      {new Date(entry.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: entry.success ? '#22c55e' : '#ef4444',
                      flexShrink: 0,
                    }} />
                  </div>
                  <div style={styles.historyTranscription}>"{entry.transcription}"</div>
                  <div style={styles.historyMessage}>{entry.message}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <style jsx global>{`
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.4); }
          50% { box-shadow: 0 0 0 20px rgba(239,68,68,0); }
        }
        @keyframes spinMic {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    background: '#0a0b0f',
    color: '#e5e7eb',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
  },
  container: {
    maxWidth: '600px',
    margin: '0 auto',
    padding: '0 24px 60px',
  },
  hero: {
    padding: '32px 0 24px',
    textAlign: 'center',
  },
  title: {
    fontSize: '2em',
    fontWeight: 800,
    margin: 0,
    color: '#fff',
    letterSpacing: '-0.03em',
  },
  subtitle: {
    color: '#6b7280',
    margin: '4px 0 0',
    fontSize: '0.9em',
  },
  micSection: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '40px 0',
  },
  micBtn: {
    width: '120px',
    height: '120px',
    borderRadius: '50%',
    border: '3px solid rgba(255,255,255,0.1)',
    background: 'rgba(255,255,255,0.05)',
    color: '#6b7280',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.3s',
    outline: 'none',
  },
  micRecording: {
    background: 'rgba(239,68,68,0.15)',
    borderColor: 'rgba(239,68,68,0.5)',
    color: '#ef4444',
    animation: 'pulse 1.5s ease-in-out infinite',
  },
  micProcessing: {
    background: 'rgba(93,71,250,0.15)',
    borderColor: 'rgba(93,71,250,0.5)',
    color: '#5d47fa',
    cursor: 'default',
  },
  micSpinner: {
    width: '40px',
    height: '40px',
    border: '3px solid rgba(93,71,250,0.2)',
    borderTopColor: '#5d47fa',
    borderRadius: '50%',
    animation: 'spinMic 0.8s linear infinite',
  },
  micLabel: {
    marginTop: '16px',
    color: '#6b7280',
    fontSize: '0.9em',
  },
  errorBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 16px',
    background: 'rgba(239,68,68,0.08)',
    border: '1px solid rgba(239,68,68,0.2)',
    borderRadius: '10px',
    color: '#ef4444',
    fontSize: '0.88em',
    marginBottom: '16px',
  },
  transcriptionBox: {
    padding: '16px 20px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '12px',
    marginBottom: '16px',
  },
  transcriptionLabel: {
    fontSize: '0.75em',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '6px',
  },
  transcriptionText: {
    color: '#e5e7eb',
    fontSize: '1.05em',
    fontStyle: 'italic',
    lineHeight: 1.5,
  },
  commandBox: {
    padding: '20px',
    background: 'rgba(93,71,250,0.06)',
    border: '1px solid rgba(93,71,250,0.2)',
    borderRadius: '12px',
    marginBottom: '16px',
  },
  commandHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '12px',
  },
  intentBadge: {
    padding: '4px 12px',
    borderRadius: '6px',
    fontSize: '0.78em',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    border: '1px solid',
  },
  commandConfirmation: {
    color: '#e5e7eb',
    fontSize: '1em',
    margin: '0 0 12px',
    lineHeight: 1.5,
  },
  paramsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    marginBottom: '16px',
    padding: '10px 12px',
    background: 'rgba(0,0,0,0.2)',
    borderRadius: '8px',
  },
  paramItem: {
    display: 'flex',
    gap: '8px',
    fontSize: '0.85em',
  },
  paramKey: {
    color: '#6b7280',
    fontWeight: 500,
  },
  paramValue: {
    color: '#a78bfa',
  },
  commandActions: {
    display: 'flex',
    gap: '10px',
  },
  confirmBtn: {
    flex: 1,
    padding: '10px 20px',
    background: 'linear-gradient(135deg, #5d47fa 0%, #7c3aed 100%)',
    borderRadius: '10px',
    color: '#fff',
    fontWeight: 600,
    fontSize: '0.9em',
    border: 'none',
    cursor: 'pointer',
    boxShadow: '0 4px 16px rgba(93,71,250,0.35)',
  },
  cancelBtn: {
    flex: 1,
    padding: '10px 20px',
    background: 'rgba(255,255,255,0.05)',
    borderRadius: '10px',
    color: '#9ca3af',
    fontWeight: 600,
    fontSize: '0.9em',
    border: '1px solid rgba(255,255,255,0.1)',
    cursor: 'pointer',
  },
  resultBox: {
    padding: '14px 18px',
    border: '1px solid',
    borderRadius: '10px',
    marginBottom: '16px',
  },
  historySection: {
    marginTop: '40px',
  },
  historyTitle: {
    fontSize: '1.1em',
    fontWeight: 700,
    color: '#fff',
    margin: '0 0 16px',
  },
  historyList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  historyItem: {
    padding: '14px 18px',
    background: 'rgba(255,255,255,0.025)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '10px',
  },
  historyTop: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '6px',
  },
  historyBadge: {
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '0.7em',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  historyTime: {
    fontSize: '0.75em',
    color: '#6b7280',
    marginLeft: 'auto',
  },
  historyTranscription: {
    color: '#9ca3af',
    fontSize: '0.85em',
    fontStyle: 'italic',
    marginBottom: '4px',
  },
  historyMessage: {
    color: '#6b7280',
    fontSize: '0.8em',
  },
};
