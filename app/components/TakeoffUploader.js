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

      setProgress(`Analysis complete! Found ${data.items?.length || 0} items across ${data.page_count} pages.`);
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
    <div style={styles.container}>
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
          <span style={styles.uploadIcon}>{uploading ? '...' : '+'}</span>
          <span style={styles.uploadLabel}>
            {uploading ? 'Analyzing...' : 'Upload Blueprint PDF'}
          </span>
          <span style={styles.uploadHint}>
            AI will extract quantities from your plans
          </span>
        </div>
      </div>

      {progress && (
        <div style={styles.progress}>{progress}</div>
      )}

      {error && (
        <div style={styles.error}>{error}</div>
      )}

      {takeoffs.length > 0 && (
        <div style={styles.fileList}>
          {takeoffs.map((t, i) => (
            <div key={i} style={styles.fileItem}>
              <span style={styles.fileIcon}>PDF</span>
              <div>
                <div style={styles.fileName}>{t.fileName}</div>
                <div style={styles.fileMeta}>
                  {t.page_count} pages | {t.items?.length || 0} items found
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const styles = {
  container: { marginBottom: '16px' },
  uploadArea: {
    position: 'relative',
    border: '2px dashed rgba(93,71,250,0.4)',
    borderRadius: '12px',
    padding: '24px',
    textAlign: 'center',
    cursor: 'pointer',
    transition: 'all 0.2s',
    background: 'rgba(93,71,250,0.05)',
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
    gap: '8px',
    pointerEvents: 'none',
  },
  uploadIcon: {
    fontSize: '2em',
    color: '#7a64ff',
  },
  uploadLabel: {
    fontWeight: 600,
    color: '#f0f4f8',
    fontSize: '0.95em',
  },
  uploadHint: {
    color: '#8899a6',
    fontSize: '0.8em',
  },
  progress: {
    marginTop: '8px',
    padding: '8px 12px',
    background: 'rgba(0,200,83,0.1)',
    border: '1px solid rgba(0,200,83,0.3)',
    borderRadius: '8px',
    color: '#00c853',
    fontSize: '0.85em',
  },
  error: {
    marginTop: '8px',
    padding: '8px 12px',
    background: 'rgba(255,82,82,0.1)',
    border: '1px solid rgba(255,82,82,0.3)',
    borderRadius: '8px',
    color: '#ff5252',
    fontSize: '0.85em',
  },
  fileList: {
    marginTop: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  fileItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '8px 12px',
    background: 'rgba(255,255,255,0.03)',
    borderRadius: '8px',
    border: '1px solid rgba(255,255,255,0.06)',
  },
  fileIcon: {
    padding: '4px 8px',
    background: 'rgba(255,82,82,0.15)',
    borderRadius: '4px',
    color: '#ff5252',
    fontSize: '0.7em',
    fontWeight: 700,
  },
  fileName: {
    color: '#f0f4f8',
    fontSize: '0.85em',
    fontWeight: 500,
  },
  fileMeta: {
    color: '#8899a6',
    fontSize: '0.75em',
  },
};
