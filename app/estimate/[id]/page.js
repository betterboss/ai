'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Nav from '../../components/Nav';
import EstimateTable from '../../components/EstimateTable';
import TakeoffUploader from '../../components/TakeoffUploader';
import CatalogPicker from '../../components/CatalogPicker';

const STATUS_COLORS = {
  draft: { bg: 'rgba(255,193,7,0.15)', color: '#ffc107' },
  sent: { bg: 'rgba(93,71,250,0.15)', color: '#7a64ff' },
  approved: { bg: 'rgba(0,200,83,0.15)', color: '#00c853' },
  rejected: { bg: 'rgba(255,82,82,0.15)', color: '#ff5252' },
};

export default function EstimateEditor() {
  const params = useParams();
  const estimateId = params.id;

  const [estimate, setEstimate] = useState(null);
  const [items, setItems] = useState([]);
  const [takeoffs, setTakeoffs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [showCatalog, setShowCatalog] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [error, setError] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [grantKey, setGrantKey] = useState('');

  useEffect(() => {
    setApiKey(localStorage.getItem('mrBetterBoss_apiKey') || '');
    setGrantKey(localStorage.getItem('bb_jobtread_grant_key') || '');
    loadEstimate();
  }, [estimateId]);

  const loadEstimate = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/estimate/${estimateId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setEstimate(data.estimate);
      setItems(data.items || []);
      setTakeoffs(data.takeoffs || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const saveEstimate = async (updates) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/estimate/${estimateId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setEstimate(data.estimate);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const updateItem = async (itemId, updates) => {
    try {
      const res = await fetch(`/api/estimate/${estimateId}/items`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: itemId, ...updates }),
      });
      if (!res.ok) throw new Error('Failed to update item');
      loadEstimate(); // Reload to get recalculated totals
    } catch (err) {
      setError(err.message);
    }
  };

  const deleteItem = async (itemId) => {
    try {
      const res = await fetch(`/api/estimate/${estimateId}/items?item_id=${itemId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete item');
      loadEstimate();
    } catch (err) {
      setError(err.message);
    }
  };

  const addBlankItem = async () => {
    try {
      const res = await fetch(`/api/estimate/${estimateId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: 'New item',
          quantity: 1,
          unit: 'each',
          unit_cost: 0,
          markup_pct: 25,
          category: 'General',
        }),
      });
      if (!res.ok) throw new Error('Failed to add item');
      loadEstimate();
    } catch (err) {
      setError(err.message);
    }
  };

  const addFromCatalog = async (catalogItem) => {
    try {
      const res = await fetch(`/api/estimate/${estimateId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: catalogItem.name,
          quantity: 1,
          unit: catalogItem.unit,
          unit_cost: catalogItem.unit_cost,
          markup_pct: catalogItem.markup_pct,
          category: catalogItem.category,
          catalog_item_id: catalogItem.id,
          source: 'catalog',
        }),
      });
      if (!res.ok) throw new Error('Failed to add catalog item');
      loadEstimate();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleTakeoffComplete = useCallback(async (data) => {
    if (!data.items?.length) return;

    // Convert takeoff items to estimate line items
    const lineItems = data.items.map(item => ({
      category: item.category || 'General',
      description: item.description,
      quantity: item.quantity || 0,
      unit: item.unit || 'each',
      unit_cost: 0, // User needs to fill in costs
      markup_pct: 25,
      source: 'takeoff',
    }));

    try {
      const res = await fetch(`/api/estimate/${estimateId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: lineItems }),
      });
      if (!res.ok) throw new Error('Failed to add takeoff items');
      loadEstimate();
    } catch (err) {
      setError(err.message);
    }
  }, [estimateId]);

  const syncToJobTread = async () => {
    if (!grantKey) {
      setError('JobTread grant key is required. Save it in your browser settings.');
      return;
    }

    setSyncing(true);
    setError('');
    setSyncResult(null);

    try {
      const res = await fetch(`/api/estimate/${estimateId}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grantKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSyncResult(data);
      loadEstimate();
    } catch (err) {
      setError(err.message);
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div style={styles.page}>
        <Nav />
        <div style={styles.container}>
          <p style={{ color: '#8899a6', textAlign: 'center', padding: '60px' }}>Loading estimate...</p>
        </div>
      </div>
    );
  }

  if (!estimate) {
    return (
      <div style={styles.page}>
        <Nav />
        <div style={styles.container}>
          <p style={{ color: '#ff5252', textAlign: 'center', padding: '60px' }}>Estimate not found</p>
        </div>
      </div>
    );
  }

  const statusStyle = STATUS_COLORS[estimate.status] || STATUS_COLORS.draft;

  return (
    <div style={styles.page}>
      <Nav />
      <div style={styles.container}>
        {/* Header */}
        <div style={styles.header}>
          <div>
            <a href="/estimate" style={styles.backLink}>Estimates</a>
            <h1 style={styles.title}>{estimate.name}</h1>
            {estimate.client_name && (
              <p style={styles.clientName}>{estimate.client_name}</p>
            )}
          </div>
          <div style={styles.headerRight}>
            <span style={{ ...styles.badge, background: statusStyle.bg, color: statusStyle.color }}>
              {estimate.status}
            </span>
            <div style={styles.headerStats}>
              <span style={styles.priceDisplay}>
                ${parseFloat(estimate.total_price || 0).toLocaleString('en-US', { minimumFractionDigits: 0 })}
              </span>
              <span style={styles.marginDisplay}>
                {parseFloat(estimate.margin_pct || 0).toFixed(1)}% margin
              </span>
            </div>
          </div>
        </div>

        <div style={styles.layout}>
          {/* Sidebar */}
          <div style={styles.sidebar}>
            {/* Takeoff Upload */}
            <div style={styles.sideCard}>
              <h3 style={styles.sideTitle}>Takeoff</h3>
              <TakeoffUploader
                estimateId={estimateId}
                apiKey={apiKey}
                onTakeoffComplete={handleTakeoffComplete}
              />
            </div>

            {/* Job Info */}
            <div style={styles.sideCard}>
              <h3 style={styles.sideTitle}>Job Info</h3>
              <div style={styles.infoField}>
                <label style={styles.infoLabel}>Client</label>
                <input
                  style={styles.infoInput}
                  value={estimate.client_name || ''}
                  onChange={e => saveEstimate({ client_name: e.target.value })}
                  placeholder="Client name"
                />
              </div>
              <div style={styles.infoField}>
                <label style={styles.infoLabel}>Email</label>
                <input
                  style={styles.infoInput}
                  value={estimate.client_email || ''}
                  onChange={e => saveEstimate({ client_email: e.target.value })}
                  placeholder="Email"
                />
              </div>
              <div style={styles.infoField}>
                <label style={styles.infoLabel}>Phone</label>
                <input
                  style={styles.infoInput}
                  value={estimate.client_phone || ''}
                  onChange={e => saveEstimate({ client_phone: e.target.value })}
                  placeholder="Phone"
                />
              </div>
              <div style={styles.infoField}>
                <label style={styles.infoLabel}>Address</label>
                <input
                  style={styles.infoInput}
                  value={estimate.job_address || ''}
                  onChange={e => saveEstimate({ job_address: e.target.value })}
                  placeholder="Job address"
                />
              </div>
            </div>

            {/* Actions */}
            <div style={styles.sideCard}>
              <h3 style={styles.sideTitle}>Actions</h3>
              <button onClick={syncToJobTread} disabled={syncing} style={styles.actionBtn}>
                {syncing ? 'Syncing...' : 'Sync to JobTread'}
              </button>
              <a href={`/estimate/${estimateId}/quote`} style={styles.actionBtnSecondary}>
                Generate Quote
              </a>

              {/* Settings */}
              <div style={{ marginTop: '12px' }}>
                <div style={styles.infoField}>
                  <label style={styles.infoLabel}>API Key</label>
                  <input
                    style={styles.infoInput}
                    type="password"
                    value={apiKey}
                    onChange={e => {
                      setApiKey(e.target.value);
                      localStorage.setItem('mrBetterBoss_apiKey', e.target.value);
                    }}
                    placeholder="sk-ant-..."
                  />
                </div>
                <div style={styles.infoField}>
                  <label style={styles.infoLabel}>JT Grant Key</label>
                  <input
                    style={styles.infoInput}
                    type="password"
                    value={grantKey}
                    onChange={e => {
                      setGrantKey(e.target.value);
                      localStorage.setItem('bb_jobtread_grant_key', e.target.value);
                    }}
                    placeholder="Grant key"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Main Content - Line Items */}
          <div style={styles.main}>
            {error && (
              <div style={styles.error}>{error}
                <button onClick={() => setError('')} style={styles.errorClose}>X</button>
              </div>
            )}

            {syncResult && (
              <div style={styles.success}>
                Synced to JobTread! Estimate #{syncResult.jobtread_estimate_number}
                <button onClick={() => setSyncResult(null)} style={styles.errorClose}>X</button>
              </div>
            )}

            <div style={styles.tableHeader}>
              <h2 style={styles.tableTitle}>Line Items ({items.length})</h2>
              <div style={styles.tableActions}>
                <button onClick={() => setShowCatalog(true)} style={styles.tableBtnSecondary}>
                  Catalog
                </button>
                <button onClick={addBlankItem} style={styles.tableBtn}>
                  + Add Item
                </button>
              </div>
            </div>

            <EstimateTable
              items={items}
              onUpdateItem={updateItem}
              onDeleteItem={deleteItem}
              onAddItem={addBlankItem}
              defaultMarkup={25}
            />
          </div>
        </div>
      </div>

      {showCatalog && (
        <CatalogPicker
          onSelect={addFromCatalog}
          onClose={() => setShowCatalog(false)}
        />
      )}
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    background: '#0f1419',
    color: '#f0f4f8',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
  },
  container: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '24px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '24px',
  },
  backLink: {
    color: '#7a64ff',
    textDecoration: 'none',
    fontSize: '0.85em',
  },
  title: {
    fontSize: '1.6em',
    fontWeight: 700,
    margin: '8px 0 0',
  },
  clientName: {
    color: '#8899a6',
    margin: '4px 0 0',
  },
  headerRight: {
    textAlign: 'right',
  },
  badge: {
    padding: '3px 10px',
    borderRadius: '12px',
    fontSize: '0.75em',
    fontWeight: 600,
    textTransform: 'uppercase',
  },
  headerStats: {
    marginTop: '8px',
  },
  priceDisplay: {
    fontSize: '1.4em',
    fontWeight: 700,
    color: '#00c853',
    display: 'block',
  },
  marginDisplay: {
    fontSize: '0.85em',
    color: '#8899a6',
  },
  layout: {
    display: 'grid',
    gridTemplateColumns: '280px 1fr',
    gap: '20px',
  },
  sidebar: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  sideCard: {
    background: '#1a2332',
    borderRadius: '12px',
    padding: '16px',
    border: '1px solid rgba(255,255,255,0.06)',
  },
  sideTitle: {
    fontSize: '0.9em',
    fontWeight: 600,
    color: '#8899a6',
    margin: '0 0 12px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  infoField: {
    marginBottom: '10px',
  },
  infoLabel: {
    display: 'block',
    fontSize: '0.75em',
    color: '#8899a6',
    marginBottom: '4px',
  },
  infoInput: {
    width: '100%',
    padding: '6px 10px',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '6px',
    color: '#f0f4f8',
    fontSize: '0.85em',
  },
  actionBtn: {
    width: '100%',
    padding: '10px',
    background: 'linear-gradient(135deg, #5d47fa, #7a64ff)',
    borderRadius: '8px',
    color: '#fff',
    fontWeight: 600,
    border: 'none',
    cursor: 'pointer',
    fontSize: '0.9em',
    marginBottom: '8px',
  },
  actionBtnSecondary: {
    display: 'block',
    width: '100%',
    padding: '10px',
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: '8px',
    color: '#f0f4f8',
    textAlign: 'center',
    textDecoration: 'none',
    fontSize: '0.9em',
  },
  main: {
    minWidth: 0,
  },
  error: {
    padding: '10px 14px',
    background: 'rgba(255,82,82,0.1)',
    border: '1px solid rgba(255,82,82,0.3)',
    borderRadius: '8px',
    color: '#ff5252',
    fontSize: '0.9em',
    marginBottom: '12px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  success: {
    padding: '10px 14px',
    background: 'rgba(0,200,83,0.1)',
    border: '1px solid rgba(0,200,83,0.3)',
    borderRadius: '8px',
    color: '#00c853',
    fontSize: '0.9em',
    marginBottom: '12px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  errorClose: {
    background: 'transparent',
    border: 'none',
    color: 'inherit',
    cursor: 'pointer',
    fontSize: '0.9em',
  },
  tableHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
  },
  tableTitle: {
    fontSize: '1.1em',
    fontWeight: 600,
    margin: 0,
  },
  tableActions: {
    display: 'flex',
    gap: '8px',
  },
  tableBtn: {
    padding: '6px 14px',
    background: 'rgba(93,71,250,0.15)',
    border: '1px solid rgba(93,71,250,0.3)',
    borderRadius: '8px',
    color: '#7a64ff',
    cursor: 'pointer',
    fontSize: '0.85em',
    fontWeight: 500,
  },
  tableBtnSecondary: {
    padding: '6px 14px',
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    color: '#8899a6',
    cursor: 'pointer',
    fontSize: '0.85em',
  },
};
