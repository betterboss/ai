'use client';

import { useState, useEffect } from 'react';
import Nav from '../components/Nav';

const STATUS_COLORS = {
  draft: { bg: 'rgba(107,114,128,0.12)', color: '#9ca3af', border: 'rgba(107,114,128,0.25)' },
  sent: { bg: 'rgba(59,130,246,0.12)', color: '#60a5fa', border: 'rgba(59,130,246,0.25)' },
  approved: { bg: 'rgba(34,197,94,0.12)', color: '#22c55e', border: 'rgba(34,197,94,0.25)' },
  rejected: { bg: 'rgba(239,68,68,0.12)', color: '#ef4444', border: 'rgba(239,68,68,0.25)' },
};

const REASON_LABELS = {
  client_request: 'Client Request',
  unforeseen_conditions: 'Unforeseen Conditions',
  design_change: 'Design Change',
  material_substitution: 'Material Substitution',
};

export default function ChangeOrdersPage() {
  const [changeOrders, setChangeOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [syncing, setSyncing] = useState(null);

  useEffect(() => {
    loadChangeOrders();
  }, []);

  const loadChangeOrders = async () => {
    setLoading(true);
    try {
      const userId = localStorage.getItem('bb_user_id') || '';
      const params = userId ? `?userId=${userId}` : '';
      const res = await fetch(`/api/change-orders${params}`);
      if (res.ok) {
        const data = await res.json();
        setChangeOrders(data.changeOrders || []);
      }
    } catch (err) {
      console.error('Failed to load change orders:', err);
    } finally {
      setLoading(false);
    }
  };

  const deleteChangeOrder = async (id) => {
    if (!confirm('Delete this change order? This cannot be undone.')) return;
    try {
      const res = await fetch(`/api/change-orders/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setChangeOrders((prev) => prev.filter((co) => co.id !== id));
      }
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const syncToJobTread = async (id) => {
    const grantKey = localStorage.getItem('bb_jt_grant_key');
    if (!grantKey) {
      alert('No JobTread grant key found. Please configure it in Setup.');
      return;
    }
    setSyncing(id);
    try {
      const res = await fetch(`/api/change-orders/${id}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grantKey }),
      });
      const data = await res.json();
      if (res.ok) {
        alert('Change order synced to JobTread!');
        loadChangeOrders();
      } else {
        alert(data.error || 'Sync failed');
      }
    } catch (err) {
      alert('Sync failed: ' + err.message);
    } finally {
      setSyncing(null);
    }
  };

  const filteredOrders = filter
    ? changeOrders.filter((co) => co.status === filter)
    : changeOrders;

  const totalPriceImpact = changeOrders.reduce(
    (s, co) => s + (parseFloat(co.price_impact) || 0),
    0
  );
  const draftCount = changeOrders.filter((co) => co.status === 'draft').length;
  const approvedCount = changeOrders.filter((co) => co.status === 'approved').length;

  const stats = [
    { label: 'Total COs', value: String(changeOrders.length), color: '#a78bfa' },
    { label: 'Drafts', value: String(draftCount), color: '#9ca3af' },
    { label: 'Approved', value: String(approvedCount), color: '#22c55e' },
    {
      label: 'Price Impact',
      value:
        (totalPriceImpact >= 0 ? '+$' : '-$') +
        Math.abs(totalPriceImpact).toLocaleString('en-US', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }),
      color: totalPriceImpact >= 0 ? '#22c55e' : '#ef4444',
    },
  ];

  return (
    <div style={styles.page}>
      <Nav />
      <div style={styles.container}>
        <div style={styles.hero}>
          <div style={styles.heroContent}>
            <div>
              <h1 style={styles.title}>Change Orders</h1>
              <p style={styles.subtitle}>
                Track scope changes, cost impacts, and approvals
              </p>
            </div>
            <a href="/change-orders/new" style={styles.primaryBtn}>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
              New Change Order
            </a>
          </div>

          <div style={styles.statsRow}>
            {stats.map((stat, i) => (
              <div key={i} style={styles.statCard}>
                <div style={styles.statValue}>{stat.value}</div>
                <div style={{ ...styles.statLabel, color: stat.color }}>
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Filter row */}
        <div style={styles.filterRow}>
          {['', 'draft', 'sent', 'approved', 'rejected'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                ...styles.filterBtn,
                ...(filter === f ? styles.filterActive : {}),
              }}
            >
              {f || 'All'}
            </button>
          ))}
        </div>

        {/* List */}
        {loading ? (
          <div style={styles.loadingWrap}>
            <div style={styles.spinner} />
            <p style={styles.loadingText}>Loading change orders...</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#4b5563"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="12" y1="18" x2="12" y2="12" />
                <line x1="9" y1="15" x2="15" y2="15" />
              </svg>
            </div>
            <h3 style={styles.emptyTitle}>No change orders yet</h3>
            <p style={styles.emptyText}>
              Create a change order to track scope and cost changes.
            </p>
            <a href="/change-orders/new" style={styles.primaryBtn}>
              Create Change Order
            </a>
          </div>
        ) : (
          <div style={styles.list}>
            {filteredOrders.map((co) => {
              const statusStyle =
                STATUS_COLORS[co.status] || STATUS_COLORS.draft;
              const costImpact = parseFloat(co.cost_impact) || 0;
              const priceImpact = parseFloat(co.price_impact) || 0;
              return (
                <div key={co.id} style={styles.card}>
                  <div style={styles.cardHeader}>
                    <div style={styles.cardHeaderLeft}>
                      <div style={styles.cardTitle}>
                        {co.description || 'Untitled Change Order'}
                      </div>
                      {co.estimate_name && (
                        <div style={styles.cardEstimate}>
                          {co.estimate_name}
                          {co.client_name ? ` - ${co.client_name}` : ''}
                        </div>
                      )}
                      <div style={styles.cardMeta}>
                        <span
                          style={{
                            ...styles.statusBadge,
                            background: statusStyle.bg,
                            color: statusStyle.color,
                            border: `1px solid ${statusStyle.border}`,
                          }}
                        >
                          {co.status || 'draft'}
                        </span>
                        {co.reason && (
                          <span style={styles.reasonTag}>
                            {REASON_LABELS[co.reason] || co.reason}
                          </span>
                        )}
                        {co.jobtread_synced && (
                          <span style={styles.syncedBadge}>JT Synced</span>
                        )}
                        <span style={styles.dateText}>
                          {new Date(co.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    <div style={styles.cardHeaderRight}>
                      <div style={styles.impactGroup}>
                        <div style={styles.impactLabel}>Cost</div>
                        <div
                          style={{
                            ...styles.impactValue,
                            color:
                              costImpact > 0
                                ? '#ef4444'
                                : costImpact < 0
                                ? '#22c55e'
                                : '#6b7280',
                          }}
                        >
                          {costImpact >= 0 ? '+' : ''}$
                          {Math.abs(costImpact).toLocaleString('en-US', {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 0,
                          })}
                        </div>
                      </div>
                      <div style={styles.impactGroup}>
                        <div style={styles.impactLabel}>Price</div>
                        <div
                          style={{
                            ...styles.impactValue,
                            color:
                              priceImpact > 0
                                ? '#22c55e'
                                : priceImpact < 0
                                ? '#ef4444'
                                : '#6b7280',
                          }}
                        >
                          {priceImpact >= 0 ? '+' : ''}$
                          {Math.abs(priceImpact).toLocaleString('en-US', {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 0,
                          })}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div style={styles.cardActions}>
                    <button
                      onClick={() => syncToJobTread(co.id)}
                      disabled={syncing === co.id || co.jobtread_synced}
                      style={{
                        ...styles.actionBtn,
                        ...styles.syncBtn,
                        opacity:
                          syncing === co.id || co.jobtread_synced ? 0.5 : 1,
                      }}
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      {syncing === co.id
                        ? 'Syncing...'
                        : co.jobtread_synced
                        ? 'Synced'
                        : 'Sync to JT'}
                    </button>
                    <button
                      onClick={() => deleteChangeOrder(co.id)}
                      style={{ ...styles.actionBtn, ...styles.deleteBtn }}
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                      </svg>
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <style jsx global>{`
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
        @keyframes cardIn {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
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
    maxWidth: '960px',
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
    marginBottom: '20px',
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
  primaryBtn: {
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
  statsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '12px',
  },
  statCard: {
    background: '#12131a',
    borderRadius: '10px',
    padding: '14px 16px',
    border: '1px solid rgba(255,255,255,0.06)',
    textAlign: 'center',
  },
  statValue: {
    fontSize: '1.4em',
    fontWeight: 700,
    color: '#fff',
  },
  statLabel: {
    fontSize: '0.75em',
    marginTop: '2px',
    fontWeight: 500,
  },
  filterRow: {
    display: 'flex',
    gap: '6px',
    marginBottom: '20px',
  },
  filterBtn: {
    padding: '6px 14px',
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '8px',
    color: '#6b7280',
    cursor: 'pointer',
    fontSize: '0.82em',
    fontWeight: 500,
    textTransform: 'capitalize',
  },
  filterActive: {
    background: 'rgba(93,71,250,0.12)',
    borderColor: 'rgba(93,71,250,0.3)',
    color: '#a78bfa',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  card: {
    background: '#12131a',
    borderRadius: '12px',
    padding: '18px 20px',
    border: '1px solid rgba(255,255,255,0.06)',
    animation: 'cardIn 0.3s ease-out',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '16px',
  },
  cardHeaderLeft: {
    flex: 1,
    minWidth: 0,
  },
  cardTitle: {
    fontWeight: 600,
    fontSize: '1.05em',
    color: '#f3f4f6',
    marginBottom: '4px',
  },
  cardEstimate: {
    color: '#a78bfa',
    fontSize: '0.85em',
    marginBottom: '8px',
  },
  cardMeta: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  statusBadge: {
    padding: '3px 10px',
    borderRadius: '6px',
    fontSize: '0.72em',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  reasonTag: {
    color: '#6b7280',
    fontSize: '0.78em',
    background: 'rgba(255,255,255,0.04)',
    padding: '2px 8px',
    borderRadius: '4px',
  },
  syncedBadge: {
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '0.7em',
    background: 'rgba(34,197,94,0.12)',
    color: '#22c55e',
    fontWeight: 600,
  },
  dateText: {
    color: '#4b5563',
    fontSize: '0.78em',
  },
  cardHeaderRight: {
    display: 'flex',
    gap: '20px',
    flexShrink: 0,
  },
  impactGroup: {
    textAlign: 'right',
  },
  impactLabel: {
    fontSize: '0.7em',
    color: '#6b7280',
    marginBottom: '2px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  impactValue: {
    fontWeight: 700,
    fontSize: '1.1em',
    fontVariantNumeric: 'tabular-nums',
  },
  cardActions: {
    display: 'flex',
    gap: '8px',
    marginTop: '14px',
    paddingTop: '12px',
    borderTop: '1px solid rgba(255,255,255,0.04)',
  },
  actionBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    borderRadius: '6px',
    fontSize: '0.78em',
    fontWeight: 500,
    border: 'none',
    cursor: 'pointer',
    transition: 'opacity 0.15s',
  },
  syncBtn: {
    background: 'rgba(93,71,250,0.12)',
    color: '#a78bfa',
    border: '1px solid rgba(93,71,250,0.2)',
  },
  deleteBtn: {
    background: 'rgba(239,68,68,0.08)',
    color: '#ef4444',
    border: '1px solid rgba(239,68,68,0.15)',
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
    background: '#12131a',
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
