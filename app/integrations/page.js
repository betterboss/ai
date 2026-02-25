'use client';

import { useState, useEffect } from 'react';
import Nav from '../components/Nav';

export default function IntegrationsPage() {
  const [ghlApiKey, setGhlApiKey] = useState('');
  const [ghlLocationId, setGhlLocationId] = useState('');
  const [ghlStatus, setGhlStatus] = useState('disconnected'); // disconnected, testing, connected, error
  const [ghlConfig, setGhlConfig] = useState(null);
  const [syncContacts, setSyncContacts] = useState(true);
  const [syncOpportunities, setSyncOpportunities] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [syncLogs, setSyncLogs] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const getUserId = () => {
    try { return localStorage.getItem('bb_user_id') || ''; } catch { return ''; }
  };
  const getGrantKey = () => {
    try { return localStorage.getItem('bb_grant_key') || ''; } catch { return ''; }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    const userId = getUserId();
    if (!userId) return;

    try {
      const res = await fetch(`/api/integrations/ghl?userId=${userId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.config) {
          setGhlConfig(data.config);
          setGhlLocationId(data.config.location_id || '');
          setSyncContacts(data.config.sync_contacts !== false);
          setSyncOpportunities(data.config.sync_opportunities !== false);
          if (data.config.has_api_key) {
            setGhlStatus('connected');
          }
        }
      }
    } catch (err) {
      console.error('Failed to load GHL config:', err);
    }
  };

  const handleTestConnection = async () => {
    if (!ghlApiKey && !ghlConfig?.has_api_key) {
      setError('Please enter your GHL API key first.');
      return;
    }

    setGhlStatus('testing');
    setError('');

    try {
      // Test by making a simple API call
      const res = await fetch('/api/integrations/ghl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: getUserId(),
          apiKey: ghlApiKey || undefined,
          locationId: ghlLocationId,
          syncContacts,
          syncOpportunities,
        }),
      });

      if (res.ok) {
        setGhlStatus('connected');
        setSuccess('GoHighLevel connected successfully!');
        loadConfig();
      } else {
        const data = await res.json();
        setGhlStatus('error');
        setError(data.error || 'Failed to connect to GoHighLevel');
      }
    } catch (err) {
      setGhlStatus('error');
      setError('Connection test failed: ' + err.message);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');

    try {
      const res = await fetch('/api/integrations/ghl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: getUserId(),
          apiKey: ghlApiKey || undefined,
          locationId: ghlLocationId,
          syncContacts,
          syncOpportunities,
        }),
      });

      if (res.ok) {
        setSuccess('Settings saved!');
        loadConfig();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to save settings');
      }
    } catch (err) {
      setError('Save failed: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    setError('');

    try {
      const res = await fetch('/api/integrations/ghl/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: getUserId(),
          grantKey: getGrantKey(),
          direction: 'both',
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setSyncResult(data.results);
        setSuccess(`Sync complete! ${data.results.contacts_synced} contacts, ${data.results.opportunities_synced} opportunities synced.`);
      } else {
        setError(data.error || 'Sync failed');
      }
    } catch (err) {
      setError('Sync failed: ' + err.message);
    } finally {
      setSyncing(false);
    }
  };

  const statusColors = {
    disconnected: { bg: 'rgba(107,114,128,0.1)', color: '#6b7280', label: 'Not Connected' },
    testing: { bg: 'rgba(251,191,36,0.1)', color: '#fbbf24', label: 'Testing...' },
    connected: { bg: 'rgba(34,197,94,0.1)', color: '#22c55e', label: 'Connected' },
    error: { bg: 'rgba(239,68,68,0.1)', color: '#ef4444', label: 'Error' },
  };
  const currentStatus = statusColors[ghlStatus];

  return (
    <div style={styles.page}>
      <Nav />
      <div style={styles.container}>
        <div style={styles.hero}>
          <h1 style={styles.title}>Integrations</h1>
          <p style={styles.subtitle}>Connect your tools for a unified workflow</p>
        </div>

        {error && <div style={styles.errorBox}>{error}</div>}
        {success && <div style={styles.successBox}>{success}</div>}

        {/* GHL Connection Card */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <div style={styles.cardHeaderLeft}>
              <div style={styles.iconBox}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
                </svg>
              </div>
              <div>
                <h2 style={styles.cardTitle}>GoHighLevel</h2>
                <p style={styles.cardDesc}>CRM & marketing automation</p>
              </div>
            </div>
            <span style={{
              padding: '4px 12px',
              borderRadius: '6px',
              fontSize: '0.78em',
              fontWeight: 600,
              background: currentStatus.bg,
              color: currentStatus.color,
            }}>
              {currentStatus.label}
            </span>
          </div>

          <div style={styles.cardBody}>
            <div style={styles.field}>
              <label style={styles.label}>API Key</label>
              <input
                type="password"
                value={ghlApiKey}
                onChange={(e) => setGhlApiKey(e.target.value)}
                placeholder={ghlConfig?.has_api_key ? 'Key saved (enter new to update)' : 'Enter your GHL API key'}
                style={styles.input}
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Location ID</label>
              <input
                type="text"
                value={ghlLocationId}
                onChange={(e) => setGhlLocationId(e.target.value)}
                placeholder="Your GHL location ID"
                style={styles.input}
              />
            </div>

            <div style={styles.btnRow}>
              <button onClick={handleTestConnection} style={styles.testBtn}>
                {ghlStatus === 'testing' ? (
                  <>
                    <div style={styles.btnSpinner} />
                    Testing...
                  </>
                ) : (
                  'Test Connection'
                )}
              </button>
              <button onClick={handleSave} disabled={saving} style={styles.saveBtn}>
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </div>
        </div>

        {/* Sync Mapping Configuration */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <div style={styles.cardHeaderLeft}>
              <div style={{ ...styles.iconBox, background: 'rgba(167,139,250,0.12)', color: '#a78bfa' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="16 3 21 3 21 8" />
                  <line x1="4" y1="20" x2="21" y2="3" />
                  <polyline points="21 16 21 21 16 21" />
                  <line x1="15" y1="15" x2="21" y2="21" />
                  <line x1="4" y1="4" x2="9" y2="9" />
                </svg>
              </div>
              <div>
                <h2 style={styles.cardTitle}>Sync Configuration</h2>
                <p style={styles.cardDesc}>Choose what data to sync between platforms</p>
              </div>
            </div>
          </div>

          <div style={styles.cardBody}>
            <label style={styles.checkboxRow}>
              <input
                type="checkbox"
                checked={syncContacts}
                onChange={(e) => setSyncContacts(e.target.checked)}
                style={styles.checkbox}
              />
              <div>
                <div style={styles.checkLabel}>Sync Contacts</div>
                <div style={styles.checkDesc}>Push JobTread contacts to GHL and vice versa</div>
              </div>
            </label>

            <label style={styles.checkboxRow}>
              <input
                type="checkbox"
                checked={syncOpportunities}
                onChange={(e) => setSyncOpportunities(e.target.checked)}
                style={styles.checkbox}
              />
              <div>
                <div style={styles.checkLabel}>Sync Jobs / Opportunities</div>
                <div style={styles.checkDesc}>Keep job status and opportunity stages in sync</div>
              </div>
            </label>

            <button
              onClick={handleSync}
              disabled={syncing || ghlStatus !== 'connected'}
              style={{
                ...styles.syncBtn,
                opacity: (syncing || ghlStatus !== 'connected') ? 0.5 : 1,
              }}
            >
              {syncing ? (
                <>
                  <div style={styles.btnSpinner} />
                  Syncing...
                </>
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Sync Now
                </>
              )}
            </button>

            {/* Sync Result */}
            {syncResult && (
              <div style={styles.syncResultBox}>
                <div style={styles.syncResultItem}>
                  <span style={{ color: '#22c55e' }}>{syncResult.contacts_synced}</span> contacts synced
                </div>
                <div style={styles.syncResultItem}>
                  <span style={{ color: '#a78bfa' }}>{syncResult.opportunities_synced}</span> opportunities synced
                </div>
                {syncResult.errors?.length > 0 && (
                  <div style={{ marginTop: '8px' }}>
                    <div style={{ color: '#ef4444', fontSize: '0.82em', marginBottom: '4px' }}>
                      {syncResult.errors.length} error(s):
                    </div>
                    {syncResult.errors.slice(0, 5).map((err, i) => (
                      <div key={i} style={{ color: '#9ca3af', fontSize: '0.78em', marginBottom: '2px' }}>
                        {err}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Recent Sync Log */}
        {ghlConfig?.last_sync_at && (
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <div style={styles.cardHeaderLeft}>
                <div style={{ ...styles.iconBox, background: 'rgba(56,189,248,0.12)', color: '#38bdf8' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                </div>
                <div>
                  <h2 style={styles.cardTitle}>Sync History</h2>
                  <p style={styles.cardDesc}>
                    Last synced: {new Date(ghlConfig.last_sync_at).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
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
    padding: '32px 0 24px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    marginBottom: '24px',
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
  card: {
    background: 'rgba(255,255,255,0.025)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '14px',
    marginBottom: '16px',
    overflow: 'hidden',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '18px 22px',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
  },
  cardHeaderLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
  },
  iconBox: {
    width: '44px',
    height: '44px',
    borderRadius: '12px',
    background: 'rgba(93,71,250,0.12)',
    color: '#5d47fa',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardTitle: {
    fontSize: '1.05em',
    fontWeight: 700,
    color: '#fff',
    margin: 0,
  },
  cardDesc: {
    fontSize: '0.82em',
    color: '#6b7280',
    margin: '2px 0 0',
  },
  cardBody: {
    padding: '20px 22px',
  },
  field: {
    marginBottom: '16px',
  },
  label: {
    display: 'block',
    fontSize: '0.82em',
    fontWeight: 600,
    color: '#9ca3af',
    marginBottom: '6px',
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
  btnRow: {
    display: 'flex',
    gap: '10px',
    marginTop: '4px',
  },
  testBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 20px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    color: '#e5e7eb',
    fontSize: '0.88em',
    fontWeight: 500,
    cursor: 'pointer',
  },
  saveBtn: {
    padding: '10px 20px',
    background: 'linear-gradient(135deg, #5d47fa 0%, #7c3aed 100%)',
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '0.88em',
    fontWeight: 600,
    cursor: 'pointer',
    boxShadow: '0 4px 16px rgba(93,71,250,0.35)',
  },
  checkboxRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    padding: '12px 0',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
    cursor: 'pointer',
  },
  checkbox: {
    marginTop: '3px',
    accentColor: '#5d47fa',
  },
  checkLabel: {
    fontSize: '0.92em',
    fontWeight: 600,
    color: '#f3f4f6',
  },
  checkDesc: {
    fontSize: '0.8em',
    color: '#6b7280',
    marginTop: '2px',
  },
  syncBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    width: '100%',
    padding: '12px 24px',
    background: 'linear-gradient(135deg, #5d47fa 0%, #7c3aed 100%)',
    borderRadius: '10px',
    color: '#fff',
    fontWeight: 600,
    fontSize: '0.9em',
    border: 'none',
    cursor: 'pointer',
    boxShadow: '0 4px 16px rgba(93,71,250,0.35)',
    marginTop: '16px',
  },
  btnSpinner: {
    width: '16px',
    height: '16px',
    border: '2px solid rgba(255,255,255,0.3)',
    borderTopColor: '#fff',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  syncResultBox: {
    padding: '14px 16px',
    background: 'rgba(34,197,94,0.06)',
    border: '1px solid rgba(34,197,94,0.2)',
    borderRadius: '8px',
    marginTop: '14px',
  },
  syncResultItem: {
    fontSize: '0.88em',
    color: '#e5e7eb',
    marginBottom: '4px',
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
