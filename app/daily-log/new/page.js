'use client';

import { useState, useRef, useEffect } from 'react';
import Nav from '../../components/Nav';

export default function NewDailyLogPage() {
  const [photos, setPhotos] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [jobName, setJobName] = useState('');
  const [jobId, setJobId] = useState('');
  const [jobSearch, setJobSearch] = useState('');
  const [jobResults, setJobResults] = useState([]);
  const [logDate, setLogDate] = useState('');
  const [narrative, setNarrative] = useState('');
  const [weather, setWeather] = useState('');
  const [crewPresent, setCrewPresent] = useState('');
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);
  const searchTimeoutRef = useRef(null);

  const getUserId = () => {
    try { return localStorage.getItem('bb_user_id') || ''; } catch { return ''; }
  };
  const getApiKey = () => {
    try { return localStorage.getItem('bb_api_key') || ''; } catch { return ''; }
  };
  const getGrantKey = () => {
    try { return localStorage.getItem('bb_grant_key') || ''; } catch { return ''; }
  };

  useEffect(() => {
    // Default date to today
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    setLogDate(`${yyyy}-${mm}-${dd}`);
  }, []);

  const handleFiles = (files) => {
    const fileList = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (fileList.length === 0) return;

    setPhotos((prev) => [...prev, ...fileList]);

    fileList.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviews((prev) => [...prev, { name: file.name, url: e.target.result }]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  const removePhoto = (index) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const searchJobs = async (term) => {
    const grantKey = getGrantKey();
    if (!grantKey || term.length < 2) {
      setJobResults([]);
      return;
    }
    try {
      const res = await fetch('/api/jobtread/test?action=search_jobs&search=' + encodeURIComponent(term) + '&grantKey=' + encodeURIComponent(grantKey));
      if (res.ok) {
        const data = await res.json();
        setJobResults(data.jobs || []);
      }
    } catch { /* ok */ }
  };

  const handleJobSearch = (value) => {
    setJobSearch(value);
    setJobName(value);
    setJobId('');
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => searchJobs(value), 300);
  };

  const selectJob = (job) => {
    setJobId(job.id);
    setJobName(job.name);
    setJobSearch(job.name);
    setJobResults([]);
  };

  const handleGenerate = async () => {
    if (photos.length === 0) {
      setError('Please upload at least one photo.');
      return;
    }

    const apiKey = getApiKey();
    if (!apiKey) {
      setError('Please configure your Anthropic API key in Setup first.');
      return;
    }

    setGenerating(true);
    setError('');
    setSuccess('');

    try {
      const formData = new FormData();
      photos.forEach((photo) => formData.append('photos', photo));
      formData.append('jobId', jobId);
      formData.append('jobName', jobName);
      formData.append('apiKey', apiKey);
      if (logDate) formData.append('date', logDate);

      const res = await fetch('/api/photo/daily-log', { method: 'POST', body: formData });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to generate daily log');
        return;
      }

      setNarrative(data.dailyLog?.narrative || '');
      if (data.dailyLog?.weather) setWeather(data.dailyLog.weather);
      if (data.dailyLog?.crew_count) {
        setCrewPresent(crewPresent || `${data.dailyLog.crew_count} workers observed`);
      }
      setSuccess('AI narrative generated! Review and edit below, then save.');
    } catch (err) {
      setError('Failed to generate daily log: ' + err.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!narrative.trim()) {
      setError('Narrative is empty. Generate or write a log first.');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const crewNames = crewPresent.split(',').map((n) => n.trim()).filter(Boolean);
      const res = await fetch('/api/photo/daily-log', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: getUserId(),
          jobId,
          jobName,
          narrative,
          weather,
          crewPresent: crewPresent,
          crewCount: crewNames.length || null,
          date: logDate,
        }),
      });

      if (res.ok) {
        setSuccess('Daily log saved successfully!');
        setTimeout(() => { window.location.href = '/daily-log'; }, 1500);
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to save');
      }
    } catch (err) {
      setError('Failed to save: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={styles.page}>
      <Nav />
      <div style={styles.container}>
        <div style={styles.hero}>
          <a href="/daily-log" style={styles.backLink}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Back to Logs
          </a>
          <h1 style={styles.title}>Create Daily Log</h1>
          <p style={styles.subtitle}>Upload site photos and let AI generate your daily report</p>
        </div>

        {/* Error / Success */}
        {error && <div style={styles.errorBox}>{error}</div>}
        {success && <div style={styles.successBox}>{success}</div>}

        {/* Job Selector */}
        <div style={styles.section}>
          <label style={styles.label}>Job / Project</label>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              value={jobSearch}
              onChange={(e) => handleJobSearch(e.target.value)}
              placeholder="Search for a job or enter a name..."
              style={styles.input}
            />
            {jobResults.length > 0 && (
              <div style={styles.dropdown}>
                {jobResults.map((job) => (
                  <button
                    key={job.id}
                    onClick={() => selectJob(job)}
                    style={styles.dropdownItem}
                  >
                    <span style={{ color: '#f3f4f6' }}>{job.name}</span>
                    {job.number && <span style={{ color: '#6b7280', fontSize: '0.8em' }}>#{job.number}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Date Picker */}
        <div style={styles.section}>
          <label style={styles.label}>Date</label>
          <input
            type="date"
            value={logDate}
            onChange={(e) => setLogDate(e.target.value)}
            style={styles.input}
          />
        </div>

        {/* Photo Upload */}
        <div style={styles.section}>
          <label style={styles.label}>Site Photos</label>
          <div
            style={{
              ...styles.dropzone,
              ...(dragOver ? styles.dropzoneActive : {}),
            }}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => handleFiles(e.target.files)}
              style={{ display: 'none' }}
            />
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#5d47fa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
            <p style={styles.dropzoneText}>
              Drop photos here or click to browse
            </p>
            <p style={styles.dropzoneHint}>
              JPG, PNG, WebP — multiple photos supported
            </p>
          </div>

          {previews.length > 0 && (
            <div style={styles.previewGrid}>
              {previews.map((preview, i) => (
                <div key={i} style={styles.previewItem}>
                  <img src={preview.url} alt={preview.name} style={styles.previewImg} />
                  <button
                    onClick={(e) => { e.stopPropagation(); removePhoto(i); }}
                    style={styles.removePhotoBtn}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                  <div style={styles.previewName}>{preview.name}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Generate Button */}
        <button
          onClick={handleGenerate}
          disabled={generating || photos.length === 0}
          style={{
            ...styles.generateBtn,
            opacity: (generating || photos.length === 0) ? 0.5 : 1,
          }}
        >
          {generating ? (
            <>
              <div style={styles.btnSpinner} />
              Analyzing {photos.length} photo{photos.length !== 1 ? 's' : ''} with AI...
            </>
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
              Generate with AI
            </>
          )}
        </button>

        {/* AI-Generated Narrative Editor */}
        <div style={styles.section}>
          <label style={styles.label}>Daily Log Narrative</label>
          <textarea
            value={narrative}
            onChange={(e) => setNarrative(e.target.value)}
            style={styles.textarea}
            rows={12}
            placeholder="AI-generated narrative will appear here, or type your own..."
          />
        </div>

        {/* Weather */}
        <div style={styles.section}>
          <label style={styles.label}>Weather</label>
          <input
            type="text"
            value={weather}
            onChange={(e) => setWeather(e.target.value)}
            placeholder="e.g., Sunny, 72°F, light breeze"
            style={styles.input}
          />
        </div>

        {/* Crew Present */}
        <div style={styles.section}>
          <label style={styles.label}>Crew Present</label>
          <input
            type="text"
            value={crewPresent}
            onChange={(e) => setCrewPresent(e.target.value)}
            placeholder="e.g., John Smith, Maria Garcia, Alex Johnson"
            style={styles.input}
          />
          <p style={styles.fieldHint}>Comma-separated names of crew members on site</p>
        </div>

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={saving || !narrative.trim()}
          style={{
            ...styles.saveBtn,
            opacity: (saving || !narrative.trim()) ? 0.5 : 1,
          }}
        >
          {saving ? (
            <>
              <div style={styles.btnSpinner} />
              Saving...
            </>
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
                <polyline points="17 21 17 13 7 13 7 21" />
                <polyline points="7 3 7 8 15 8" />
              </svg>
              Save Daily Log
            </>
          )}
        </button>
      </div>

      <style jsx global>{`
        @keyframes spin { to { transform: rotate(360deg); } }
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
    maxWidth: '700px',
    margin: '0 auto',
    padding: '0 24px 60px',
  },
  hero: {
    padding: '24px 0 20px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    marginBottom: '24px',
  },
  backLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    color: '#6b7280',
    textDecoration: 'none',
    fontSize: '0.85em',
    marginBottom: '12px',
  },
  title: {
    fontSize: '1.8em',
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
  section: {
    marginBottom: '24px',
  },
  label: {
    display: 'block',
    fontSize: '0.82em',
    fontWeight: 600,
    color: '#9ca3af',
    marginBottom: '8px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  input: {
    width: '100%',
    padding: '10px 14px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    color: '#e5e7eb',
    fontSize: '0.9em',
    outline: 'none',
    boxSizing: 'border-box',
  },
  fieldHint: {
    fontSize: '0.78em',
    color: '#6b7280',
    margin: '6px 0 0',
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    background: '#1a1b26',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    marginTop: '4px',
    maxHeight: '200px',
    overflowY: 'auto',
    zIndex: 50,
  },
  dropdownItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    padding: '10px 14px',
    background: 'transparent',
    border: 'none',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
    cursor: 'pointer',
    textAlign: 'left',
    color: '#e5e7eb',
    fontSize: '0.88em',
  },
  dropzone: {
    border: '2px dashed rgba(93,71,250,0.3)',
    borderRadius: '12px',
    padding: '40px 20px',
    textAlign: 'center',
    cursor: 'pointer',
    transition: 'all 0.2s',
    background: 'rgba(93,71,250,0.03)',
  },
  dropzoneActive: {
    borderColor: '#5d47fa',
    background: 'rgba(93,71,250,0.08)',
  },
  dropzoneText: {
    color: '#e5e7eb',
    fontSize: '0.95em',
    margin: '12px 0 4px',
  },
  dropzoneHint: {
    color: '#6b7280',
    fontSize: '0.8em',
    margin: 0,
  },
  previewGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
    gap: '10px',
    marginTop: '16px',
  },
  previewItem: {
    position: 'relative',
    borderRadius: '8px',
    overflow: 'hidden',
    background: '#12131a',
    border: '1px solid rgba(255,255,255,0.06)',
  },
  previewImg: {
    width: '100%',
    height: '100px',
    objectFit: 'cover',
    display: 'block',
  },
  removePhotoBtn: {
    position: 'absolute',
    top: '4px',
    right: '4px',
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    background: 'rgba(0,0,0,0.7)',
    border: 'none',
    color: '#fff',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
  },
  previewName: {
    padding: '4px 8px',
    fontSize: '0.7em',
    color: '#6b7280',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  generateBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    width: '100%',
    padding: '14px 24px',
    background: 'linear-gradient(135deg, #5d47fa 0%, #7c3aed 100%)',
    borderRadius: '10px',
    color: '#fff',
    fontWeight: 600,
    fontSize: '0.95em',
    border: 'none',
    cursor: 'pointer',
    boxShadow: '0 4px 16px rgba(93,71,250,0.35)',
    marginBottom: '24px',
  },
  btnSpinner: {
    width: '18px',
    height: '18px',
    border: '2px solid rgba(255,255,255,0.3)',
    borderTopColor: '#fff',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  textarea: {
    width: '100%',
    padding: '14px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '10px',
    color: '#e5e7eb',
    fontSize: '0.9em',
    lineHeight: 1.6,
    outline: 'none',
    resize: 'vertical',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    boxSizing: 'border-box',
  },
  saveBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    width: '100%',
    padding: '14px 24px',
    background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
    borderRadius: '10px',
    color: '#fff',
    fontWeight: 600,
    fontSize: '0.95em',
    border: 'none',
    cursor: 'pointer',
    boxShadow: '0 4px 16px rgba(34,197,94,0.35)',
  },
  errorBox: {
    padding: '12px 16px',
    background: 'rgba(239,68,68,0.08)',
    border: '1px solid rgba(239,68,68,0.2)',
    borderRadius: '10px',
    color: '#ef4444',
    fontSize: '0.88em',
    marginBottom: '16px',
  },
  successBox: {
    padding: '12px 16px',
    background: 'rgba(34,197,94,0.08)',
    border: '1px solid rgba(34,197,94,0.2)',
    borderRadius: '10px',
    color: '#22c55e',
    fontSize: '0.88em',
    marginBottom: '16px',
  },
};
