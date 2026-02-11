'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

const CAL_BOOKING_URL = 'https://cal.com/mybetterboss.ai/jobtread-free-growth-audit-call';

// Default settings with all Better Boss knowledge
const DEFAULT_SETTINGS = {
  botName: 'Mr. Better Boss',
  tagline: 'Your AI JobTread Implementation Guide',
  welcomeMessage: "Hey there! I'm Mr. Better Boss, your AI guide for all things JobTread. I can help with estimates, workflows, automations, integrations, and more. I can even search the web for the latest info.\n\nNeed hands-on help? Book a **FREE Growth Audit Call** and let's map out your 30-day game plan.",
  quickActions: [
    { emoji: '📞', label: 'Book Free Audit', prompt: "I'd like to book a free Growth Audit call to see how Better Boss can help my business." },
    { emoji: '📋', label: 'Estimate templates', prompt: 'How do I build an effective estimate template in JobTread?' },
    { emoji: '⚙️', label: 'Automate workflows', prompt: 'What are the best automations to set up with n8n and JobTread?' },
    { emoji: '📦', label: 'Setup catalog', prompt: 'How do I set up my catalog and pricing in JobTread?' },
    { emoji: '🔗', label: 'Integrations', prompt: 'What integrations work with JobTread and how do I set them up?' },
    { emoji: '🚀', label: 'Faster estimates', prompt: 'How can I speed up my estimates to close more deals?' },
    { emoji: '💰', label: 'Improve close rate', prompt: 'How can Better Boss help me improve my close rate?' },
    { emoji: '🏗️', label: 'Get started', prompt: 'How do I get started with Better Boss and JobTread implementation?' }
  ]
};

export default function Home() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [showApiModal, setShowApiModal] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [apiKeyVisible, setApiKeyVisible] = useState(false);
  const [error, setError] = useState('');
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [activeTab, setActiveTab] = useState('personality');
  const chatRef = useRef(null);
  const calLoadedRef = useRef(false);

  // Load Cal.com embed script
  useEffect(() => {
    if (calLoadedRef.current) return;
    calLoadedRef.current = true;

    (function (C, A, L) {
      let p = function (a, ar) { a.q.push(ar); };
      let d = C.document;
      C.Cal = C.Cal || function () {
        let cal = C.Cal;
        let ar = arguments;
        if (!cal.loaded) {
          cal.ns = {};
          cal.q = cal.q || [];
          let script = d.head.appendChild(d.createElement("script"));
          script.src = A;
          cal.loaded = true;
        }
        if (ar[0] === L) {
          const api = function () { p(api, arguments); };
          const namespace = ar[1];
          api.q = api.q || [];
          if (typeof namespace === "string") {
            cal.ns[namespace] = api;
            p(api, ar);
          } else {
            p(cal, ar);
          }
          return;
        }
        p(cal, ar);
      };
    })(window, "https://app.cal.com/embed/embed.js", "init");

    window.Cal("init", { origin: "https://cal.com" });
    window.Cal("ui", {
      styles: { branding: { brandColor: "#5d47fa" } },
      hideEventTypeDetails: false,
      layout: "month_view"
    });
  }, []);

  // Open Cal.com booking modal
  const openBooking = useCallback(() => {
    if (window.Cal) {
      window.Cal("modal", {
        calLink: "mybetterboss.ai/jobtread-free-growth-audit-call",
        config: { layout: "month_view" }
      });
    } else {
      // Fallback: open in new tab
      window.open(CAL_BOOKING_URL, '_blank');
    }
  }, []);

  // Load saved data on mount
  useEffect(() => {
    const savedKey = localStorage.getItem('mrBetterBoss_apiKey');
    const savedSettings = localStorage.getItem('mrBetterBoss_settings');

    if (savedKey) {
      setApiKey(savedKey);
      setShowApiModal(false);
    }

    if (savedSettings) {
      try {
        setSettings(JSON.parse(savedSettings));
      } catch (e) {
        console.error('Failed to parse saved settings');
      }
    }
  }, []);

  // Auto-scroll chat
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages]);

  // Save settings
  const saveSettings = () => {
    localStorage.setItem('mrBetterBoss_settings', JSON.stringify(settings));
    setShowSettings(false);
  };

  // Connect with API key
  const connectApiKey = async () => {
    if (!apiKey.trim()) {
      setError('Please enter an API key');
      return;
    }

    if (!apiKey.startsWith('sk-ant-')) {
      setError('Invalid API key format. Should start with sk-ant-');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey,
          messages: [{ role: 'user', content: 'Hi' }]
        })
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('mrBetterBoss_apiKey', apiKey);
        setShowApiModal(false);
        setError('');
      } else {
        setError(data.error || 'Failed to connect');
      }
    } catch (err) {
      setError('Connection failed. Please try again.');
    }

    setIsLoading(false);
  };

  // Send message
  const sendMessage = async (text) => {
    if (!text.trim() || isLoading || !apiKey) return;

    const userMessage = { role: 'user', content: text };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey,
          messages: newMessages
        })
      });

      const data = await response.json();

      if (response.ok && data.content) {
        setMessages([...newMessages, { role: 'assistant', content: data.content, sources: data.sources || [] }]);
      } else {
        setMessages([...newMessages, {
          role: 'assistant',
          content: `Warning: ${data.error || 'Something went wrong. Please try again.'}`
        }]);
      }
    } catch (err) {
      setMessages([...newMessages, {
        role: 'assistant',
        content: 'Warning: Connection error. Please check your internet and try again.'
      }]);
    }

    setIsLoading(false);
  };

  // Update quick action
  const updateQuickAction = (index, field, value) => {
    setSettings(s => ({
      ...s,
      quickActions: s.quickActions.map((qa, i) =>
        i === index ? { ...qa, [field]: value } : qa
      )
    }));
  };

  // Add quick action
  const addQuickAction = () => {
    if (settings.quickActions.length < 8) {
      setSettings(s => ({
        ...s,
        quickActions: [...s.quickActions, { emoji: '💡', label: 'New', prompt: 'New prompt' }]
      }));
    }
  };

  // Remove quick action
  const removeQuickAction = (index) => {
    setSettings(s => ({
      ...s,
      quickActions: s.quickActions.filter((_, i) => i !== index)
    }));
  };

  // Markdown renderer helpers
  const escapeHtml = (str) => str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

  const inlineFmt = (str) => str
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer" class="md-link">$1</a>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code class="md-inline-code">$1</code>');

  // Full markdown-to-HTML formatter
  const formatContent = (text) => {
    const clean = text.replace(/\[BOOK_CALL\]/g, '');

    // Extract code blocks into placeholders
    const codeBlocks = [];
    let processed = clean.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
      const idx = codeBlocks.length;
      codeBlocks.push({ lang, code: code.trim() });
      return `\n%%CB_${idx}%%\n`;
    });

    const lines = processed.split('\n');
    let html = '';
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      // Code block placeholder
      const cbMatch = line.match(/^%%CB_(\d+)%%$/);
      if (cbMatch) {
        const cb = codeBlocks[parseInt(cbMatch[1])];
        html += `<pre class="md-code-block"><code>${escapeHtml(cb.code)}</code></pre>`;
        i++; continue;
      }

      // Headings
      const hMatch = line.match(/^(#{1,4})\s+(.+)$/);
      if (hMatch) {
        const lvl = hMatch[1].length;
        html += `<h${lvl} class="md-h">${inlineFmt(hMatch[2])}</h${lvl}>`;
        i++; continue;
      }

      // Horizontal rule
      if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
        html += '<hr class="md-hr"/>';
        i++; continue;
      }

      // Unordered list
      if (/^\s*[-*]\s/.test(line)) {
        html += '<ul class="md-list">';
        while (i < lines.length && /^\s*[-*]\s/.test(lines[i])) {
          html += `<li>${inlineFmt(lines[i].replace(/^\s*[-*]\s/, ''))}</li>`;
          i++;
        }
        html += '</ul>';
        continue;
      }

      // Ordered list
      if (/^\s*\d+\.\s/.test(line)) {
        html += '<ol class="md-list">';
        while (i < lines.length && /^\s*\d+\.\s/.test(lines[i])) {
          html += `<li>${inlineFmt(lines[i].replace(/^\s*\d+\.\s/, ''))}</li>`;
          i++;
        }
        html += '</ol>';
        continue;
      }

      // Empty line = spacing
      if (line.trim() === '') { i++; continue; }

      // Regular paragraph — gather consecutive text lines
      let para = '';
      while (i < lines.length && lines[i].trim() !== '' && !/^#{1,4}\s/.test(lines[i]) && !/^\s*[-*]\s/.test(lines[i]) && !/^\s*\d+\.\s/.test(lines[i]) && !/^%%CB_/.test(lines[i]) && !/^(-{3,}|\*{3,}|_{3,})$/.test(lines[i].trim())) {
        if (para) para += '<br/>';
        para += inlineFmt(lines[i]);
        i++;
      }
      if (para) html += `<p class="md-p">${para}</p>`;
    }

    return html;
  };

  // Check if message contains booking trigger
  const hasBookingTrigger = (text) => {
    return text.includes('[BOOK_CALL]');
  };

  return (
    <div style={styles.container}>
      {/* API Key Modal */}
      {showApiModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <div style={styles.modalRobot}>
              <span style={styles.robotEyes}>👀</span>
              <span style={styles.robotBolt}>⚡</span>
            </div>
            <h2 style={styles.modalTitle}>Power Up Mr. Better Boss ⚡</h2>
            <p style={styles.modalSubtitle}>Enter your Anthropic API key to activate the AI assistant with web search capabilities</p>

            {error && <div style={styles.error}>{error}</div>}

            <div style={styles.formGroup}>
              <label style={styles.label}>Anthropic API Key</label>
              <div style={styles.inputWrapper}>
                <input
                  type={apiKeyVisible ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && connectApiKey()}
                  placeholder="sk-ant-api03-..."
                  style={styles.input}
                />
                <button
                  onClick={() => setApiKeyVisible(!apiKeyVisible)}
                  style={styles.toggleBtn}
                >
                  {apiKeyVisible ? '🙈' : '👁️'}
                </button>
              </div>
              <p style={styles.helpText}>
                Don't have an API key?{' '}
                <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer" style={styles.link}>
                  Get one from Anthropic
                </a>
              </p>
            </div>

            <button
              onClick={connectApiKey}
              disabled={isLoading}
              style={{...styles.primaryBtn, opacity: isLoading ? 0.6 : 1}}
            >
              {isLoading ? 'Connecting...' : '⚡ Connect & Start Chatting'}
            </button>

            <div style={styles.divider}>
              <span style={styles.dividerText}>or skip straight to action</span>
            </div>

            <button
              onClick={openBooking}
              style={styles.bookingBtnLarge}
            >
              📞 Book a FREE Growth Audit Call
            </button>
            <p style={styles.bookingSubtext}>
              No API key needed — talk directly with Nick Peret
            </p>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div style={styles.modalOverlay}>
          <div style={{...styles.modal, maxWidth: 650}}>
            <div style={styles.modalHeader}>
              <h2 style={{margin: 0, fontSize: 20}}>Settings</h2>
              <button onClick={() => setShowSettings(false)} style={styles.closeBtn}>×</button>
            </div>

            <div style={styles.tabs}>
              {['personality', 'quickactions', 'api'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    ...styles.tab,
                    background: activeTab === tab ? '#5d47fa' : 'transparent',
                    color: activeTab === tab ? '#fff' : '#6b6b8a'
                  }}
                >
                  {tab === 'personality' && 'Personality'}
                  {tab === 'quickactions' && 'Quick Actions'}
                  {tab === 'api' && 'API'}
                </button>
              ))}
            </div>

            {activeTab === 'personality' && (
              <div style={styles.tabContent}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Bot Name</label>
                  <input
                    value={settings.botName}
                    onChange={(e) => setSettings(s => ({...s, botName: e.target.value}))}
                    style={styles.input}
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Tagline</label>
                  <input
                    value={settings.tagline}
                    onChange={(e) => setSettings(s => ({...s, tagline: e.target.value}))}
                    style={styles.input}
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Welcome Message</label>
                  <textarea
                    value={settings.welcomeMessage}
                    onChange={(e) => setSettings(s => ({...s, welcomeMessage: e.target.value}))}
                    rows={4}
                    style={{...styles.input, resize: 'vertical'}}
                  />
                </div>
              </div>
            )}

            {activeTab === 'quickactions' && (
              <div style={styles.tabContent}>
                <p style={{color: '#6b6b8a', fontSize: 13, marginBottom: 16}}>
                  Customize quick action buttons (max 8)
                </p>
                {settings.quickActions.map((qa, i) => (
                  <div key={i} style={styles.quickActionEditor}>
                    <input
                      value={qa.emoji}
                      onChange={(e) => updateQuickAction(i, 'emoji', e.target.value)}
                      style={{...styles.input, width: 50, textAlign: 'center', padding: 8}}
                    />
                    <input
                      value={qa.label}
                      onChange={(e) => updateQuickAction(i, 'label', e.target.value)}
                      placeholder="Label"
                      style={{...styles.input, width: 100, padding: 8}}
                    />
                    <input
                      value={qa.prompt}
                      onChange={(e) => updateQuickAction(i, 'prompt', e.target.value)}
                      placeholder="Prompt"
                      style={{...styles.input, flex: 1, padding: 8}}
                    />
                    <button onClick={() => removeQuickAction(i)} style={styles.deleteBtn}>X</button>
                  </div>
                ))}
                {settings.quickActions.length < 8 && (
                  <button onClick={addQuickAction} style={styles.addBtn}>+ Add Quick Action</button>
                )}
              </div>
            )}

            {activeTab === 'api' && (
              <div style={styles.tabContent}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Current API Key</label>
                  <div style={styles.inputWrapper}>
                    <input
                      type="password"
                      value={apiKey}
                      readOnly
                      style={{...styles.input, opacity: 0.7}}
                    />
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowSettings(false);
                    setShowApiModal(true);
                  }}
                  style={styles.secondaryBtn}
                >
                  Change API Key
                </button>
                <div style={{marginTop: 24, paddingTop: 24, borderTop: '1px solid rgba(93,71,250,0.2)'}}>
                  <button
                    onClick={() => {
                      localStorage.removeItem('mrBetterBoss_apiKey');
                      localStorage.removeItem('mrBetterBoss_settings');
                      window.location.reload();
                    }}
                    style={{...styles.secondaryBtn, color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)'}}
                  >
                    Reset Everything
                  </button>
                </div>
              </div>
            )}

            <div style={styles.modalFooter}>
              <button onClick={() => setMessages([])} style={styles.secondaryBtn}>Clear Chat</button>
              <button onClick={saveSettings} style={styles.primaryBtn}>Save Settings</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header style={styles.header}>
        <div style={styles.avatar}>
          <span style={styles.avatarEyes}>
            <span style={styles.eye}></span>
            <span style={styles.eye}></span>
          </span>
          <span style={styles.avatarBolt}>⚡</span>
        </div>
        <div style={styles.headerInfo}>
          <div style={styles.headerTitle}>{settings.botName} <span style={{color: '#f59e0b'}}>⚡</span></div>
          <div style={styles.headerSubtitle}>{settings.tagline}</div>
        </div>
        <button onClick={openBooking} style={styles.bookBtnHeader}>
          📞 Book Free Audit
        </button>
        <button onClick={() => setShowSettings(true)} style={styles.headerBtn}>⚙️</button>
        <div style={styles.status}>
          <span style={styles.statusDot}></span>
          Online
        </div>
      </header>

      {/* Chat Area */}
      <div ref={chatRef} style={styles.chatArea}>
        {messages.length === 0 ? (
          <div style={styles.welcome}>
            <div style={styles.welcomeRobot}>
              <span style={styles.welcomeEyes}>
                <span style={{...styles.eye, width: 14, height: 14}}></span>
                <span style={{...styles.eye, width: 14, height: 14}}></span>
              </span>
              <span style={{position: 'absolute', bottom: 28, fontSize: 32}}>⚡</span>
            </div>
            <h1 style={styles.welcomeTitle}>Hey there! <span style={{color: '#f59e0b'}}>⚡</span></h1>
            <p style={styles.welcomeText}
               dangerouslySetInnerHTML={{ __html: formatContent(settings.welcomeMessage) }}
            />

            {/* Booking CTA Card */}
            <div style={styles.bookingCard}>
              <div style={styles.bookingCardInner}>
                <div style={styles.bookingCardIcon}>📞</div>
                <div style={styles.bookingCardContent}>
                  <h3 style={styles.bookingCardTitle}>Free JobTread Growth Audit Call</h3>
                  <p style={styles.bookingCardDesc}>
                    Get a custom 30-day implementation roadmap. See how contractors are saving 20+ hrs/week and improving close rates by 19-42%.
                  </p>
                  <div style={styles.bookingCardStats}>
                    <span style={styles.stat}>⚡ 30-Day Guarantee</span>
                    <span style={styles.stat}>📈 19-42% Close Rate</span>
                    <span style={styles.stat}>⏱️ 20+ hrs/wk Saved</span>
                  </div>
                </div>
              </div>
              <button onClick={openBooking} style={styles.bookingCardBtn}>
                Book Your FREE Growth Audit →
              </button>
            </div>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={i}>
              <div style={styles.message(msg.role === 'user')}>
                <div style={styles.messageAvatar(msg.role === 'user')}>
                  {msg.role === 'user' ? '👤' : '⚡'}
                </div>
                <div
                  style={styles.messageContent(msg.role === 'user')}
                  dangerouslySetInnerHTML={{ __html: formatContent(msg.content) }}
                />
              </div>
              {/* Sources from web search */}
              {msg.role === 'assistant' && msg.sources && msg.sources.length > 0 && (
                <div style={styles.sourcesBox}>
                  <div style={styles.sourcesLabel}>Sources</div>
                  <div style={styles.sourcesList}>
                    {msg.sources.map((s, j) => (
                      <a key={j} href={s.url} target="_blank" rel="noreferrer" style={styles.sourceChip}>
                        {s.title || (() => { try { return new URL(s.url).hostname; } catch { return s.url; } })()}
                      </a>
                    ))}
                  </div>
                </div>
              )}
              {/* Inline Booking Button when AI suggests it */}
              {msg.role === 'assistant' && hasBookingTrigger(msg.content) && (
                <div style={styles.inlineBooking}>
                  <button onClick={openBooking} style={styles.inlineBookingBtn}>
                    📞 Book Your FREE Growth Audit Call
                  </button>
                  <span style={styles.inlineBookingNote}>Free 30-min call with Nick Peret — no obligation</span>
                </div>
              )}
            </div>
          ))
        )}
        {isLoading && (
          <div style={styles.message(false)}>
            <div style={styles.messageAvatar(false)}>⚡</div>
            <div style={styles.typing}>
              <span style={styles.typingDot}></span>
              <span style={{...styles.typingDot, animationDelay: '0.2s'}}></span>
              <span style={{...styles.typingDot, animationDelay: '0.4s'}}></span>
            </div>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div style={styles.quickActions}>
        {settings.quickActions.map((qa, i) => (
          <button
            key={i}
            onClick={() => {
              // If it's the booking action and no API key, open booking directly
              if (qa.label === 'Book Free Audit' && !apiKey) {
                openBooking();
              } else {
                sendMessage(qa.prompt);
              }
            }}
            disabled={isLoading || (!apiKey && qa.label !== 'Book Free Audit')}
            style={{
              ...styles.quickActionBtn,
              ...(qa.label === 'Book Free Audit' ? styles.quickActionBtnHighlight : {}),
              opacity: (isLoading || (!apiKey && qa.label !== 'Book Free Audit')) ? 0.5 : 1,
              cursor: (isLoading || (!apiKey && qa.label !== 'Book Free Audit')) ? 'not-allowed' : 'pointer'
            }}
          >
            {qa.emoji} {qa.label}
          </button>
        ))}
      </div>

      {/* Input Area */}
      <div style={styles.inputArea}>
        <div style={styles.chatInputWrapper}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && !isLoading && sendMessage(input)}
            placeholder={`Ask ${settings.botName} anything about JobTread...`}
            disabled={isLoading || !apiKey}
            style={styles.chatInput}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={isLoading || !input.trim() || !apiKey}
            style={{
              ...styles.sendBtn,
              opacity: (isLoading || !input.trim() || !apiKey) ? 0.5 : 1,
              cursor: (isLoading || !input.trim() || !apiKey) ? 'not-allowed' : 'pointer'
            }}
          >
            ➤
          </button>
        </div>
      </div>

      {/* Footer */}
      <div style={styles.footer}>
        Powered by <a href="https://better-boss.ai" target="_blank" rel="noreferrer" style={styles.footerLink}>Better Boss</a> ⚡ JobTread Certified Implementation Partner
        <span style={styles.footerSep}>|</span>
        <a href={CAL_BOOKING_URL} target="_blank" rel="noreferrer" style={styles.footerLink}>Book a Free Call</a>
      </div>

      <style jsx global>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: system-ui, -apple-system, sans-serif; }
        @keyframes pulse {
          0%, 100% { opacity: 0.4; transform: translateY(0); }
          50% { opacity: 1; transform: translateY(-4px); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes glow {
          0%, 100% { box-shadow: 0 0 20px rgba(93, 71, 250, 0.3); }
          50% { box-shadow: 0 0 30px rgba(93, 71, 250, 0.6), 0 0 60px rgba(93, 71, 250, 0.2); }
        }
        /* Markdown rendering styles */
        .md-h { margin: 12px 0 6px; font-weight: 700; line-height: 1.3; }
        h2.md-h { font-size: 1.25em; color: #a78bfa; }
        h3.md-h { font-size: 1.1em; color: #a78bfa; }
        h4.md-h { font-size: 1em; color: #a78bfa; }
        .md-p { margin: 6px 0; line-height: 1.7; }
        .md-list { margin: 8px 0; padding-left: 24px; }
        .md-list li { margin: 4px 0; line-height: 1.6; }
        .md-link { color: #7a64ff; text-decoration: none; border-bottom: 1px solid rgba(122,100,255,0.4); transition: border-color 0.2s; }
        .md-link:hover { border-color: #7a64ff; }
        .md-inline-code { background: rgba(93,71,250,0.2); padding: 2px 7px; border-radius: 5px; font-size: 0.9em; font-family: 'SF Mono', Monaco, Consolas, monospace; }
        .md-code-block { background: #13132a; border: 1px solid rgba(93,71,250,0.25); border-radius: 12px; padding: 16px; margin: 10px 0; overflow-x: auto; font-size: 0.88em; line-height: 1.6; font-family: 'SF Mono', Monaco, Consolas, monospace; }
        .md-code-block code { color: #c4b5fd; }
        .md-hr { border: none; height: 1px; background: rgba(93,71,250,0.25); margin: 16px 0; }
      `}</style>
    </div>
  );
}

// Styles object
const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    background: '#1a1a2e',
    color: '#fffdfd',
  },
  // Modal styles
  modalOverlay: {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0,0,0,0.85)',
    backdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    zIndex: 1000,
  },
  modal: {
    background: '#25253d',
    borderRadius: 24,
    padding: 32,
    maxWidth: 480,
    width: '100%',
    maxHeight: '90vh',
    overflowY: 'auto',
  },
  modalRobot: {
    width: 90,
    height: 90,
    background: 'linear-gradient(145deg, #5d47fa, #4a38d4)',
    borderRadius: 24,
    margin: '0 auto 24px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 10px 40px rgba(93, 71, 250, 0.4)',
    position: 'relative',
    animation: 'float 3s ease-in-out infinite',
  },
  robotEyes: { position: 'absolute', top: 22, fontSize: 20 },
  robotBolt: { position: 'absolute', bottom: 18, fontSize: 24 },
  modalTitle: { textAlign: 'center', fontSize: 24, marginBottom: 8 },
  modalSubtitle: { textAlign: 'center', color: '#6b6b8a', marginBottom: 24, lineHeight: 1.5 },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalFooter: { display: 'flex', gap: 12, marginTop: 24 },
  closeBtn: { background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 10, width: 36, height: 36, color: '#fff', cursor: 'pointer', fontSize: 20 },
  // Divider
  divider: {
    display: 'flex',
    alignItems: 'center',
    margin: '20px 0',
    gap: 12,
  },
  dividerText: {
    flex: 1,
    textAlign: 'center',
    color: '#6b6b8a',
    fontSize: 13,
    position: 'relative',
  },
  // Form styles
  formGroup: { marginBottom: 20 },
  label: { display: 'block', marginBottom: 8, fontSize: 14, fontWeight: 500 },
  inputWrapper: { display: 'flex', gap: 8 },
  input: {
    flex: 1,
    background: '#1a1a2e',
    border: '2px solid rgba(93,71,250,0.3)',
    borderRadius: 12,
    padding: 14,
    color: '#fff',
    fontSize: 15,
    outline: 'none',
  },
  toggleBtn: {
    background: '#1a1a2e',
    border: '2px solid rgba(93,71,250,0.3)',
    borderRadius: 12,
    padding: '0 16px',
    color: '#6b6b8a',
    cursor: 'pointer',
    fontSize: 16,
  },
  helpText: { fontSize: 13, color: '#6b6b8a', marginTop: 10 },
  link: { color: '#7a64ff', textDecoration: 'none' },
  error: {
    background: 'rgba(239,68,68,0.15)',
    border: '1px solid rgba(239,68,68,0.3)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    color: '#ef4444',
    fontSize: 14,
  },
  primaryBtn: {
    width: '100%',
    padding: 16,
    background: 'linear-gradient(135deg, #5d47fa, #7a64ff)',
    border: 'none',
    borderRadius: 12,
    color: '#fff',
    fontSize: 16,
    fontWeight: 600,
    cursor: 'pointer',
  },
  secondaryBtn: {
    flex: 1,
    padding: 14,
    background: '#1a1a2e',
    border: '2px solid rgba(93,71,250,0.3)',
    borderRadius: 12,
    color: '#fff',
    fontSize: 14,
    cursor: 'pointer',
  },
  // Booking button on API modal
  bookingBtnLarge: {
    width: '100%',
    padding: 16,
    background: 'linear-gradient(135deg, #10b981, #059669)',
    border: 'none',
    borderRadius: 12,
    color: '#fff',
    fontSize: 16,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'transform 0.2s, box-shadow 0.2s',
  },
  bookingSubtext: {
    textAlign: 'center',
    color: '#6b6b8a',
    fontSize: 12,
    marginTop: 8,
  },
  // Tabs
  tabs: { display: 'flex', gap: 8, marginBottom: 20, borderBottom: '1px solid rgba(93,71,250,0.2)', paddingBottom: 12 },
  tab: { padding: '10px 18px', border: 'none', borderRadius: 10, cursor: 'pointer', fontSize: 14 },
  tabContent: { display: 'flex', flexDirection: 'column', gap: 16 },
  // Quick action editor
  quickActionEditor: { display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 },
  deleteBtn: { background: 'rgba(239,68,68,0.2)', border: 'none', borderRadius: 10, width: 40, height: 40, color: '#ef4444', cursor: 'pointer', fontSize: 16 },
  addBtn: { padding: 14, background: 'transparent', border: '2px dashed rgba(93,71,250,0.3)', borderRadius: 12, color: '#6b6b8a', cursor: 'pointer', width: '100%' },
  // Header
  header: {
    padding: '16px 24px',
    background: 'linear-gradient(135deg, #25253d, #1a1a2e)',
    borderBottom: '1px solid rgba(93,71,250,0.3)',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  avatar: {
    width: 48,
    height: 48,
    background: 'linear-gradient(145deg, #5d47fa, #4a38d4)',
    borderRadius: 14,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    boxShadow: '0 4px 20px rgba(93,71,250,0.4)',
    flexShrink: 0,
  },
  avatarEyes: { position: 'absolute', top: 10, display: 'flex', gap: 8 },
  eye: { width: 8, height: 8, background: '#fff', borderRadius: '50%', boxShadow: '0 0 8px #fff' },
  avatarBolt: { position: 'absolute', bottom: 6, fontSize: 14 },
  headerInfo: { flex: 1, minWidth: 0 },
  headerTitle: { fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 },
  headerSubtitle: { fontSize: 13, color: '#6b6b8a', marginTop: 2 },
  bookBtnHeader: {
    padding: '10px 18px',
    background: 'linear-gradient(135deg, #10b981, #059669)',
    border: 'none',
    borderRadius: 12,
    color: '#fff',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 600,
    whiteSpace: 'nowrap',
    animation: 'glow 3s ease-in-out infinite',
  },
  headerBtn: {
    padding: '10px 14px',
    background: 'rgba(93,71,250,0.15)',
    border: '1px solid rgba(93,71,250,0.3)',
    borderRadius: 12,
    color: '#fff',
    cursor: 'pointer',
    fontSize: 14,
  },
  status: {
    padding: '8px 14px',
    background: 'rgba(16,185,129,0.15)',
    border: '1px solid rgba(16,185,129,0.3)',
    borderRadius: 20,
    fontSize: 13,
    color: '#10b981',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: { width: 8, height: 8, background: '#10b981', borderRadius: '50%' },
  // Chat
  chatArea: {
    flex: 1,
    overflowY: 'auto',
    padding: 24,
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    background: 'radial-gradient(ellipse at top left, rgba(93,71,250,0.08) 0%, transparent 50%), #1a1a2e',
  },
  welcome: { textAlign: 'center', padding: '32px 24px' },
  welcomeRobot: {
    width: 100,
    height: 100,
    background: 'linear-gradient(145deg, #5d47fa, #4a38d4)',
    borderRadius: 28,
    margin: '0 auto 24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    boxShadow: '0 12px 48px rgba(93,71,250,0.5)',
    animation: 'float 3s ease-in-out infinite',
  },
  welcomeEyes: { position: 'absolute', top: 24, display: 'flex', gap: 16 },
  welcomeTitle: { fontSize: 28, marginBottom: 12 },
  welcomeText: { color: '#9b9bb8', maxWidth: 500, margin: '0 auto', lineHeight: 1.7, fontSize: 16 },
  // Booking Card on Welcome
  bookingCard: {
    maxWidth: 520,
    margin: '28px auto 0',
    background: 'linear-gradient(135deg, rgba(93,71,250,0.12), rgba(16,185,129,0.12))',
    border: '1px solid rgba(16,185,129,0.3)',
    borderRadius: 20,
    padding: 24,
    textAlign: 'left',
  },
  bookingCardInner: {
    display: 'flex',
    gap: 16,
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  bookingCardIcon: {
    fontSize: 36,
    flexShrink: 0,
  },
  bookingCardContent: {
    flex: 1,
  },
  bookingCardTitle: {
    fontSize: 18,
    fontWeight: 700,
    marginBottom: 8,
    color: '#fff',
  },
  bookingCardDesc: {
    fontSize: 14,
    color: '#9b9bb8',
    lineHeight: 1.6,
    marginBottom: 12,
  },
  bookingCardStats: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
  },
  stat: {
    fontSize: 12,
    color: '#10b981',
    background: 'rgba(16,185,129,0.15)',
    padding: '4px 10px',
    borderRadius: 8,
    whiteSpace: 'nowrap',
  },
  bookingCardBtn: {
    width: '100%',
    padding: 14,
    background: 'linear-gradient(135deg, #10b981, #059669)',
    border: 'none',
    borderRadius: 12,
    color: '#fff',
    fontSize: 16,
    fontWeight: 700,
    cursor: 'pointer',
    letterSpacing: 0.3,
  },
  // Messages
  message: (isUser) => ({
    display: 'flex',
    gap: 12,
    maxWidth: '85%',
    alignSelf: isUser ? 'flex-end' : 'flex-start',
    flexDirection: isUser ? 'row-reverse' : 'row',
  }),
  messageAvatar: (isUser) => ({
    width: 38,
    height: 38,
    borderRadius: 12,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: isUser ? '#25253d' : 'linear-gradient(145deg, #5d47fa, #4a38d4)',
    fontSize: 16,
    flexShrink: 0,
  }),
  messageContent: (isUser) => ({
    padding: '14px 18px',
    borderRadius: 18,
    background: isUser ? 'linear-gradient(135deg, #5d47fa, #7a64ff)' : '#25253d',
    border: isUser ? 'none' : '1px solid rgba(93,71,250,0.2)',
    lineHeight: 1.7,
    fontSize: 15,
  }),
  // Inline Booking Button (appears in chat)
  inlineBooking: {
    marginLeft: 50,
    marginTop: 8,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    alignItems: 'flex-start',
  },
  inlineBookingBtn: {
    padding: '12px 24px',
    background: 'linear-gradient(135deg, #10b981, #059669)',
    border: 'none',
    borderRadius: 12,
    color: '#fff',
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
    animation: 'glow 3s ease-in-out infinite',
    transition: 'transform 0.2s',
  },
  inlineBookingNote: {
    fontSize: 12,
    color: '#6b6b8a',
    marginLeft: 4,
  },
  // Typing indicator
  typing: {
    padding: '16px 20px',
    background: '#25253d',
    border: '1px solid rgba(93,71,250,0.2)',
    borderRadius: 18,
    display: 'flex',
    gap: 6,
  },
  typingDot: {
    width: 10,
    height: 10,
    background: '#5d47fa',
    borderRadius: '50%',
    animation: 'pulse 1.4s infinite',
  },
  // Quick actions
  quickActions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    padding: '12px 24px',
    borderTop: '1px solid rgba(93,71,250,0.15)',
    background: 'rgba(0,0,0,0.2)',
  },
  quickActionBtn: {
    padding: '8px 14px',
    background: '#25253d',
    border: '1px solid rgba(93,71,250,0.3)',
    borderRadius: 20,
    color: '#fff',
    fontSize: 13,
    cursor: 'pointer',
  },
  quickActionBtnHighlight: {
    background: 'linear-gradient(135deg, rgba(16,185,129,0.25), rgba(5,150,105,0.25))',
    border: '1px solid rgba(16,185,129,0.5)',
    fontWeight: 600,
  },
  // Input
  inputArea: { padding: '12px 24px 20px', background: '#25253d', borderTop: '1px solid rgba(93,71,250,0.2)' },
  chatInputWrapper: {
    display: 'flex',
    gap: 12,
    background: '#1a1a2e',
    border: '2px solid rgba(93,71,250,0.3)',
    borderRadius: 16,
    padding: 8,
  },
  chatInput: {
    flex: 1,
    background: 'transparent',
    border: 'none',
    outline: 'none',
    color: '#fff',
    fontSize: 16,
    padding: '12px 14px',
  },
  sendBtn: {
    width: 52,
    height: 52,
    background: 'linear-gradient(135deg, #5d47fa, #7a64ff)',
    border: 'none',
    borderRadius: 12,
    color: '#fff',
    fontSize: 20,
  },
  // Footer
  footer: {
    padding: 12,
    textAlign: 'center',
    fontSize: 13,
    color: '#6b6b8a',
    borderTop: '1px solid rgba(93,71,250,0.1)',
  },
  footerLink: { color: '#7a64ff', textDecoration: 'none', fontWeight: 600 },
  footerSep: { margin: '0 8px', color: '#3a3a5a' },
  // Sources
  sourcesBox: {
    marginLeft: 50,
    marginTop: 8,
    padding: '10px 14px',
    background: 'rgba(93,71,250,0.08)',
    border: '1px solid rgba(93,71,250,0.2)',
    borderRadius: 12,
  },
  sourcesLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: '#6b6b8a',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  sourcesList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
  },
  sourceChip: {
    display: 'inline-block',
    padding: '5px 12px',
    background: 'rgba(93,71,250,0.15)',
    border: '1px solid rgba(93,71,250,0.3)',
    borderRadius: 8,
    color: '#7a64ff',
    fontSize: 12,
    textDecoration: 'none',
    maxWidth: 220,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
};
