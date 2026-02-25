'use client';

import { useState, useEffect } from 'react';
import Nav from '../../components/Nav';

export default function SequenceLogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadLogs(); }, []);

  async function loadLogs() {
    // Logs are loaded via a dedicated API or inline query
    // For now, show placeholder
    setLoading(false);
  }

  return (
    <>
      <Nav />
      <div style={styles.container}>
        <a href="/sequences" style={styles.back}>&#8592; All Sequences</a>
        <h1 style={styles.title}>Sequence Activity Log</h1>
        <p style={styles.subtitle}>Track every email, SMS, and notification sent by your sequences.</p>

        {loading ? (
          <p style={styles.muted}>Loading logs...</p>
        ) : logs.length === 0 ? (
          <div style={styles.emptyState}>
            <p style={styles.emptyTitle}>No activity yet</p>
            <p style={styles.muted}>Sequence actions will appear here once contacts are enrolled and steps execute.</p>
          </div>
        ) : (
          <div style={styles.logList}>
            {logs.map((log, i) => (
              <div key={i} style={styles.logItem}>
                <div style={{
                  ...styles.logDot,
                  background: log.status === 'sent' ? '#34d399' : log.status === 'failed' ? '#f87171' : '#6b7280',
                }} />
                <div>
                  <p style={styles.logText}>{log.channel}: {log.subject || log.content?.slice(0, 60)}</p>
                  <p style={styles.logMeta}>{log.status} &middot; {new Date(log.sent_at).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

const styles = {
  container: { maxWidth: '800px', margin: '0 auto', padding: '24px' },
  back: { color: '#6b7280', fontSize: '0.85em', textDecoration: 'none', display: 'block', marginBottom: '12px' },
  title: { fontSize: '1.4em', fontWeight: 700, color: '#fff', marginBottom: '4px' },
  subtitle: { color: '#6b7280', fontSize: '0.9em', marginBottom: '24px' },
  muted: { color: '#6b7280' },
  emptyState: { textAlign: 'center', padding: '60px 20px' },
  emptyTitle: { fontSize: '1.1em', color: '#9ca3af', marginBottom: '8px' },
  logList: { display: 'flex', flexDirection: 'column', gap: '8px' },
  logItem: { display: 'flex', gap: '12px', alignItems: 'flex-start', padding: '12px 16px', background: '#12131a', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' },
  logDot: { width: '8px', height: '8px', borderRadius: '50%', marginTop: '6px', flexShrink: 0 },
  logText: { color: '#e5e7eb', fontSize: '0.9em' },
  logMeta: { color: '#6b7280', fontSize: '0.75em', marginTop: '2px' },
};
