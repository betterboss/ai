'use client';

const STAGE_COLORS = {
  'Lead': '#9d8cff',
  'Estimate': '#7a64ff',
  'Proposal': '#5d47fa',
  'Sold': '#34d399',
  'In Progress': '#f59e0b',
  'Complete': '#22c55e',
  'Lost': '#f87171',
};

const DEFAULT_COLORS = ['#5d47fa', '#7a64ff', '#9d8cff', '#34d399', '#f59e0b', '#f87171'];

export default function PipelineBoard({ stages = [], formatValue }) {
  const fmt = formatValue || ((n) => {
    if (n === undefined || n === null) return '--';
    if (n >= 1000000) return '$' + (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return '$' + Math.round(n / 1000) + 'k';
    return '$' + n.toLocaleString();
  });

  if (!stages || stages.length === 0) {
    return (
      <div style={styles.emptyWrap}>
        <p style={styles.emptyText}>No pipeline data available</p>
      </div>
    );
  }

  return (
    <div style={styles.board}>
      {stages.map((stage, stageIdx) => {
        const color = STAGE_COLORS[stage.name] || DEFAULT_COLORS[stageIdx % DEFAULT_COLORS.length];
        const jobs = stage.jobs || [];
        return (
          <div key={stage.name || stageIdx} style={styles.column}>
            <div style={styles.columnHeader}>
              <div style={{ ...styles.stageDot, background: color }} />
              <span style={styles.stageName}>{stage.name}</span>
              <span style={styles.stageCount}>{jobs.length}</span>
            </div>
            <div style={styles.stageValueRow}>
              <span style={styles.stageValue}>{fmt(stage.totalValue || 0)}</span>
            </div>
            <div style={styles.cardList}>
              {jobs.length === 0 && (
                <div style={styles.emptyColumn}>
                  <span style={styles.emptyColumnText}>No jobs</span>
                </div>
              )}
              {jobs.slice(0, 10).map((job, jobIdx) => (
                <div key={job.id || jobIdx} style={styles.jobCard}>
                  <div style={styles.jobName}>{job.name || 'Untitled Job'}</div>
                  {job.customer && (
                    <div style={styles.jobCustomer}>{job.customer}</div>
                  )}
                  <div style={styles.jobFooter}>
                    {job.value !== undefined && (
                      <span style={{ ...styles.jobValue, color }}>{fmt(job.value)}</span>
                    )}
                    {job.date && (
                      <span style={styles.jobDate}>{job.date}</span>
                    )}
                  </div>
                </div>
              ))}
              {jobs.length > 10 && (
                <div style={styles.moreIndicator}>
                  +{jobs.length - 10} more
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const styles = {
  board: {
    display: 'flex',
    gap: '12px',
    overflowX: 'auto',
    paddingBottom: '8px',
    minHeight: '400px',
  },
  column: {
    flex: '0 0 240px',
    background: '#12131a',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '14px',
    padding: '16px 12px',
    display: 'flex',
    flexDirection: 'column',
  },
  columnHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '4px',
  },
  stageDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    flexShrink: 0,
  },
  stageName: {
    color: '#e5e7eb',
    fontSize: '0.85em',
    fontWeight: 700,
    flex: 1,
  },
  stageCount: {
    color: '#6b7280',
    fontSize: '0.75em',
    fontWeight: 600,
    background: 'rgba(255,255,255,0.06)',
    padding: '2px 8px',
    borderRadius: '10px',
  },
  stageValueRow: {
    marginBottom: '12px',
    paddingBottom: '10px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
  stageValue: {
    color: '#9ca3af',
    fontSize: '0.78em',
    fontWeight: 500,
  },
  cardList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    flex: 1,
    overflowY: 'auto',
    maxHeight: '500px',
  },
  jobCard: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '10px',
    padding: '12px',
    transition: 'all 0.15s ease',
  },
  jobName: {
    color: '#e5e7eb',
    fontSize: '0.82em',
    fontWeight: 600,
    marginBottom: '4px',
    lineHeight: 1.3,
  },
  jobCustomer: {
    color: '#6b7280',
    fontSize: '0.75em',
    fontWeight: 400,
    marginBottom: '8px',
  },
  jobFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  jobValue: {
    fontSize: '0.78em',
    fontWeight: 700,
  },
  jobDate: {
    color: '#4b5563',
    fontSize: '0.72em',
    fontWeight: 400,
  },
  emptyColumn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px 8px',
    flex: 1,
  },
  emptyColumnText: {
    color: '#374151',
    fontSize: '0.78em',
    fontStyle: 'italic',
  },
  moreIndicator: {
    textAlign: 'center',
    color: '#6b7280',
    fontSize: '0.75em',
    fontWeight: 500,
    padding: '8px',
    background: 'rgba(255,255,255,0.02)',
    borderRadius: '8px',
  },
  emptyWrap: {
    background: '#12131a',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '14px',
    padding: '48px 20px',
    textAlign: 'center',
  },
  emptyText: {
    color: '#4b5563',
    fontSize: '0.88em',
    margin: 0,
  },
};
