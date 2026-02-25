'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SetupPage() {
  const router = useRouter();
  const [step, setStep] = useState(0); // 0=checking, 1=db_missing, 2=needs_setup, 3=api_keys, 4=done
  const [dbStatus, setDbStatus] = useState(null);
  const [setting, setSetting] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [grantKey, setGrantKey] = useState('');
  const [error, setError] = useState('');
  const [testingJT, setTestingJT] = useState(false);
  const [jtResult, setJtResult] = useState(null);

  useEffect(() => {
    checkStatus();
    setApiKey(localStorage.getItem('mrBetterBoss_apiKey') || '');
    setGrantKey(localStorage.getItem('bb_jobtread_grant_key') || '');
  }, []);

  const checkStatus = async () => {
    try {
      const res = await fetch('/api/setup');
      const data = await res.json();
      setDbStatus(data);

      if (data.status === 'no_database') setStep(1);
      else if (data.status === 'needs_setup') setStep(2);
      else if (data.status === 'ready') setStep(3);
      else if (data.status === 'error') {
        setStep(1);
        setError(data.message);
      }
    } catch (err) {
      setStep(1);
      setError('Could not reach the server: ' + err.message);
    }
  };

  const runSetup = async () => {
    setSetting(true);
    setError('');
    try {
      const res = await fetch('/api/setup', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setStep(3);
    } catch (err) {
      setError(err.message);
    } finally {
      setSetting(false);
    }
  };

  const saveKeys = () => {
    if (apiKey) localStorage.setItem('mrBetterBoss_apiKey', apiKey);
    if (grantKey) localStorage.setItem('bb_jobtread_grant_key', grantKey);
    setStep(4);
    setTimeout(() => router.push('/estimate'), 1500);
  };

  const testJobTread = async () => {
    if (!grantKey) return;
    setTestingJT(true);
    setJtResult(null);
    try {
      // Quick test by trying to fetch estimates (which hits the DB, not JT)
      // For JT we'd need a test endpoint, but let's just save the key
      localStorage.setItem('bb_jobtread_grant_key', grantKey);
      setJtResult({ success: true });
    } catch (err) {
      setJtResult({ success: false, error: err.message });
    } finally {
      setTestingJT(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.logoBox}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
        </div>
        <h1 style={styles.title}>Better Boss Estimator</h1>
        <p style={styles.subtitle}>Let's get your estimating app set up</p>

        {/* Progress Steps */}
        <div style={styles.steps}>
          {['Database', 'Tables', 'API Keys', 'Ready'].map((label, i) => (
            <div key={i} style={styles.stepRow}>
              <div style={{
                ...styles.stepDot,
                background: step > i ? '#22c55e' : step === i ? '#5d47fa' : 'rgba(255,255,255,0.08)',
                color: step >= i ? '#fff' : '#6b7280',
              }}>
                {step > i ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  i + 1
                )}
              </div>
              <span style={{ color: step >= i ? '#e5e7eb' : '#4b5563', fontSize: '0.82em', fontWeight: 500 }}>{label}</span>
              {i < 3 && <div style={{ ...styles.stepLine, background: step > i ? '#22c55e' : 'rgba(255,255,255,0.06)' }} />}
            </div>
          ))}
        </div>

        {error && (
          <div style={styles.errorBox}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
            </svg>
            {error}
          </div>
        )}

        {/* Step 0: Checking */}
        {step === 0 && (
          <div style={styles.card}>
            <div style={styles.spinnerWrap}>
              <div style={styles.spinner} />
              <p style={{ color: '#9ca3af' }}>Checking database connection...</p>
            </div>
          </div>
        )}

        {/* Step 1: No Database */}
        {step === 1 && (
          <div style={styles.card}>
            <div style={styles.cardIcon}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#f59e0b' }}>
                <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 style={styles.cardTitle}>Database Not Connected</h2>
            <p style={styles.cardDesc}>
              Your Vercel project needs a Neon Postgres database. Follow these steps:
            </p>
            <div style={styles.instructionList}>
              <div style={styles.instruction}>
                <span style={styles.instrNum}>1</span>
                <div>
                  <strong>Go to your Vercel Dashboard</strong>
                  <p style={styles.instrText}>Open your project settings in Vercel</p>
                </div>
              </div>
              <div style={styles.instruction}>
                <span style={styles.instrNum}>2</span>
                <div>
                  <strong>Go to Storage tab</strong>
                  <p style={styles.instrText}>Click "Storage" in the left sidebar, then "Connect Database"</p>
                </div>
              </div>
              <div style={styles.instruction}>
                <span style={styles.instrNum}>3</span>
                <div>
                  <strong>Add Neon Postgres</strong>
                  <p style={styles.instrText}>Select "Neon" and create a new database. This auto-sets DATABASE_URL.</p>
                </div>
              </div>
              <div style={styles.instruction}>
                <span style={styles.instrNum}>4</span>
                <div>
                  <strong>Redeploy</strong>
                  <p style={styles.instrText}>After connecting, redeploy your app so it picks up the new env var.</p>
                </div>
              </div>
            </div>
            <button onClick={checkStatus} style={styles.primaryBtn}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Check Again
            </button>
          </div>
        )}

        {/* Step 2: Needs Table Setup */}
        {step === 2 && (
          <div style={styles.card}>
            <div style={styles.cardIcon}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#a78bfa' }}>
                <ellipse cx="12" cy="5" rx="9" ry="3" />
                <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
                <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
              </svg>
            </div>
            <h2 style={styles.cardTitle}>Database Connected!</h2>
            <p style={styles.cardDesc}>
              Your Neon database is connected. Now we need to create the tables for estimates, line items, catalog, and takeoffs.
            </p>
            <button onClick={runSetup} disabled={setting} style={styles.primaryBtn}>
              {setting ? (
                <><div style={styles.btnSpinner} /> Creating tables...</>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                  </svg>
                  Set Up Database Tables
                </>
              )}
            </button>
          </div>
        )}

        {/* Step 3: API Keys */}
        {step === 3 && (
          <div style={styles.card}>
            <div style={styles.cardIcon}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#22c55e' }}>
                <path d="M15 7h3a5 5 0 015 5 5 5 0 01-5 5h-3m-6 0H6a5 5 0 01-5-5 5 5 0 015-5h3" />
                <line x1="8" y1="12" x2="16" y2="12" />
              </svg>
            </div>
            <h2 style={styles.cardTitle}>Connect Your APIs</h2>
            <p style={styles.cardDesc}>
              These keys are stored in your browser only. They're never saved on our server.
            </p>

            <div style={styles.keySection}>
              <div style={styles.keyHeader}>
                <strong style={{ color: '#e5e7eb' }}>Anthropic API Key</strong>
                <span style={styles.keyBadge}>For AI features</span>
              </div>
              <p style={styles.keyDesc}>Powers AI scope parsing, estimate review, blueprint analysis, and quote generation.</p>
              <input
                style={styles.keyInput}
                type="password"
                placeholder="sk-ant-api03-..."
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
              />
            </div>

            <div style={styles.keySection}>
              <div style={styles.keyHeader}>
                <strong style={{ color: '#e5e7eb' }}>JobTread Grant Key</strong>
                <span style={{ ...styles.keyBadge, background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}>For JT sync</span>
              </div>
              <p style={styles.keyDesc}>
                Syncs estimates to JobTread as customer orders. Get your grant key from JobTread Settings &gt; API.
              </p>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  style={{ ...styles.keyInput, flex: 1 }}
                  type="password"
                  placeholder="Your JobTread grant key"
                  value={grantKey}
                  onChange={e => setGrantKey(e.target.value)}
                />
              </div>
              {jtResult && (
                <div style={{ ...styles.testResult, color: jtResult.success ? '#22c55e' : '#ef4444' }}>
                  {jtResult.success ? 'Key saved!' : jtResult.error}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
              <button onClick={() => { router.push('/estimate'); }} style={styles.skipBtn}>
                Skip for now
              </button>
              <button onClick={saveKeys} style={styles.primaryBtn}>
                Save & Continue
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Done */}
        {step === 4 && (
          <div style={styles.card}>
            <div style={{ ...styles.cardIcon, background: 'rgba(34,197,94,0.1)' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#22c55e' }}>
                <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <h2 style={styles.cardTitle}>All Set!</h2>
            <p style={styles.cardDesc}>Redirecting to your estimates...</p>
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
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
  },
  container: {
    maxWidth: '520px',
    width: '100%',
    textAlign: 'center',
  },
  logoBox: {
    width: '52px',
    height: '52px',
    borderRadius: '14px',
    background: 'linear-gradient(135deg, #5d47fa, #7c3aed)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    margin: '0 auto 16px',
    boxShadow: '0 4px 20px rgba(93,71,250,0.4)',
  },
  title: {
    fontSize: '1.6em',
    fontWeight: 800,
    color: '#fff',
    margin: '0 0 4px',
    letterSpacing: '-0.02em',
  },
  subtitle: {
    color: '#6b7280',
    fontSize: '0.9em',
    margin: '0 0 32px',
  },
  steps: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0',
    marginBottom: '28px',
  },
  stepRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  stepDot: {
    width: '26px',
    height: '26px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.72em',
    fontWeight: 700,
    flexShrink: 0,
  },
  stepLine: {
    width: '24px',
    height: '2px',
    borderRadius: '1px',
    marginLeft: '6px',
  },
  card: {
    background: 'rgba(255,255,255,0.025)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '16px',
    padding: '32px 28px',
    textAlign: 'left',
  },
  cardIcon: {
    width: '48px',
    height: '48px',
    borderRadius: '12px',
    background: 'rgba(255,255,255,0.04)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '16px',
  },
  cardTitle: {
    fontSize: '1.2em',
    fontWeight: 700,
    color: '#fff',
    margin: '0 0 8px',
  },
  cardDesc: {
    color: '#9ca3af',
    fontSize: '0.88em',
    lineHeight: 1.6,
    margin: '0 0 20px',
  },
  instructionList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    marginBottom: '20px',
  },
  instruction: {
    display: 'flex',
    gap: '12px',
    alignItems: 'flex-start',
  },
  instrNum: {
    width: '24px',
    height: '24px',
    borderRadius: '6px',
    background: 'rgba(93,71,250,0.15)',
    color: '#a78bfa',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.72em',
    fontWeight: 700,
    flexShrink: 0,
  },
  instrText: {
    color: '#6b7280',
    fontSize: '0.82em',
    margin: '2px 0 0',
    lineHeight: 1.4,
  },
  primaryBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 22px',
    background: 'linear-gradient(135deg, #5d47fa 0%, #7c3aed 100%)',
    borderRadius: '10px',
    color: '#fff',
    fontWeight: 600,
    fontSize: '0.88em',
    border: 'none',
    cursor: 'pointer',
    boxShadow: '0 4px 16px rgba(93,71,250,0.3)',
  },
  skipBtn: {
    padding: '10px 18px',
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '10px',
    color: '#6b7280',
    fontSize: '0.88em',
    fontWeight: 500,
    cursor: 'pointer',
  },
  keySection: {
    marginBottom: '20px',
    padding: '16px',
    background: 'rgba(255,255,255,0.02)',
    borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.04)',
  },
  keyHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '4px',
  },
  keyBadge: {
    padding: '2px 8px',
    background: 'rgba(139,92,246,0.1)',
    color: '#a78bfa',
    borderRadius: '5px',
    fontSize: '0.68em',
    fontWeight: 600,
  },
  keyDesc: {
    color: '#6b7280',
    fontSize: '0.8em',
    margin: '0 0 10px',
    lineHeight: 1.4,
  },
  keyInput: {
    width: '100%',
    padding: '9px 12px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '8px',
    color: '#e5e7eb',
    fontSize: '0.88em',
    fontFamily: 'inherit',
    outline: 'none',
    boxSizing: 'border-box',
  },
  testResult: {
    fontSize: '0.78em',
    marginTop: '6px',
    fontWeight: 500,
  },
  errorBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 14px',
    background: 'rgba(239,68,68,0.08)',
    border: '1px solid rgba(239,68,68,0.2)',
    borderRadius: '10px',
    color: '#ef4444',
    fontSize: '0.85em',
    marginBottom: '16px',
    textAlign: 'left',
  },
  spinnerWrap: {
    textAlign: 'center',
    padding: '20px 0',
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
  btnSpinner: {
    width: '14px',
    height: '14px',
    border: '2px solid rgba(255,255,255,0.3)',
    borderTopColor: '#fff',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
};
