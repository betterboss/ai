'use client';

import { useState, useRef } from 'react';

export default function TakeoffUploader({ estimateId, apiKey, onTakeoffComplete }) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [takeoffs, setTakeoffs] = useState([]);
  const fileRef = useRef(null);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('Please upload a PDF file');
      return;
    }

    if (!apiKey) {
      setError('API key is required for AI analysis');
      return;
    }

    setUploading(true);
    setError('');
    setProgress('Uploading and analyzing blueprint...');

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('apiKey', apiKey);
      if (estimateId) formData.append('estimateId', estimateId);

      const res = await fetch('/api/takeoff/analyze', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Analysis failed');
      }

      setProgress(`Found ${data.items?.length || 0} items across ${data.page_count} pages`);
      setTakeoffs(prev => [...prev, { fileName: file.name, ...data }]);

      if (onTakeoffComplete) {
        onTakeoffComplete(data);
      }
    } catch (err) {
      setError(err.message);
      setProgress('');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div>
      <div style={styles.uploadArea}>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf"
          onChange={handleUpload}
          disabled={uploading}
          style={styles.fileInput}
        />
        <div style={styles.uploadContent}>
          {uploading ? (
            <div style={styles.uploadSpinner} />
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#a78bfa' }}>
              <path d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          )}
          <span style={styles.uploadLabel}>
            {uploading ? 'Analyzing...' : 'Upload Blueprint PDF'}
          </span>
          <span style={styles.uploadHint}>
            AI extracts quantities from your plans
          </span>
        </div>
      </div>

      {progress && (
        <div style={styles.progress}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          {progress}
        </div>
      )}

      {error && (
        <div style={styles.error}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
          {error}
        </div>
      )}

      {takeoffs.length > 0 && (
        <div style={styles.fileList}>
          {takeoffs.map((t, i) => (
            <div key={i} style={styles.fileItem}>
              <div style={styles.fileIcon}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={styles.fileName}>{t.fileName}</div>
                <div style={styles.fileMeta}>
                  {t.page_count} pages | {t.items?.length || 0} items
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <style jsx global>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const styles = {
  uploadArea: {
    position: 'relative',
    border: '1px dashed rgba(139,92,246,0.3)',
    borderRadius: '10px',
    padding: '20px',
    textAlign: 'center',
    cursor: 'pointer',
    transition: 'all 0.2s',
    background: 'rgba(139,92,246,0.03)',
  },
  fileInput: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    opacity: 0,
    cursor: 'pointer',
  },
  uploadContent: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '6px',
    pointerEvents: 'none',
  },
  uploadSpinner: {
    width: '24px',
    height: '24px',
    border: '2px solid rgba(139,92,246,0.2)',
    borderTopColor: '#a78bfa',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  uploadLabel: {
    fontWeight: 600,
    color: '#e5e7eb',
    fontSize: '0.85em',
  },
  uploadHint: {
    color: '#6b7280',
    fontSize: '0.75em',
  },
  progress: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginTop: '8px',
    padding: '8px 10px',
    background: 'rgba(34,197,94,0.06)',
    border: '1px solid rgba(34,197,94,0.15)',
    borderRadius: '8px',
    color: '#22c55e',
    fontSize: '0.78em',
  },
  error: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginTop: '8px',
    padding: '8px 10px',
    background: 'rgba(239,68,68,0.06)',
    border: '1px solid rgba(239,68,68,0.15)',
    borderRadius: '8px',
    color: '#ef4444',
    fontSize: '0.78em',
  },
  fileList: {
    marginTop: '10px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  fileItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 10px',
    background: 'rgba(255,255,255,0.025)',
    borderRadius: '8px',
    border: '1px solid rgba(255,255,255,0.04)',
  },
  fileIcon: {
    width: '28px',
    height: '28px',
    borderRadius: '6px',
    background: 'rgba(239,68,68,0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#ef4444',
    flexShrink: 0,
  },
  fileName: {
    color: '#e5e7eb',
    fontSize: '0.82em',
    fontWeight: 500,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  fileMeta: {
    color: '#6b7280',
    fontSize: '0.72em',
  },
};
