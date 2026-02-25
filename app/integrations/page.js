'use client';

import { useState, useEffect } from 'react';
import Nav from '../components/Nav';

export default function IntegrationsPage() {
  // Auth from localStorage
  const getUserId = () => {
    try { return localStorage.getItem('bb_user_id') || ''; } catch { return ''; }
  };
  const getGrantKey = () => {
    try { return localStorage.getItem('bb_grant_key') || ''; } catch { return ''; }
  };
  const getApiKey = () => {
    try { return localStorage.getItem('bb_api_key') || ''; } catch { return ''; }
  };

  // --- GoHighLevel State ---
  const [ghlApiKey, setGhlApiKey] = useState('');
  const [ghlLocationId, setGhlLocationId] = useState('');
  const [ghlStatus, setGhlStatus] = useState('disconnected');
  const [ghlConfig, setGhlConfig] = useState(null);
  const [ghlSyncDirection, setGhlSyncDirection] = useState('both');
  const [ghlFieldMappings, setGhlFieldMappings] = useState([
    { jtField: 'JT Job', ghlField: 'GHL Opportunity', enabled: true },
    { jtField: 'JT Contact', ghlField: 'GHL Contact', enabled: true },
    { jtField: 'JT Estimate', ghlField: 'GHL Opportunity Value', enabled: false },
    { jtField: 'JT Job Status', ghlField: 'GHL Pipeline Stage', enabled: false },
  ]);

  // --- Slack State ---
  const [slackWorkspaceUrl, setSlackWorkspaceUrl] = useState('');
  const [slackChannel, setSlackChannel] = useState('');
  const [slackChannels, setSlackChannels] = useState(['#general', '#sales', '#projects', '#notifications']);
  const [slackStatus, setSlackStatus] = useState('disconnected');
  const [slackNotifications, setSlackNotifications] = useState({
    newLeads: true,
    estimateSent: true,
    invoicePaid: true,
    dailySummary: false,
  });

  // --- Sync State ---
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [syncLogs, setSyncLogs] = useState([]);
  const [saving, setSaving] = useState(false);
  const [testingGhl, setTestingGhl] = useState(false);
  const [testingSlack, setTestingSlack] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadConfig();
    loadSyncLogs();
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
          if (data.config.sync_direction) setGhlSyncDirection(data.config.sync_direction);
          if (data.config.has_api_key) setGhlStatus('connected');
          if (data.config.field_mappings) {
            try {
              const mappings = typeof data.config.field_mappings === 'string'
                ? JSON.parse(data.config.field_mappings)
                : data.config.field_mappings;
              if (Array.isArray(mappings)) setGhlFieldMappings(mappings);
            } catch { /* keep defaults */ }
          }
        }
        // Load slack config if present
        if (data.slack) {
          if (data.slack.workspace_url) setSlackWorkspaceUrl(data.slack.workspace_url);
          if (data.slack.channel) setSlackChannel(data.slack.channel);
          if (data.slack.connected) setSlackStatus('connected');
          if (data.slack.notifications) setSlackNotifications(data.slack.notifications);
        }
      }
    } catch (err) {
      console.error('Failed to load config:', err);
    }
  };

  const loadSyncLogs = async () => {
    const userId = getUserId();
    if (!userId) return;
    try {
      const res = await fetch(`/api/integrations/ghl/sync?userId=${userId}&logs=true`);
      if (res.ok) {
        const data = await res.json();
        setSyncLogs(data.logs || []);
      }
    } catch { /* ok */ }
  };

  const handleTestGhlConnection = async () => {
    if (!ghlApiKey && !ghlConfig?.has_api_key) {
      setError('Please enter your GHL API key first.');
      return;
    }

    setTestingGhl(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/integrations/ghl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'test',
          userId: getUserId(),
          apiKey: ghlApiKey || undefined,
          locationId: ghlLocationId,
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
    } finally {
      setTestingGhl(false);
    }
  };

  const handleTestSlackConnection = async () => {
    if (!slackWorkspaceUrl) {
      setError('Please enter your Slack workspace URL.');
      return;
    }

    setTestingSlack(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/integrations/ghl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'test_slack',
          userId: getUserId(),
          workspaceUrl: slackWorkspaceUrl,
          channel: slackChannel,
        }),
      });

      if (res.ok) {
        setSlackStatus('connected');
        setSuccess('Slack workspace connected!');
      } else {
        const data = await res.json();
        setSlackStatus('error');
        setError(data.error || 'Failed to connect to Slack');
      }
    } catch (err) {
      setSlackStatus('error');
      setError('Slack test failed: ' + err.message);
    } finally {
      setTestingSlack(false);
    }
  };

  const handleSaveAll = async () => {
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/integrations/ghl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_config',
          userId: getUserId(),
          apiKey: ghlApiKey || undefined,
          locationId: ghlLocationId,
          syncDirection: ghlSyncDirection,
          fieldMappings: ghlFieldMappings,
          slack: {
            workspaceUrl: slackWorkspaceUrl,
            channel: slackChannel,
            notifications: slackNotifications,
          },
        }),
      });

      if (res.ok) {
        setSuccess('All integration settings saved.');
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
    setSuccess('');

    try {
      const res = await fetch('/api/integrations/ghl/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: getUserId(),
          grantKey: getGrantKey(),
          direction: ghlSyncDirection,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setSyncResult(data.results);
        setSuccess(
          `Sync complete! ${data.results?.contacts_synced || 0} contacts, ${data.results?.opportunities_synced || 0} opportunities synced.`
        );
        loadSyncLogs();
      } else {
        setError(data.error || 'Sync failed');
      }
    } catch (err) {
      setError('Sync failed: ' + err.message);
    } finally {
      setSyncing(false);
    }
  };

  const toggleFieldMapping = (index) => {
    setGhlFieldMappings((prev) =>
      prev.map((m, i) => (i === index ? { ...m, enabled: !m.enabled } : m))
    );
  };

  const statusConfig = {
    disconnected: { bg: 'rgba(107,114,128,0.1)', color: '#6b7280', label: 'Not Connected', dot: '#6b7280' },
    testing: { bg: 'rgba(251,191,36,0.1)', color: '#fbbf24', label: 'Testing...', dot: '#fbbf24' },
    connected: { bg: 'rgba(34,197,94,0.1)', color: '#22c55e', label: 'Connected', dot: '#22c55e' },
    error: { bg: 'rgba(239,68,68,0.1)', color: '#ef4444', label: 'Error', dot: '#ef4444' },
  };

  const ghlStatusInfo = statusConfig[ghlStatus];
  const slackStatusInfo = statusConfig[slackStatus];

  const formatSyncDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

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

        {/* ================================================ */}
        {/* GoHighLevel Integration Card */}
        {/* ================================================ */}
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
                <p style={styles.cardDesc}>CRM & marketing automation platform</p>
              </div>
            </div>
            <span style={{
              padding: '4px 12px',
              borderRadius: '6px',
              fontSize: '0.78em',
              fontWeight: 600,
              background: ghlStatusInfo.bg,
              color: ghlStatusInfo.color,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}>
              <span style={{
                width: '6px', height: '6px', borderRadius: '50%',
                background: ghlStatusInfo.dot,
              }} />
              {ghlStatusInfo.label}
            </span>
          </div>

          <div style={styles.cardBody}>
            {/* API Key */}
            <div style={styles.field}>
              <label style={styles.label}>API Key</label>
              <input
                type="password"
                value={ghlApiKey}
                onChange={(e) => setGhlApiKey(e.target.value)}
                placeholder={ghlConfig?.has_api_key ? 'Key saved (enter new to update)' : 'Enter your GoHighLevel API key'}
                style={styles.input}
              />
            </div>

            {/* Location ID */}
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

            {/* Field Mapping */}
            <div style={styles.field}>
              <label style={styles.label}>Field Mapping</label>
              <div style={styles.mappingList}>
                {ghlFieldMappings.map((mapping, i) => (
                  <div key={i} style={styles.mappingRow}>
                    <label style={styles.mappingCheckbox}>
                      <input
                        type="checkbox"
                        checked={mapping.enabled}
                        onChange={() => toggleFieldMapping(i)}
                        style={{ accentColor: '#5d47fa' }}
                      />
                    </label>
                    <div style={{
                      ...styles.mappingField,
                      opacity: mapping.enabled ? 1 : 0.4,
                    }}>
                      <span style={styles.mappingLabel}>{mapping.jtField}</span>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5d47fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="5" y1="12" x2="19" y2="12" />
                        <polyline points="12 5 19 12 12 19" />
                      </svg>
                      <span style={styles.mappingLabel}>{mapping.ghlField}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Sync Direction Toggle */}
            <div style={styles.field}>
              <label style={styles.label}>Sync Direction</label>
              <div style={styles.toggleGroup}>
                {[
                  { value: 'jt_to_ghl', label: 'JT → GHL' },
                  { value: 'ghl_to_jt', label: 'GHL → JT' },
                  { value: 'both', label: 'Bidirectional' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setGhlSyncDirection(opt.value)}
                    style={{
                      ...styles.toggleBtn,
                      ...(ghlSyncDirection === opt.value ? styles.toggleBtnActive : {}),
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div style={styles.btnRow}>
              <button
                onClick={handleTestGhlConnection}
                disabled={testingGhl}
                style={{
                  ...styles.testBtn,
                  opacity: testingGhl ? 0.5 : 1,
                }}
              >
                {testingGhl ? (
                  <>
                    <div style={styles.btnSpinner} />
                    Testing...
                  </>
                ) : (
                  'Test Connection'
                )}
              </button>
              <button
                onClick={handleSaveAll}
                disabled={saving}
                style={{
                  ...styles.purpleBtn,
                  opacity: saving ? 0.5 : 1,
                }}
              >
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </div>
        </div>

        {/* ================================================ */}
        {/* Slack Integration Card */}
        {/* ================================================ */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <div style={styles.cardHeaderLeft}>
              <div style={{ ...styles.iconBox, background: 'rgba(74,21,75,0.3)', color: '#e01e5a' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14.5 2c-.83 0-1.5.67-1.5 1.5v5c0 .83.67 1.5 1.5 1.5H20c.83 0 1.5-.67 1.5-1.5S20.83 7 20 7h-4V3.5c0-.83-.67-1.5-1.5-1.5z" />
                  <path d="M9.5 22c.83 0 1.5-.67 1.5-1.5v-5c0-.83-.67-1.5-1.5-1.5H4c-.83 0-1.5.67-1.5 1.5S3.17 17 4 17h4v3.5c0 .83.67 1.5 1.5 1.5z" />
                  <path d="M22 14.5c0-.83-.67-1.5-1.5-1.5h-5c-.83 0-1.5.67-1.5 1.5V20c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5v-4h3.5c.83 0 1.5-.67 1.5-1.5z" />
                  <path d="M2 9.5c0 .83.67 1.5 1.5 1.5h5c.83 0 1.5-.67 1.5-1.5V4c0-.83-.67-1.5-1.5-1.5S7 3.17 7 4v4H3.5C2.67 8 2 8.67 2 9.5z" />
                </svg>
              </div>
              <div>
                <h2 style={styles.cardTitle}>Slack</h2>
                <p style={styles.cardDesc}>Team messaging & notifications</p>
              </div>
            </div>
            <span style={{
              padding: '4px 12px',
              borderRadius: '6px',
              fontSize: '0.78em',
              fontWeight: 600,
              background: slackStatusInfo.bg,
              color: slackStatusInfo.color,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}>
              <span style={{
                width: '6px', height: '6px', borderRadius: '50%',
                background: slackStatusInfo.dot,
              }} />
              {slackStatusInfo.label}
            </span>
          </div>

          <div style={styles.cardBody}>
            {/* Workspace URL */}
            <div style={styles.field}>
              <label style={styles.label}>Workspace URL</label>
              <input
                type="text"
                value={slackWorkspaceUrl}
                onChange={(e) => setSlackWorkspaceUrl(e.target.value)}
                placeholder="https://your-workspace.slack.com"
                style={styles.input}
              />
            </div>

            {/* Channel Selector */}
            <div style={styles.field}>
              <label style={styles.label}>Notification Channel</label>
              <select
                value={slackChannel}
                onChange={(e) => setSlackChannel(e.target.value)}
                style={styles.selectInput}
              >
                <option value="">Select a channel...</option>
                {slackChannels.map((ch) => (
                  <option key={ch} value={ch}>{ch}</option>
                ))}
              </select>
            </div>

            {/* Notification Preferences */}
            <div style={styles.field}>
              <label style={styles.label}>Notification Preferences</label>
              <div style={styles.notifList}>
                {[
                  { key: 'newLeads', label: 'New Leads', desc: 'Get notified when a new lead is created' },
                  { key: 'estimateSent', label: 'Estimate Sent', desc: 'Alert when an estimate is sent to a client' },
                  { key: 'invoicePaid', label: 'Invoice Paid', desc: 'Notification when a payment is received' },
                  { key: 'dailySummary', label: 'Daily Summary', desc: 'End-of-day summary of all activity' },
                ].map((notif) => (
                  <label key={notif.key} style={styles.notifRow}>
                    <input
                      type="checkbox"
                      checked={slackNotifications[notif.key]}
                      onChange={(e) => setSlackNotifications((prev) => ({
                        ...prev,
                        [notif.key]: e.target.checked,
                      }))}
                      style={{ accentColor: '#5d47fa', marginTop: '3px' }}
                    />
                    <div>
                      <div style={styles.notifLabel}>{notif.label}</div>
                      <div style={styles.notifDesc}>{notif.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div style={styles.btnRow}>
              <button
                onClick={handleTestSlackConnection}
                disabled={testingSlack}
                style={{
                  ...styles.testBtn,
                  opacity: testingSlack ? 0.5 : 1,
                }}
              >
                {testingSlack ? (
                  <>
                    <div style={styles.btnSpinner} />
                    Testing...
                  </>
                ) : (
                  'Test Connection'
                )}
              </button>
              <button
                onClick={handleSaveAll}
                disabled={saving}
                style={{
                  ...styles.purpleBtn,
                  opacity: saving ? 0.5 : 1,
                }}
              >
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </div>
        </div>

        {/* ================================================ */}
        {/* Sync Now Section */}
        {/* ================================================ */}
        {ghlStatus === 'connected' && (
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
                  <h2 style={styles.cardTitle}>Run Sync</h2>
                  <p style={styles.cardDesc}>
                    Sync data between JobTread and GoHighLevel ({ghlSyncDirection === 'both' ? 'bidirectional' : ghlSyncDirection.replace('_', ' → ').replace('jt', 'JT').replace('ghl', 'GHL')})
                  </p>
                </div>
              </div>
            </div>
            <div style={styles.cardBody}>
              <button
                onClick={handleSync}
                disabled={syncing}
                style={{
                  ...styles.syncBtn,
                  opacity: syncing ? 0.5 : 1,
                }}
              >
                {syncing ? (
                  <>
                    <div style={styles.btnSpinner} />
                    Syncing data...
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

              {syncResult && (
                <div style={styles.syncResultBox}>
                  <div style={styles.syncResultRow}>
                    <span style={{ color: '#22c55e', fontWeight: 700, fontSize: '1.1em' }}>{syncResult.contacts_synced || 0}</span>
                    <span style={{ color: '#9ca3af', fontSize: '0.85em' }}>contacts synced</span>
                  </div>
                  <div style={styles.syncResultRow}>
                    <span style={{ color: '#a78bfa', fontWeight: 700, fontSize: '1.1em' }}>{syncResult.opportunities_synced || 0}</span>
                    <span style={{ color: '#9ca3af', fontSize: '0.85em' }}>opportunities synced</span>
                  </div>
                  {syncResult.errors?.length > 0 && (
                    <div style={{ marginTop: '10px', padding: '8px 10px', background: 'rgba(239,68,68,0.06)', borderRadius: '6px' }}>
                      <div style={{ color: '#ef4444', fontSize: '0.82em', fontWeight: 600, marginBottom: '4px' }}>
                        {syncResult.errors.length} error(s)
                      </div>
                      {syncResult.errors.slice(0, 5).map((err, i) => (
                        <div key={i} style={{ color: '#9ca3af', fontSize: '0.78em', marginBottom: '2px' }}>{err}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================================================ */}
        {/* Sync Log Section */}
        {/* ================================================ */}
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
                <h2 style={styles.cardTitle}>Sync Activity Log</h2>
                <p style={styles.cardDesc}>Recent synchronization history</p>
              </div>
            </div>
          </div>
          <div style={styles.cardBody}>
            {syncLogs.length === 0 ? (
              <div style={styles.emptySyncLog}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#4b5563" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <p style={{ color: '#6b7280', fontSize: '0.88em', margin: '10px 0 0' }}>
                  No sync activity yet. Connect an integration and run your first sync.
                </p>
              </div>
            ) : (
              <div style={styles.syncLogList}>
                {syncLogs.slice(0, 10).map((entry, i) => (
                  <div key={i} style={styles.syncLogRow}>
                    <div style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: entry.status === 'success' ? '#22c55e'
                        : entry.status === 'failed' ? '#ef4444'
                        : '#fbbf24',
                      marginTop: '6px',
                      flexShrink: 0,
                    }} />
                    <div style={{ flex: 1 }}>
                      <div style={styles.syncLogTitle}>
                        {entry.integration || 'GoHighLevel'} sync
                        <span style={{
                          ...styles.syncLogStatus,
                          color: entry.status === 'success' ? '#22c55e'
                            : entry.status === 'failed' ? '#ef4444'
                            : '#fbbf24',
                        }}>
                          {entry.status}
                        </span>
                      </div>
                      <div style={styles.syncLogMeta}>
                        {formatSyncDate(entry.created_at || entry.timestamp)}
                        {entry.details && <span> — {entry.details}</span>}
                        {entry.contacts_synced != null && (
                          <span> — {entry.contacts_synced} contacts, {entry.opportunities_synced || 0} opportunities</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
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
    maxWidth: '740px',
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
    background: '#12131a',
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
    marginBottom: '18px',
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
  selectInput: {
    width: '100%',
    padding: '10px 14px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    color: '#e5e7eb',
    fontSize: '0.9em',
    outline: 'none',
    boxSizing: 'border-box',
    appearance: 'auto',
  },
  mappingList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  mappingRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '8px 12px',
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(255,255,255,0.04)',
    borderRadius: '8px',
  },
  mappingCheckbox: {
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
  },
  mappingField: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flex: 1,
    transition: 'opacity 0.2s',
  },
  mappingLabel: {
    fontSize: '0.85em',
    color: '#d1d5db',
    fontWeight: 500,
  },
  toggleGroup: {
    display: 'flex',
    gap: '4px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '8px',
    padding: '4px',
  },
  toggleBtn: {
    flex: 1,
    padding: '8px 12px',
    background: 'transparent',
    border: 'none',
    borderRadius: '6px',
    color: '#6b7280',
    fontSize: '0.82em',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  toggleBtnActive: {
    background: 'linear-gradient(135deg, #5d47fa 0%, #7c3aed 100%)',
    color: '#fff',
    fontWeight: 600,
    boxShadow: '0 2px 8px rgba(93,71,250,0.3)',
  },
  notifList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  notifRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    padding: '10px 12px',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'background 0.15s',
  },
  notifLabel: {
    fontSize: '0.9em',
    fontWeight: 600,
    color: '#f3f4f6',
  },
  notifDesc: {
    fontSize: '0.78em',
    color: '#6b7280',
    marginTop: '1px',
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
  purpleBtn: {
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
    display: 'flex',
    gap: '20px',
    padding: '16px',
    background: 'rgba(34,197,94,0.06)',
    border: '1px solid rgba(34,197,94,0.15)',
    borderRadius: '10px',
    marginTop: '14px',
    flexWrap: 'wrap',
  },
  syncResultRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  emptySyncLog: {
    textAlign: 'center',
    padding: '30px 20px',
  },
  syncLogList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  syncLogRow: {
    display: 'flex',
    gap: '10px',
    padding: '10px 0',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
  },
  syncLogTitle: {
    fontSize: '0.88em',
    fontWeight: 600,
    color: '#f3f4f6',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  syncLogStatus: {
    fontSize: '0.78em',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.3px',
  },
  syncLogMeta: {
    fontSize: '0.78em',
    color: '#6b7280',
    marginTop: '2px',
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
