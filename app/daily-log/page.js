'use client';

import { useState, useEffect } from 'react';
import Nav from '../components/Nav';

export default function DailyLogListPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterJob, setFilterJob] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [jobs, setJobs] = useState([]);

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
    loadLogs();
  }, [filterJob, filterDateFrom, filterDateTo]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterJob) params.set('jobId', filterJob);
      if (filterDateFrom) params.set('from', filterDateFrom);
      if (filterDateTo) params.set('to', filterDateTo);
      const userId = getUserId();
      if (userId) params.set('userId', userId);

      const res = await fetch('/api/photo/daily-log?' + params.toString());
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
        const uniqueJobs = [];
        const seen = new Set();
        for (const log of (data.logs || [])) {
          if (log.job_name && !seen.has(log.job_name)) {
            seen.add(log.job_name);
            uniqueJobs.push({ id: log.job_id, name: log.job_name });
          }
        }
        if (jobs.length === 0) setJobs(uniqueJobs);
      }
    } catch (err) {
      console.error('Failed to load daily logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const truncate = (text, len = 150) => {
    if (!text) return '';
    return text.length > len ? text.substring(0, len) + '...' : text;
  };

  const deleteDailyLog = async (logId, e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('Delete this daily log?')) return;
    try {
      const res = await fetch('/api/photo/daily-log?id=' + logId, { method: 'DELETE' });
      if (res.ok) {
        setLogs((prev) => prev.filter((l) => l.id !== logId));
      }
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  return (
    <div style={styles.page}>
      <Nav />
      <div style={styles.container}>
        <div style={styles.hero}>
          <div style={styles.heroContent}>
            <div>
              <h1 style={styles.title}>Daily Logs</h1>
              <p style={styles.subtitle}>Photo-powered construction daily reports</p>
            </div>
            <a href="/daily-log/new" style={styles.newBtn}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
              New Log
            </a>
          </div>
        </div>

        {/* Filters */}
        <div style={styles.filterRow}>
          <select
            value={filterJob}
            onChange={(e) => setFilterJob(e.target.value)}
            style={styles.filterSelect}
          >
            <option value="">All Jobs</option>
            {jobs.map((j) => (
              <option key={j.id || j.name} value={j.id || j.name}>{j.name}</option>
            ))}
          </select>
          <input
            type="date"
            value={filterDateFrom}
            onChange={(e) => setFilterDateFrom(e.target.value)}
            style={styles.filterDate}
            placeholder="From"
          />
          <input
            type="date"
            value={filterDateTo}
            onChange={(e) => setFilterDateTo(e.target.value)}
            style={styles.filterDate}
            placeholder="To"
          />
          {(filterJob || filterDateFrom || filterDateTo) && (
            <button
              onClick={() => { setFilterJob(''); setFilterDateFrom(''); setFilterDateTo(''); }}
              style={styles.clearBtn}
            >
              Clear Filters
            </button>
          )}
        </div>

        {/* Summary Stats */}
        {!loading && logs.length > 0 && (
          <div style={styles.statsRow}>
            <div style={styles.statCard}>
              <div style={styles.statNumber}>{logs.length}</div>
              <div style={styles.statLabel}>Total Logs</div>
            </div>
            <div style={styles.statCard}>
              <div style={styles.statNumber}>
                {new Set(logs.map((l) => l.job_name).filter(Boolean)).size}
              </div>
              <div style={styles.statLabel}>Jobs</div>
            </div>
            <div style={styles.statCard}>
              <div style={styles.statNumber}>
                {logs.filter((l) => l.source === 'photo').length}
              </div>
              <div style={styles.statLabel}>Photo Logs</div>
            </div>
            <div style={styles.statCard}>
              <div style={styles.statNumber}>
                {logs.reduce((sum, l) => sum + (Array.isArray(l.photos) ? l.photos.length : 0), 0)}
              </div>
              <div style={styles.statLabel}>Photos</div>
            </div>
          </div>
        )}

        {/* Log List */}
        {loading ? (
          <div style={styles.loadingWrap}>
            <div style={styles.spinner} />
            <p style={styles.loadingText}>Loading daily logs...</p>
          </div>
        ) : logs.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#4b5563" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </div>
            <h3 style={styles.emptyTitle}>No daily logs yet</h3>
            <p style={styles.emptyText}>Upload site photos to generate your first AI-powered daily log.</p>
            <a href="/daily-log/new" style={styles.newBtn}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Create Daily Log
            </a>
          </div>
        ) : (
          <div style={styles.list}>
            {logs.map((log) => (
              <a key={log.id} href={`/daily-log/${log.id}`} style={styles.card}>
                <div style={styles.cardTop}>
                  <div style={styles.cardDate}>{formatDate(log.created_at)}</div>
                  {log.weather && log.weather !== 'Not specified' && (
                    <span style={styles.weatherBadge}>{log.weather}</span>
                  )}
                  <span style={{
                    ...styles.sourceBadge,
                    background: log.source === 'photo' ? 'rgba(93,71,250,0.12)' : 'rgba(34,197,94,0.12)',
                    color: log.source === 'photo' ? '#a78bfa' : '#22c55e',
                  }}>
                    {log.source === 'photo' ? 'Photo' : 'Voice'}
                  </span>
                  <button
                    onClick={(e) => deleteDailyLog(log.id, e)}
                    style={styles.deleteBtn}
                    title="Delete log"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                    </svg>
                  </button>
                </div>
                {log.job_name && (
                  <div style={styles.cardJob}>{log.job_name}</div>
                )}
                <div style={styles.cardNarrative}>
                  {truncate(log.narrative)}
                </div>
                <div style={styles.cardFooter}>
                  {log.crew_count && (
                    <span style={styles.cardMeta}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                      </svg>
                      {log.crew_count} crew
                    </span>
                  )}
                  {log.crew_present && (
                    <span style={styles.cardMeta}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M23 21v-2a4 4 0 00-3-3.87" />
                        <path d="M16 3.13a4 4 0 010 7.75" />
                      </svg>
                      {log.crew_present}
                    </span>
                  )}
                  {log.photos && (
                    <span style={styles.cardMeta}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <polyline points="21 15 16 10 5 21" />
                      </svg>
                      {Array.isArray(log.photos) ? log.photos.length : 0} photos
                    </span>
                  )}
                </div>
              </a>
            ))}
          </div>
        )}
      </div>

      <style jsx global>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes cardIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
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
    maxWidth: '900px',
    margin: '0 auto',
    padding: '0 24px 60px',
  },
  hero: {
    padding: '32px 0 24px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    marginBottom: '20px',
  },
  heroContent: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  newBtn: {
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
    border: 'none',
    cursor: 'pointer',
    boxShadow: '0 4px 16px rgba(93,71,250,0.35)',
  },
  filterRow: {
    display: 'flex',
    gap: '10px',
    marginBottom: '20px',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  filterSelect: {
    padding: '8px 12px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    color: '#e5e7eb',
    fontSize: '0.85em',
    outline: 'none',
    minWidth: '160px',
  },
  filterDate: {
    padding: '8px 12px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    color: '#e5e7eb',
    fontSize: '0.85em',
    outline: 'none',
  },
  clearBtn: {
    padding: '8px 14px',
    background: 'rgba(239,68,68,0.08)',
    border: '1px solid rgba(239,68,68,0.2)',
    borderRadius: '8px',
    color: '#ef4444',
    fontSize: '0.82em',
    fontWeight: 500,
    cursor: 'pointer',
  },
  statsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '10px',
    marginBottom: '20px',
  },
  statCard: {
    padding: '14px 16px',
    background: '#12131a',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '10px',
    textAlign: 'center',
  },
  statNumber: {
    fontSize: '1.4em',
    fontWeight: 800,
    color: '#fff',
    letterSpacing: '-0.02em',
  },
  statLabel: {
    fontSize: '0.72em',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginTop: '2px',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  card: {
    display: 'block',
    padding: '18px 22px',
    background: '#12131a',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '12px',
    textDecoration: 'none',
    color: 'inherit',
    transition: 'all 0.2s',
    animation: 'cardIn 0.3s ease-out',
  },
  cardTop: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '8px',
  },
  cardDate: {
    fontWeight: 600,
    fontSize: '0.9em',
    color: '#f3f4f6',
  },
  weatherBadge: {
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '0.72em',
    background: 'rgba(251,191,36,0.1)',
    color: '#fbbf24',
  },
  sourceBadge: {
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '0.72em',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginLeft: 'auto',
  },
  deleteBtn: {
    padding: '4px',
    background: 'transparent',
    border: 'none',
    color: '#6b7280',
    cursor: 'pointer',
    borderRadius: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardJob: {
    color: '#a78bfa',
    fontSize: '0.85em',
    fontWeight: 500,
    marginBottom: '6px',
  },
  cardNarrative: {
    color: '#9ca3af',
    fontSize: '0.88em',
    lineHeight: 1.5,
    marginBottom: '10px',
  },
  cardFooter: {
    display: 'flex',
    gap: '16px',
    alignItems: 'center',
  },
  cardMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    color: '#6b7280',
    fontSize: '0.78em',
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
  emptyIcon: {
    width: '80px',
    height: '80px',
    borderRadius: '20px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.06)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 20px',
  },
  emptyTitle: {
    color: '#e5e7eb',
    margin: '0 0 8px',
    fontSize: '1.2em',
    fontWeight: 600,
  },
  emptyText: {
    color: '#6b7280',
    margin: '0 0 24px',
    fontSize: '0.9em',
  },
};
