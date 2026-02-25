'use client';

import { useState, useRef, useEffect } from 'react';
import Nav from '../components/Nav';

export default function AgentPage() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const messagesEndRef = useRef(null);

  const userId = typeof window !== 'undefined' ? localStorage.getItem('bb_user_id') : null;
  const apiKey = typeof window !== 'undefined' ? localStorage.getItem('bb_api_key') : null;
  const grantKey = typeof window !== 'undefined' ? localStorage.getItem('bb_grant_key') : null;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function sendMessage(e) {
    e?.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg = { role: 'user', content: input.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          apiKey,
          grantKey,
          conversationId,
          userId,
        }),
      });
      const data = await res.json();
      if (data.error) {
        setMessages([...newMessages, { role: 'assistant', content: `Error: ${data.error}` }]);
      } else {
        setMessages([...newMessages, {
          role: 'assistant',
          content: data.content,
          toolCalls: data.toolCalls,
        }]);
        if (data.conversationId) setConversationId(data.conversationId);
      }
    } catch (err) {
      setMessages([...newMessages, { role: 'assistant', content: `Error: ${err.message}` }]);
    }
    setLoading(false);
  }

  const suggestions = [
    "What's my pipeline worth?",
    "Search for jobs with 'kitchen'",
    "Create a job for Smith Residence at 456 Oak Ave",
    "Show me recent invoices",
    "What jobs are currently active?",
  ];

  return (
    <>
      <Nav />
      <div style={styles.container}>
        <div style={styles.sidebar}>
          <h2 style={styles.sidebarTitle}>AI Agent</h2>
          <p style={styles.sidebarDesc}>
            Talk to your JobTread assistant. It can search jobs, create contacts, check your pipeline, and more.
          </p>
          <div style={styles.capabilities}>
            <h4 style={styles.capTitle}>Capabilities</h4>
            {[
              { icon: '🔍', label: 'Search jobs & contacts' },
              { icon: '➕', label: 'Create jobs & contacts' },
              { icon: '📊', label: 'Pipeline summary' },
              { icon: '💬', label: 'Add job comments' },
              { icon: '📋', label: 'View job details' },
              { icon: '🔄', label: 'Update job status' },
              { icon: '💰', label: 'Check invoices' },
            ].map((cap, i) => (
              <div key={i} style={styles.capItem}>
                <span>{cap.icon}</span>
                <span style={styles.capLabel}>{cap.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={styles.chatArea}>
          <div style={styles.messageList}>
            {messages.length === 0 && (
              <div style={styles.emptyChat}>
                <div style={styles.emptyIcon}>⚡</div>
                <h3 style={styles.emptyTitle}>Better Boss AI Agent</h3>
                <p style={styles.emptyDesc}>I can interact with your JobTread account. Try one of these:</p>
                <div style={styles.suggestionGrid}>
                  {suggestions.map((s, i) => (
                    <button key={i} onClick={() => { setInput(s); }} style={styles.suggestionBtn}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} style={{ ...styles.msgRow, justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  ...styles.msgBubble,
                  ...(msg.role === 'user' ? styles.userBubble : styles.assistantBubble),
                }}>
                  {msg.role === 'assistant' && msg.toolCalls?.length > 0 && (
                    <div style={styles.toolCallsBox}>
                      {msg.toolCalls.map((tc, j) => (
                        <div key={j} style={styles.toolCall}>
                          <span style={styles.toolIcon}>🔧</span>
                          <span style={styles.toolName}>{tc.name}</span>
                          <span style={styles.toolInput}>{JSON.stringify(tc.input)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={styles.msgText}>{msg.content}</div>
                </div>
              </div>
            ))}

            {loading && (
              <div style={styles.msgRow}>
                <div style={{ ...styles.msgBubble, ...styles.assistantBubble }}>
                  <div style={styles.typing}>
                    <span style={styles.dot} /><span style={{ ...styles.dot, animationDelay: '0.2s' }} /><span style={{ ...styles.dot, animationDelay: '0.4s' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={sendMessage} style={styles.inputArea}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Tell me what to do in JobTread..."
              style={styles.input}
              disabled={loading}
            />
            <button type="submit" disabled={loading || !input.trim()} style={styles.sendBtn}>
              Send
            </button>
          </form>
        </div>
      </div>
    </>
  );
}

const styles = {
  container: { display: 'flex', maxWidth: '1200px', margin: '0 auto', padding: '24px', gap: '24px', height: 'calc(100vh - 80px)' },
  sidebar: { width: '260px', flexShrink: 0 },
  sidebarTitle: { fontSize: '1.3em', fontWeight: 700, color: '#fff', marginBottom: '8px' },
  sidebarDesc: { color: '#6b7280', fontSize: '0.85em', marginBottom: '24px', lineHeight: 1.5 },
  capabilities: { display: 'flex', flexDirection: 'column', gap: '4px' },
  capTitle: { fontSize: '0.8em', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' },
  capItem: { display: 'flex', gap: '8px', alignItems: 'center', padding: '6px 0' },
  capLabel: { color: '#d1d5db', fontSize: '0.85em' },
  chatArea: { flex: 1, display: 'flex', flexDirection: 'column', background: '#12131a', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' },
  messageList: { flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px' },
  emptyChat: { textAlign: 'center', padding: '60px 20px', margin: 'auto' },
  emptyIcon: { fontSize: '3em', marginBottom: '12px' },
  emptyTitle: { fontSize: '1.2em', fontWeight: 700, color: '#fff', marginBottom: '8px' },
  emptyDesc: { color: '#6b7280', fontSize: '0.9em', marginBottom: '24px' },
  suggestionGrid: { display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' },
  suggestionBtn: { padding: '8px 14px', borderRadius: '100px', border: '1px solid rgba(93,71,250,0.3)', background: 'rgba(93,71,250,0.08)', color: '#7a64ff', fontSize: '0.8em', cursor: 'pointer' },
  msgRow: { display: 'flex' },
  msgBubble: { maxWidth: '75%', padding: '12px 16px', borderRadius: '16px', fontSize: '0.9em', lineHeight: 1.5 },
  userBubble: { background: 'linear-gradient(135deg, #5d47fa, #7a64ff)', color: '#fff', borderBottomRightRadius: '4px' },
  assistantBubble: { background: 'rgba(255,255,255,0.06)', color: '#e5e7eb', borderBottomLeftRadius: '4px' },
  msgText: { whiteSpace: 'pre-wrap' },
  toolCallsBox: { display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)' },
  toolCall: { display: 'flex', gap: '6px', alignItems: 'center', fontSize: '0.75em' },
  toolIcon: { flexShrink: 0 },
  toolName: { color: '#7a64ff', fontWeight: 600 },
  toolInput: { color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '300px' },
  typing: { display: 'flex', gap: '4px', padding: '4px 0' },
  dot: { width: '6px', height: '6px', borderRadius: '50%', background: '#6b7280', animation: 'pulse 1s infinite' },
  inputArea: { display: 'flex', gap: '8px', padding: '16px', borderTop: '1px solid rgba(255,255,255,0.06)' },
  input: { flex: 1, padding: '12px 16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#e5e7eb', fontSize: '0.9em', outline: 'none' },
  sendBtn: { padding: '12px 24px', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg, #5d47fa, #7a64ff)', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: '0.9em' },
};
