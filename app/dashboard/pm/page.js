'use client';

import { useState, useEffect } from 'react';
import Nav from '../../components/Nav';
import DashboardCard from '../../components/DashboardCard';
import BarChart from '../../components/charts/BarChart';
import LineChart from '../../components/charts/LineChart';
import PieChart from '../../components/charts/PieChart';

export default function PMDashboard() {
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
      const res = await fetch(`/api/dashboard/pm?grantKey=${encodeURIComponent(grantKey)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load PM dashboard');
      setData(json);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={styles.page}>
        <Nav />
        <div style={styles.container}>
          <div style={styles.loadingWrap}>
            <div style={styles.spinner} />
            <p style={styles.loadingText}>Loading PM dashboard...</p>
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
            <p style={styles.emptyText}>No PM data available</p>
          </div>
        </div>
      </div>
    );
  }

  const compliancePct = data.dailyLogCompliance || 0;
  const complianceColor = compliancePct >= 80 ? '#34d399' : compliancePct >= 50 ? '#f59e0b' : '#f87171';

  const taskBreakdown = data.taskBreakdown || [];
  const scheduleByWeek = data.scheduleByWeek || [];
  const overdueItems = data.overdueItems || [];

  return (
    <div style={styles.page}>
      <Nav />
      <div style={styles.container}>
        {/* Header */}
        <div style={styles.headerRow}>
          <div>
            <h1 style={styles.title}>Project Management</h1>
            <p style={styles.subtitle}>Task tracking, compliance, and schedule metrics</p>
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
            value={compliancePct + '%'}
            label="Daily Log Compliance"
            trend={data.complianceTrend}
            trendLabel="vs last week"
            icon="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
            color={complianceColor}
          />
          <DashboardCard
            value={String(data.activeTasks || data.taskCompletion || 0)}
            label="Active Tasks"
            icon="M5 13l4 4L19 7"
            color="#5d47fa"
          />
          <DashboardCard
            value={String(data.overdueCount || 0)}
            label="Overdue Items"
            icon="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            color="#f87171"
          />
          <DashboardCard
            value={String(data.activeProjects || 0)}
            label="Active Projects"
            icon="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
            color="#38bdf8"
          />
        </div>

        {/* Compliance Gauge */}
        <div style={styles.section}>
          <div style={styles.sectionCard}>
            <h3 style={styles.sectionTitle}>Daily Log Compliance</h3>
            <div style={styles.gaugeWrap}>
              <div style={styles.gaugeTrack}>
                <div style={{
                  ...styles.gaugeFill,
                  width: Math.min(compliancePct, 100) + '%',
                  background: compliancePct >= 80
                    ? 'linear-gradient(90deg, #059669, #34d399)'
                    : compliancePct >= 50
                    ? 'linear-gradient(90deg, #d97706, #f59e0b)'
                    : 'linear-gradient(90deg, #dc2626, #f87171)',
                }} />
              </div>
              <div style={styles.gaugeMeta}>
                <span style={{ ...styles.gaugeValue, color: complianceColor }}>
                  {compliancePct}%
                </span>
                <span style={styles.gaugeLabel}>
                  {compliancePct >= 80 ? 'On track' : compliancePct >= 50 ? 'Needs improvement' : 'Critical'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Charts Row */}
        <div style={styles.chartsRow}>
          {taskBreakdown.length > 0 && (
            <div style={styles.chartHalf}>
              <PieChart
                title="Task Breakdown"
                data={taskBreakdown}
                dataKey="value"
                nameKey="name"
                height={280}
                donut={true}
                colors={['#5d47fa', '#34d399', '#f59e0b', '#f87171', '#7a64ff', '#9d8cff']}
              />
            </div>
          )}
          {scheduleByWeek.length > 0 && (
            <div style={styles.chartHalf}>
              <LineChart
                title="Schedule Trend (Tasks/Week)"
                data={scheduleByWeek}
                lines={[
                  { dataKey: 'completed', name: 'Completed', color: '#34d399' },
                  { dataKey: 'scheduled', name: 'Scheduled', color: '#5d47fa', dashed: true },
                ]}
                xKey="week"
                height={280}
                showLegend={true}
              />
            </div>
          )}
        </div>

        {/* Schedule Metrics */}
        {(data.avgDaysAhead !== undefined || data.onTimeRate !== undefined || data.scheduleVariance !== undefined) && (
          <div style={styles.section}>
            <div style={styles.sectionCard}>
              <h3 style={styles.sectionTitle}>Schedule Metrics</h3>
              <div style={styles.metricsGrid}>
                {data.onTimeRate !== undefined && (
                  <div style={styles.metricItem}>
                    <div style={styles.metricValue}>{data.onTimeRate}%</div>
                    <div style={styles.metricLabel}>On-Time Rate</div>
                  </div>
                )}
                {data.avgDaysAhead !== undefined && (
                  <div style={styles.metricItem}>
                    <div style={{
                      ...styles.metricValue,
                      color: data.avgDaysAhead >= 0 ? '#34d399' : '#f87171',
                    }}>
                      {data.avgDaysAhead >= 0 ? '+' : ''}{data.avgDaysAhead}
                    </div>
                    <div style={styles.metricLabel}>Avg Days Ahead/Behind</div>
                  </div>
                )}
                {data.scheduleVariance !== undefined && (
                  <div style={styles.metricItem}>
                    <div style={styles.metricValue}>{data.scheduleVariance}%</div>
                    <div style={styles.metricLabel}>Schedule Variance</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Overdue Items List */}
        {overdueItems.length > 0 && (
          <div style={styles.section}>
            <div style={styles.sectionCard}>
              <h3 style={styles.sectionTitle}>
                <span style={styles.overdueIcon}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </span>
                Overdue Items ({overdueItems.length})
              </h3>
              <div style={styles.overdueList}>
                {overdueItems.slice(0, 10).map((item, i) => (
                  <div key={item.id || i} style={styles.overdueItem}>
                    <div style={styles.overdueInfo}>
                      <span style={styles.overdueName}>{item.name || item.task || 'Untitled'}</span>
                      {item.project && <span style={styles.overdueProject}>{item.project}</span>}
                    </div>
                    <div style={styles.overdueMeta}>
                      {item.daysOverdue !== undefined && (
                        <span style={styles.overdueDays}>
                          {item.daysOverdue}d overdue
                        </span>
                      )}
                      {item.assignee && (
                        <span style={styles.overdueAssignee}>{item.assignee}</span>
                      )}
                    </div>
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
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  overdueIcon: {
    display: 'inline-flex',
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
  gaugeWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  gaugeTrack: {
    height: '12px',
    background: 'rgba(255,255,255,0.06)',
    borderRadius: '6px',
    overflow: 'hidden',
  },
  gaugeFill: {
    height: '100%',
    borderRadius: '6px',
    transition: 'width 0.8s ease-out',
  },
  gaugeMeta: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  gaugeValue: {
    fontSize: '1.5em',
    fontWeight: 800,
    fontVariantNumeric: 'tabular-nums',
  },
  gaugeLabel: {
    color: '#6b7280',
    fontSize: '0.82em',
    fontWeight: 500,
  },
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
    gap: '16px',
  },
  metricItem: {
    padding: '16px',
    background: 'rgba(255,255,255,0.02)',
    borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.04)',
    textAlign: 'center',
  },
  metricValue: {
    fontSize: '1.6em',
    fontWeight: 800,
    color: '#e5e7eb',
    marginBottom: '4px',
    fontVariantNumeric: 'tabular-nums',
  },
  metricLabel: {
    color: '#6b7280',
    fontSize: '0.78em',
    fontWeight: 500,
  },
  overdueList: {
    display: 'flex',
    flexDirection: 'column',
  },
  overdueItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 0',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
    gap: '12px',
  },
  overdueInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    flex: 1,
    minWidth: 0,
  },
  overdueName: {
    color: '#e5e7eb',
    fontSize: '0.85em',
    fontWeight: 600,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  overdueProject: {
    color: '#6b7280',
    fontSize: '0.75em',
  },
  overdueMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexShrink: 0,
  },
  overdueDays: {
    color: '#f87171',
    fontSize: '0.78em',
    fontWeight: 600,
    background: 'rgba(248,113,113,0.1)',
    padding: '3px 8px',
    borderRadius: '6px',
  },
  overdueAssignee: {
    color: '#6b7280',
    fontSize: '0.75em',
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
