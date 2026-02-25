'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Nav from '../../components/Nav';

export default function DailyLogDetailPage() {
  const params = useParams();
  const logId = params.id;
  const [log, setLog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [narrative, setNarrative] = useState('');
  const [weather, setWeather] = useState('');
  const [crewPresent, setCrewPresent] = useState('');
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const getUserId = () => {
    try { return localStorage.getItem('bb_user_id') || ''; } catch { return ''; }
  };
  const getGrantKey = () => {
    try { return localStorage.getItem('bb_grant_key') || ''; } catch { return ''; }
  };
  const getApiKey = () => {
    try { return localStorage.getItem('bb_api_key') || ''; } catch { return ''; }
  };

  useEffect(() => {
    loadLog();
  }, [logId]);

  const loadLog = async () => {
    try {
      const res = await fetch(`/api/photo/daily-log?id=${logId}`);
      if (res.ok) {
        const data = await res.json();
        const entry = data.log || data.logs?.[0];
        if (entry) {
          setLog(entry);
          setNarrative(entry.narrative || '');
          setWeather(entry.weather || '');
          setCrewPresent(entry.crew_present || (entry.crew_count ? `${entry.crew_count} workers` : ''));
        }
      }
    } catch (err) {
      setError('Failed to load daily log');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const crewNames = crewPresent.split(',').map((n) => n.trim()).filter(Boolean);
      const res = await fetch(`/api/photo/daily-log?id=${logId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          narrative,
          weather,
          crewPresent: crewPresent,
          crewCount: crewNames.length || null,
        }),
      });
      if (res.ok) {
        setSuccess('Daily log updated successfully.');
        setEditing(false);
        loadLog();
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

  const handleSyncToJobTread = async () => {
    if (!log?.job_id) {
      setError('No JobTread job is linked to this log. Cannot sync.');
      return;
    }
    const grantKey = getGrantKey();
    if (!grantKey) {
      setError('JobTread grant key not found. Please configure in Setup.');
      return;
    }

    setSyncing(true);
    setError('');
    setSuccess('');

    try {
      const commentText = [
        `Daily Log — ${formatDate(log.created_at)}`,
        '',
        narrative || log.narrative,
        '',
        weather ? `Weather: ${weather}` : '',
        crewPresent ? `Crew Present: ${crewPresent}` : '',
      ].filter(Boolean).join('\n');

      const res = await fetch('/api/jobtread/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_job_comment',
          grantKey,
          jobId: log.job_id,
          text: commentText,
        }),
      });

      if (res.ok) {
        setSuccess('Daily log synced to JobTread as a job comment.');
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to sync to JobTread');
      }
    } catch (err) {
      setError('Sync failed: ' + err.message);
    } finally {
      setSyncing(false);
    }
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div style={styles.page}>
        <Nav />
        <div style={styles.container}>
          <div style={styles.loadingWrap}>
            <div style={styles.spinner} />
            <p style={styles.loadingText}>Loading daily log...</p>
          </div>
        </div>
        <style jsx global>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!log) {
    return (
      <div style={styles.page}>
        <Nav />
        <div style={styles.container}>
          <div style={styles.emptyState}>
            <h2 style={{ color: '#fff', margin: '0 0 8px' }}>Daily log not found</h2>
            <p style={{ color: '#6b7280', margin: '0 0 20px', fontSize: '0.9em' }}>
              This log may have been deleted or the ID is invalid.
            </p>
            <a href="/daily-log" style={styles.backBtn}>Back to Logs</a>
          </div>
        </div>
      </div>
    );
  }

  const photos = Array.isArray(log.photos) ? log.photos : [];

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
          <div style={styles.heroContent}>
            <div>
              <h1 style={styles.title}>{formatDate(log.created_at)}</h1>
              {log.job_name && <p style={styles.jobName}>{log.job_name}</p>}
            </div>
            <div style={styles.heroActions}>
              <button
                onClick={() => { setEditing(!editing); setError(''); setSuccess(''); }}
                style={editing ? styles.cancelEditBtn : styles.editBtn}
              >
                {editing ? 'Cancel' : 'Edit Log'}
              </button>
              {log.job_id && (
                <button
                  onClick={handleSyncToJobTread}
                  disabled={syncing}
                  style={{
                    ...styles.syncJTBtn,
                    opacity: syncing ? 0.5 : 1,
                  }}
                >
                  {syncing ? (
                    <>
                      <div style={styles.btnSpinnerSm} />
                      Syncing...
                    </>
                  ) : (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Sync to JobTread
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>

        {error && <div style={styles.errorBox}>{error}</div>}
        {success && <div style={styles.successBox}>{success}</div>}

        {/* Meta Info */}
        <div style={styles.metaRow}>
          <div style={styles.metaCard}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" />
              <line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" />
              <line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
            <div>
              <div style={styles.metaLabel}>Weather</div>
              {editing ? (
                <input
                  type="text"
                  value={weather}
                  onChange={(e) => setWeather(e.target.value)}
                  style={styles.metaInput}
                  placeholder="Weather conditions"
                />
              ) : (
                <div style={styles.metaValue}>{log.weather || 'Not specified'}</div>
              )}
            </div>
          </div>

          <div style={styles.metaCard}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 00-3-3.87" />
              <path d="M16 3.13a4 4 0 010 7.75" />
            </svg>
            <div>
              <div style={styles.metaLabel}>Crew Present</div>
              {editing ? (
                <input
                  type="text"
                  value={crewPresent}
                  onChange={(e) => setCrewPresent(e.target.value)}
                  style={styles.metaInput}
                  placeholder="Comma-separated names"
                />
              ) : (
                <div style={styles.metaValue}>
                  {log.crew_present || (log.crew_count ? `${log.crew_count} workers` : 'Not recorded')}
                </div>
              )}
            </div>
          </div>

          <div style={styles.metaCard}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
            <div>
              <div style={styles.metaLabel}>Photos</div>
              <div style={styles.metaValue}>{photos.length} analyzed</div>
            </div>
          </div>

          <div style={styles.metaCard}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6ee7b7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
            <div>
              <div style={styles.metaLabel}>Source</div>
              <div style={styles.metaValue}>{log.source === 'photo' ? 'Photo AI' : 'Voice'}</div>
            </div>
          </div>
        </div>

        {/* Narrative */}
        <div style={styles.narrativeSection}>
          <h2 style={styles.sectionTitle}>Daily Log Narrative</h2>
          {editing ? (
            <textarea
              value={narrative}
              onChange={(e) => setNarrative(e.target.value)}
              style={styles.textarea}
              rows={14}
            />
          ) : (
            <div style={styles.narrativeText}>
              {(log.narrative || '').split('\n').map((para, i) => (
                <p key={i} style={styles.narrativePara}>{para}</p>
              ))}
            </div>
          )}
        </div>

        {/* Photo Analyses */}
        {photos.length > 0 && (
          <div style={styles.photoSection}>
            <h2 style={styles.sectionTitle}>Photo Analysis</h2>
            <div style={styles.photoList}>
              {photos.map((photo, i) => (
                <div key={i} style={styles.photoCard}>
                  <div style={styles.photoHeader}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5d47fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <polyline points="21 15 16 10 5 21" />
                    </svg>
                    <span style={{ color: '#f3f4f6', fontWeight: 500 }}>
                      {photo.filename || `Photo ${photo.index || i + 1}`}
                    </span>
                  </div>
                  <p style={styles.photoAnalysis}>{photo.analysis}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Save Button */}
        {editing && (
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              ...styles.saveBtn,
              opacity: saving ? 0.5 : 1,
            }}
          >
            {saving ? (
              <>
                <div style={styles.btnSpinnerSm} />
                Saving...
              </>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
                  <polyline points="17 21 17 13 7 13 7 21" />
                  <polyline points="7 3 7 8 15 8" />
                </svg>
                Save Changes
              </>
            )}
          </button>
        )}
      </div>

      <style jsx global>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
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
    maxWidth: '800px',
    margin: '0 auto',
    padding: '0 24px 60px',
  },
  hero: {
    padding: '24px 0 20px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    marginBottom: '24px',
  },
  heroContent: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '16px',
    flexWrap: 'wrap',
  },
  heroActions: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    flexWrap: 'wrap',
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
    fontSize: '1.6em',
    fontWeight: 800,
    margin: 0,
    color: '#fff',
    letterSpacing: '-0.03em',
  },
  jobName: {
    color: '#a78bfa',
    margin: '4px 0 0',
    fontSize: '0.95em',
    fontWeight: 500,
  },
  editBtn: {
    padding: '8px 18px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    color: '#e5e7eb',
    fontSize: '0.85em',
    fontWeight: 500,
    cursor: 'pointer',
  },
  cancelEditBtn: {
    padding: '8px 18px',
    background: 'rgba(239,68,68,0.08)',
    border: '1px solid rgba(239,68,68,0.2)',
    borderRadius: '8px',
    color: '#ef4444',
    fontSize: '0.85em',
    fontWeight: 500,
    cursor: 'pointer',
  },
  syncJTBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 16px',
    background: 'linear-gradient(135deg, #5d47fa 0%, #7c3aed 100%)',
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '0.85em',
    fontWeight: 600,
    cursor: 'pointer',
    boxShadow: '0 2px 10px rgba(93,71,250,0.3)',
  },
  btnSpinnerSm: {
    width: '14px',
    height: '14px',
    border: '2px solid rgba(255,255,255,0.3)',
    borderTopColor: '#fff',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  metaRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: '10px',
    marginBottom: '28px',
  },
  metaCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px 14px',
    background: '#12131a',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '10px',
  },
  metaLabel: {
    fontSize: '0.7em',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  metaValue: {
    fontSize: '0.9em',
    color: '#f3f4f6',
    fontWeight: 500,
  },
  metaInput: {
    padding: '4px 8px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: '4px',
    color: '#e5e7eb',
    fontSize: '0.85em',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  },
  narrativeSection: {
    marginBottom: '28px',
  },
  sectionTitle: {
    fontSize: '1.1em',
    fontWeight: 700,
    color: '#fff',
    margin: '0 0 14px',
  },
  narrativeText: {
    padding: '20px',
    background: '#12131a',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '12px',
  },
  narrativePara: {
    color: '#d1d5db',
    lineHeight: 1.7,
    margin: '0 0 12px',
    fontSize: '0.92em',
  },
  textarea: {
    width: '100%',
    padding: '16px',
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
  photoSection: {
    marginBottom: '28px',
  },
  photoList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  photoCard: {
    padding: '14px 18px',
    background: '#12131a',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '10px',
  },
  photoHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '8px',
  },
  photoAnalysis: {
    color: '#9ca3af',
    fontSize: '0.88em',
    lineHeight: 1.5,
    margin: 0,
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
  backBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 22px',
    background: 'linear-gradient(135deg, #5d47fa 0%, #7c3aed 100%)',
    borderRadius: '10px',
    color: '#fff',
    textDecoration: 'none',
    fontWeight: 600,
    fontSize: '0.9em',
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
  loadingWrap: {
    textAlign: 'center',
    padding: '80px 20px',
  },
  spinner: {
    width: '32px',
    height: '32px',
    border: '3px solid rgba(93,71,250,0.2)',
    borderTopColor: '#5d47fa',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
    margin: '0 auto 16px',
  },
  loadingText: {
    color: '#6b7280',
    fontSize: '0.9em',
  },
  emptyState: {
    textAlign: 'center',
    padding: '80px 20px',
  },
};
