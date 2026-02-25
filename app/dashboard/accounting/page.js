'use client';

import { useState, useEffect } from 'react';
import Nav from '../../components/Nav';
import DashboardCard from '../../components/DashboardCard';
import BarChart from '../../components/charts/BarChart';
import PieChart from '../../components/charts/PieChart';

const AGING_COLORS = ['#34d399', '#f59e0b', '#f97316', '#f87171'];

export default function AccountingDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const grantKey = localStorage.getItem('bb_grant_key') || localStorage.getItem('bb_grantKey') || localStorage.getItem('jobtread_grant_key');
    if (!grantKey) {
      setError('No JobTread grant key found. Go to Setup to connect your account.');
      setLoading(false);
      return;
    }
    loadData(grantKey);
  }, []);

  const loadData = async (grantKey) => {
    try {
      const res = await fetch(`/api/dashboard/accounting?grantKey=${encodeURIComponent(grantKey)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load accounting dashboard');
      setData(json);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fmt = (n) => {
    if (n === undefined || n === null) return '--';
    if (n >= 1000000) return '$' + (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return '$' + Math.round(n / 1000) + 'k';
    return '$' + n.toLocaleString();
  };

  const fmtFull = (n) => {
    if (n === undefined || n === null) return '--';
    return '$' + Number(n).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  };

  if (loading) {
    return (
      <div style={styles.page}>
        <Nav />
        <div style={styles.container}>
          <div style={styles.loadingWrap}>
            <div style={styles.spinner} />
            <p style={styles.loadingText}>Loading accounting dashboard...</p>
          </div>
        </div>
        <style jsx global>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.page}>
        <Nav />
        <div style={styles.container}>
          <div style={styles.errorWrap}>
            <div style={styles.errorIcon}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <p style={styles.errorText}>{error}</p>
            <a href="/setup" style={styles.setupLink}>Go to Setup</a>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={styles.page}>
        <Nav />
        <div style={styles.container}>
          <div style={styles.emptyWrap}>
            <p style={styles.emptyText}>No accounting data available</p>
          </div>
        </div>
      </div>
    );
  }

  const arAging = data.arAging || [];
  const agingChartData = arAging.map((bucket, i) => ({
    name: bucket.label || bucket.name,
    amount: bucket.amount || 0,
    count: bucket.count || 0,
  }));
  const agingPieData = arAging.map((bucket) => ({
    name: bucket.label || bucket.name,
    value: bucket.amount || 0,
  }));

  const collectionRate = data.paymentVelocity?.collectionRate || data.collectionRate || 0;
  const avgDaysToPay = data.paymentVelocity?.avgDaysToPay || data.avgDaysToPay;
  const invoices = data.invoices || {};

  return (
    <div style={styles.page}>
      <Nav />
      <div style={styles.container}>
        {/* Header */}
        <div style={styles.headerRow}>
          <div>
            <h1 style={styles.title}>Accounting</h1>
            <p style={styles.subtitle}>Accounts receivable, invoicing, and collection analytics</p>
          </div>
          <a href="/dashboard" style={styles.backLink}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            All Dashboards
          </a>
        </div>

        {/* KPI Cards */}
        <div style={styles.cardGrid}>
          <DashboardCard
            value={fmt(data.totalOutstanding || data.totalAR)}
            label="Total AR"
            trend={data.arTrend}
            trendLabel="vs last period"
            icon="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            color="#f87171"
          />
          <DashboardCard
            value={String(data.unpaidCount || data.invoicesPending || 0)}
            label="Unpaid Invoices"
            icon="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z"
            color="#f59e0b"
          />
          <DashboardCard
            value={collectionRate + '%'}
            label="Collection Rate"
            trend={data.collectionTrend}
            trendLabel="vs last period"
            icon="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
            color="#34d399"
          />
          {avgDaysToPay !== undefined && (
            <DashboardCard
              value={avgDaysToPay + ' days'}
              label="Avg Days to Pay"
              icon="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              color="#5d47fa"
            />
          )}
        </div>

        {/* AR Aging Charts */}
        <div style={styles.chartsRow}>
          <div style={styles.chartHalf}>
            <BarChart
              title="AR Aging Breakdown"
              data={agingChartData}
              dataKey="amount"
              xKey="name"
              height={300}
              colors={AGING_COLORS}
              formatValue={(val) => fmt(val)}
            />
          </div>
          {agingPieData.length > 0 && (
            <div style={styles.chartHalf}>
              <PieChart
                title="AR Distribution"
                data={agingPieData}
                dataKey="value"
                nameKey="name"
                height={300}
                donut={true}
                colors={AGING_COLORS}
                formatValue={(val) => fmt(val)}
              />
            </div>
          )}
        </div>

        {/* Aging Detail Cards */}
        {arAging.length > 0 && (
          <div style={styles.section}>
            <div style={styles.sectionCard}>
              <h3 style={styles.sectionTitle}>Aging Detail</h3>
              <div style={styles.agingGrid}>
                {arAging.map((bucket, i) => {
                  const label = bucket.label || bucket.name;
                  const color = AGING_COLORS[i] || '#6b7280';
                  const totalAR = data.totalOutstanding || data.totalAR || 1;
                  const pct = totalAR > 0 ? ((bucket.amount || 0) / totalAR * 100).toFixed(1) : 0;
                  return (
                    <div key={label} style={styles.agingItem}>
                      <div style={styles.agingHeader}>
                        <div style={{ ...styles.agingDot, background: color }} />
                        <span style={styles.agingLabel}>{label}</span>
                      </div>
                      <div style={{ ...styles.agingAmount, color }}>{fmtFull(bucket.amount || 0)}</div>
                      <div style={styles.agingMeta}>
                        <span style={styles.agingCount}>{bucket.count || 0} invoices</span>
                        <span style={styles.agingPct}>{pct}%</span>
                      </div>
                      <div style={styles.agingBar}>
                        <div style={{
                          ...styles.agingBarFill,
                          width: Math.min(Number(pct), 100) + '%',
                          background: color,
                        }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Invoice Summary */}
        {(invoices.total !== undefined || invoices.paid !== undefined || invoices.unpaid !== undefined) && (
          <div style={styles.section}>
            <div style={styles.sectionCard}>
              <h3 style={styles.sectionTitle}>Invoice Summary</h3>
              <div style={styles.invoiceSummaryGrid}>
                {invoices.total !== undefined && (
                  <div style={styles.invoiceItem}>
                    <div style={styles.invoiceItemLabel}>Total Invoiced</div>
                    <div style={styles.invoiceItemValue}>{fmtFull(invoices.total)}</div>
                  </div>
                )}
                {invoices.paid !== undefined && (
                  <div style={styles.invoiceItem}>
                    <div style={styles.invoiceItemLabel}>Paid</div>
                    <div style={{ ...styles.invoiceItemValue, color: '#34d399' }}>{fmtFull(invoices.paid)}</div>
                  </div>
                )}
                {invoices.unpaid !== undefined && (
                  <div style={styles.invoiceItem}>
                    <div style={styles.invoiceItemLabel}>Outstanding</div>
                    <div style={{ ...styles.invoiceItemValue, color: '#f87171' }}>{fmtFull(invoices.unpaid)}</div>
                  </div>
                )}
                {invoices.overdue !== undefined && (
                  <div style={styles.invoiceItem}>
                    <div style={styles.invoiceItemLabel}>Overdue</div>
                    <div style={{ ...styles.invoiceItemValue, color: '#f59e0b' }}>{fmtFull(invoices.overdue)}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Recent Invoices Table */}
        {data.recentInvoices && data.recentInvoices.length > 0 && (
          <div style={styles.section}>
            <div style={styles.sectionCard}>
              <h3 style={styles.sectionTitle}>Recent Invoices</h3>
              <div style={styles.tableWrap}>
                <div style={styles.tableHeader}>
                  <span style={{ ...styles.tableCell, flex: 2 }}>Customer / Job</span>
                  <span style={styles.tableCell}>Amount</span>
                  <span style={styles.tableCell}>Date</span>
                  <span style={styles.tableCell}>Status</span>
                </div>
                {data.recentInvoices.slice(0, 10).map((inv, i) => (
                  <div key={inv.id || i} style={styles.tableRow}>
                    <div style={{ ...styles.tableCell, flex: 2 }}>
                      <div style={styles.invoiceName}>{inv.customer || inv.jobName || 'Untitled'}</div>
                      {inv.jobName && inv.customer && (
                        <div style={styles.invoiceJob}>{inv.jobName}</div>
                      )}
                    </div>
                    <span style={{ ...styles.tableCell, fontWeight: 600, color: '#e5e7eb' }}>
                      {fmtFull(inv.amount)}
                    </span>
                    <span style={styles.tableCell}>{inv.date || '--'}</span>
                    <span style={styles.tableCell}>
                      <span style={{
                        ...styles.statusBadge,
                        color: inv.status === 'Paid' ? '#34d399'
                          : inv.status === 'Overdue' ? '#f87171'
                          : '#f59e0b',
                        background: inv.status === 'Paid' ? 'rgba(52,211,153,0.1)'
                          : inv.status === 'Overdue' ? 'rgba(248,113,113,0.1)'
                          : 'rgba(245,158,11,0.1)',
                      }}>
                        {inv.status || 'Pending'}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <style jsx global>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
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
  },
  container: {
    maxWidth: '1100px',
    margin: '0 auto',
    padding: '0 24px 60px',
    animation: 'fadeIn 0.3s ease-out',
  },
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: '32px 0 24px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    marginBottom: '24px',
    flexWrap: 'wrap',
    gap: '16px',
  },
  title: {
    fontSize: '2em',
    fontWeight: 800,
    color: '#fff',
    margin: 0,
    letterSpacing: '-0.03em',
  },
  subtitle: {
    color: '#6b7280',
    margin: '4px 0 0',
    fontSize: '0.9em',
  },
  backLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 16px',
    background: '#12131a',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '8px',
    color: '#9ca3af',
    textDecoration: 'none',
    fontSize: '0.82em',
    fontWeight: 500,
  },
  cardGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: '12px',
    marginBottom: '8px',
  },
  chartsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: '16px',
    marginTop: '20px',
  },
  chartHalf: {
    minWidth: 0,
  },
  section: {
    marginTop: '20px',
  },
  sectionCard: {
    background: '#12131a',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '14px',
    padding: '22px 20px',
  },
  sectionTitle: {
    color: '#e5e7eb',
    fontSize: '0.95em',
    fontWeight: 700,
    margin: '0 0 16px 0',
    letterSpacing: '-0.01em',
  },
  agingGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '14px',
  },
  agingItem: {
    padding: '16px',
    background: 'rgba(255,255,255,0.02)',
    borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.04)',
  },
  agingHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '8px',
  },
  agingDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    flexShrink: 0,
  },
  agingLabel: {
    color: '#9ca3af',
    fontSize: '0.78em',
    fontWeight: 600,
  },
  agingAmount: {
    fontSize: '1.3em',
    fontWeight: 800,
    marginBottom: '6px',
    fontVariantNumeric: 'tabular-nums',
  },
  agingMeta: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
  agingCount: {
    color: '#6b7280',
    fontSize: '0.72em',
    fontWeight: 500,
  },
  agingPct: {
    color: '#6b7280',
    fontSize: '0.72em',
    fontWeight: 600,
  },
  agingBar: {
    height: '4px',
    background: 'rgba(255,255,255,0.06)',
    borderRadius: '2px',
    overflow: 'hidden',
  },
  agingBarFill: {
    height: '100%',
    borderRadius: '2px',
    transition: 'width 0.6s ease-out',
  },
  invoiceSummaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '14px',
  },
  invoiceItem: {
    padding: '16px',
    background: 'rgba(255,255,255,0.02)',
    borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.04)',
  },
  invoiceItemLabel: {
    color: '#6b7280',
    fontSize: '0.78em',
    fontWeight: 500,
    marginBottom: '6px',
  },
  invoiceItemValue: {
    color: '#e5e7eb',
    fontSize: '1.3em',
    fontWeight: 800,
    fontVariantNumeric: 'tabular-nums',
  },
  tableWrap: {
    display: 'flex',
    flexDirection: 'column',
  },
  tableHeader: {
    display: 'flex',
    padding: '8px 12px',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    marginBottom: '4px',
    alignItems: 'center',
  },
  tableRow: {
    display: 'flex',
    padding: '10px 12px',
    borderBottom: '1px solid rgba(255,255,255,0.03)',
    alignItems: 'center',
  },
  tableCell: {
    flex: 1,
    color: '#9ca3af',
    fontSize: '0.82em',
    fontWeight: 500,
  },
  invoiceName: {
    color: '#e5e7eb',
    fontSize: '0.85em',
    fontWeight: 600,
  },
  invoiceJob: {
    color: '#6b7280',
    fontSize: '0.72em',
    marginTop: '2px',
  },
  statusBadge: {
    fontSize: '0.72em',
    fontWeight: 600,
    padding: '3px 8px',
    borderRadius: '6px',
    display: 'inline-block',
  },
  loadingWrap: {
    textAlign: 'center',
    padding: '100px 20px',
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
  errorWrap: {
    textAlign: 'center',
    padding: '100px 20px',
  },
  errorIcon: {
    width: '48px',
    height: '48px',
    borderRadius: '12px',
    background: 'rgba(239,68,68,0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 16px',
  },
  errorText: {
    color: '#ef4444',
    fontSize: '0.9em',
    marginBottom: '16px',
  },
  setupLink: {
    display: 'inline-flex',
    padding: '8px 20px',
    background: 'rgba(93,71,250,0.15)',
    border: '1px solid rgba(93,71,250,0.3)',
    borderRadius: '8px',
    color: '#a78bfa',
    textDecoration: 'none',
    fontSize: '0.85em',
    fontWeight: 500,
  },
  emptyWrap: {
    textAlign: 'center',
    padding: '100px 20px',
  },
  emptyText: {
    color: '#4b5563',
    fontSize: '0.9em',
  },
};
