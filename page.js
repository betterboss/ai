'use client';

import { useState, useRef, useEffect } from 'react';

// Default settings with all Better Boss knowledge
const DEFAULT_SETTINGS = {
  botName: 'Mr. Better Boss',
  tagline: 'Your AI JobTread Implementation Guide',
  welcomeMessage: "Hey there! ⚡ I'm Mr. Better Boss, your AI guide for all things JobTread. I can help with estimates, workflows, automations, integrations, and more. I can even search the web for the latest info. What's on your mind?",
  quickActions: [
    { emoji: '📋', label: 'Estimate templates', prompt: 'How do I build an effective estimate template in JobTread?' },
    { emoji: '⚙️', label: 'Automate workflows', prompt: 'What are the best automations to set up with n8n and JobTread?' },
    { emoji: '📦', label: 'Setup catalog', prompt: 'How do I set up my catalog and pricing in JobTread?' },
    { emoji: '🔗', label: 'Integrations', prompt: 'What integrations work with JobTread and how do I set them up?' },
    { emoji: '🚀', label: 'Faster estimates', prompt: 'How can I speed up my estimates to close more deals?' },
    { emoji: '💰', label: 'Improve close rate', prompt: 'How can Better Boss help me improve my close rate?' }
  ]
};

export default function Home() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [showApiModal, setShowApiModal] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [apiKeyVisible, setApiKeyVisible] = useState(false);
  const [error, setError] = useState('');
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [activeTab, setActiveTab] = useState('personality');
  const chatRef = useRef(null);

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
      // Test the API key with a simple request
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
        setMessages([...newMessages, { role: 'assistant', content: data.content }]);
      } else {
        setMessages([...newMessages, { 
          role: 'assistant', 
          content: `⚠️ ${data.error || 'Something went wrong. Please try again.'}` 
        }]);
      }
    } catch (err) {
      setMessages([...newMessages, { 
        role: 'assistant', 
        content: '⚠️ Connection error. Please check your internet and try again.' 
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

  // Format message content (basic markdown)
  const formatContent = (text) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code style="background:rgba(0,0,0,0.3);padding:2px 6px;border-radius:4px;font-size:0.9em;">$1</code>')
      .replace(/\n/g, '<br/>');
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
                  Get one from Anthropic →
                </a>
              </p>
            </div>

            <button 
              onClick={connectApiKey}
              disabled={isLoading}
              style={{...styles.primaryBtn, opacity: isLoading ? 0.6 : 1}}
            >
              {isLoading ? '⏳ Connecting...' : '⚡ Connect & Start Chatting'}
            </button>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div style={styles.modalOverlay}>
          <div style={{...styles.modal, maxWidth: 650}}>
            <div style={styles.modalHeader}>
              <h2 style={{margin: 0, fontSize: 20}}>⚙️ Bot Settings</h2>
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
                  {tab === 'personality' && '🤖 Personality'}
                  {tab === 'quickactions' && '⚡ Quick Actions'}
                  {tab === 'api' && '🔑 API'}
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
                    <button onClick={() => removeQuickAction(i)} style={styles.deleteBtn}>🗑️</button>
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
                  🔑 Change API Key
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
                    🗑️ Reset Everything
                  </button>
                </div>
              </div>
            )}

            <div style={styles.modalFooter}>
              <button onClick={() => setMessages([])} style={styles.secondaryBtn}>🗑️ Clear Chat</button>
              <button onClick={saveSettings} style={styles.primaryBtn}>💾 Save Settings</button>
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
        <button onClick={() => setShowSettings(true)} style={styles.headerBtn}>⚙️ Settings</button>
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
            <p style={styles.welcomeText}>{settings.welcomeMessage}</p>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} style={styles.message(msg.role === 'user')}>
              <div style={styles.messageAvatar(msg.role === 'user')}>
                {msg.role === 'user' ? '👤' : '⚡'}
              </div>
              <div 
                style={styles.messageContent(msg.role === 'user')}
                dangerouslySetInnerHTML={{ __html: formatContent(msg.content) }}
              />
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
            onClick={() => sendMessage(qa.prompt)}
            disabled={isLoading || !apiKey}
            style={{
              ...styles.quickActionBtn,
              opacity: (isLoading || !apiKey) ? 0.5 : 1,
              cursor: (isLoading || !apiKey) ? 'not-allowed' : 'pointer'
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
            placeholder={`Ask ${settings.botName} anything...`}
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
    gap: 16,
    flexWrap: 'wrap',
  },
  avatar: {
    width: 56,
    height: 56,
    background: 'linear-gradient(145deg, #5d47fa, #4a38d4)',
    borderRadius: 16,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    boxShadow: '0 4px 20px rgba(93,71,250,0.4)',
  },
  avatarEyes: { position: 'absolute', top: 12, display: 'flex', gap: 8 },
  eye: { width: 8, height: 8, background: '#fff', borderRadius: '50%', boxShadow: '0 0 8px #fff' },
  avatarBolt: { position: 'absolute', bottom: 8, fontSize: 16 },
  headerInfo: { flex: 1 },
  headerTitle: { fontSize: 20, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 },
  headerSubtitle: { fontSize: 14, color: '#6b6b8a', marginTop: 2 },
  headerBtn: {
    padding: '10px 18px',
    background: 'rgba(93,71,250,0.15)',
    border: '1px solid rgba(93,71,250,0.3)',
    borderRadius: 12,
    color: '#fff',
    cursor: 'pointer',
    fontSize: 14,
  },
  status: {
    padding: '10px 16px',
    background: 'rgba(16,185,129,0.15)',
    border: '1px solid rgba(16,185,129,0.3)',
    borderRadius: 20,
    fontSize: 14,
    color: '#10b981',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: { width: 10, height: 10, background: '#10b981', borderRadius: '50%' },
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
  welcome: { textAlign: 'center', padding: '48px 24px' },
  welcomeRobot: {
    width: 120,
    height: 120,
    background: 'linear-gradient(145deg, #5d47fa, #4a38d4)',
    borderRadius: 32,
    margin: '0 auto 24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    boxShadow: '0 12px 48px rgba(93,71,250,0.5)',
    animation: 'float 3s ease-in-out infinite',
  },
  welcomeEyes: { position: 'absolute', top: 30, display: 'flex', gap: 20 },
  welcomeTitle: { fontSize: 28, marginBottom: 12 },
  welcomeText: { color: '#6b6b8a', maxWidth: 450, margin: '0 auto', lineHeight: 1.7, fontSize: 16 },
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
    gap: 10,
    padding: '14px 24px',
    borderTop: '1px solid rgba(93,71,250,0.15)',
    background: 'rgba(0,0,0,0.2)',
  },
  quickActionBtn: {
    padding: '10px 16px',
    background: '#25253d',
    border: '1px solid rgba(93,71,250,0.3)',
    borderRadius: 20,
    color: '#fff',
    fontSize: 14,
  },
  // Input
  inputArea: { padding: '14px 24px 24px', background: '#25253d', borderTop: '1px solid rgba(93,71,250,0.2)' },
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
    padding: 14,
    textAlign: 'center',
    fontSize: 13,
    color: '#6b6b8a',
    borderTop: '1px solid rgba(93,71,250,0.1)',
  },
  footerLink: { color: '#7a64ff', textDecoration: 'none', fontWeight: 600 },
};
