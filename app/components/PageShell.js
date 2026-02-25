'use client';

import Sidebar from './Sidebar';

export default function PageShell({ children }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0a0b0f' }}>
      <Sidebar />
      <main style={{ flex: 1, marginLeft: '220px', minHeight: '100vh' }}>
        {children}
      </main>
    </div>
  );
}
