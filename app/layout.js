import AuthProvider from './components/AuthProvider';

export const metadata = {
  title: 'Better Boss | AI Tools for Construction Contractors',
  description: 'AI-powered tools for construction contractors: estimating, lead capture, proposals, follow-ups, dashboards, and more. Powered by JobTread.',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#5d47fa" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body>
        <AuthProvider>{children}</AuthProvider>
        <style>{`
          *, *::before, *::after {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }

          html {
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
            text-rendering: optimizeLegibility;
          }

          body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #0a0b0f;
            color: #e5e7eb;
            line-height: 1.5;
            overflow-x: hidden;
          }

          /* Scrollbar */
          ::-webkit-scrollbar { width: 6px; height: 6px; }
          ::-webkit-scrollbar-track { background: transparent; }
          ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }
          ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }

          /* Selection */
          ::selection { background: rgba(93,71,250,0.3); color: #fff; }

          /* Focus styles */
          input:focus, textarea:focus, select:focus {
            border-color: rgba(93,71,250,0.5) !important;
            box-shadow: 0 0 0 3px rgba(93,71,250,0.1);
            outline: none;
          }

          /* Button hover effects */
          button:not(:disabled):hover {
            filter: brightness(1.1);
          }
          button:not(:disabled):active {
            transform: scale(0.98);
          }
          button:disabled {
            opacity: 0.6;
            cursor: not-allowed !important;
          }
          button {
            font-family: inherit;
            transition: all 0.15s ease;
          }

          /* Link hover */
          a {
            transition: all 0.15s ease;
          }
          a:hover {
            filter: brightness(1.15);
          }

          /* Card hover */
          [data-card]:hover {
            border-color: rgba(255,255,255,0.12) !important;
            background: rgba(255,255,255,0.04) !important;
          }

          /* Table row hover */
          tbody tr:hover {
            background: rgba(255,255,255,0.02);
          }

          /* Input placeholder */
          ::placeholder {
            color: rgba(255,255,255,0.2);
          }

          /* Select styling */
          select {
            font-family: inherit;
            cursor: pointer;
          }
          select option {
            background: #1a1d2e;
            color: #e5e7eb;
          }

          /* Smooth scroll */
          html {
            scroll-behavior: smooth;
          }

          /* Print styles */
          @media print {
            body { background: white !important; color: black !important; }
            nav, .no-print { display: none !important; }
          }

          /* Animations */
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(8px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
          @keyframes slideDown {
            from { opacity: 0; transform: translateY(-10px); }
            to { opacity: 1; transform: translateY(0); }
          }

          /* Number inputs - hide spinners */
          input[type="number"]::-webkit-inner-spin-button,
          input[type="number"]::-webkit-outer-spin-button {
            -webkit-appearance: none;
            margin: 0;
          }
          input[type="number"] {
            -moz-appearance: textfield;
          }

          /* Responsive */
          @media (max-width: 768px) {
            body { font-size: 14px; }
          }
          @keyframes pulse {
            0%, 100% { opacity: 0.4; }
            50% { opacity: 1; }
          }
        `}</style>
        <script dangerouslySetInnerHTML={{ __html: `
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', function() {
              navigator.serviceWorker.register('/sw.js').catch(function() {});
            });
          }
        `}} />
      </body>
    </html>
  );
}
