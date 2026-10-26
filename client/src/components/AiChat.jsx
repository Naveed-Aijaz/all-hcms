import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../context/Auth.jsx';

const HINTS = {
  admin: ['How many active employees do we have?', 'What is this month\'s attendance rate?', 'What is the late-arrival rule?'],
  hr: ['Who came late most often this month?', 'Who is on leave today?', 'What is this month\'s attendance rate?'],
  manager: ['How is my team\'s attendance this month?', 'How many sick leaves do I have left?', 'How is payroll calculated?'],
  employee: ['How many sick leaves do I have left this year?', 'What is the late-arrival rule?', 'How is my salary deduction calculated?'],
};

export default function AiChat() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState([{ role: 'ai', text: `Hi ${user.name.split(' ')[0]}! Ask me about attendance, leave, policies or your data. I only see what you are allowed to see.`, generated: false }]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const end = useRef(null);
  useEffect(() => { end.current && end.current.scrollIntoView({ behavior: 'smooth' }); }, [msgs, open]);

  async function send(q) {
    const message = (q ?? text).trim();
    if (!message || busy) return;
    setText('');
    setMsgs((m) => [...m, { role: 'me', text: message }]);
    setBusy(true);
    try {
      const r = await api.post('/ai/chat', { message });
      setMsgs((m) => [...m, { role: 'ai', text: r.data.answer, generated: r.data.aiGenerated }]);
    } catch (e) {
      setMsgs((m) => [...m, { role: 'ai', text: e.status === 429 ? 'You have reached the hourly AI limit. Please try again later.' : 'The assistant could not answer right now. Please try again.', generated: false, error: true }]);
    } finally { setBusy(false); }
  }

  return (
    <>
      <button className="ai-fab" onClick={() => setOpen((o) => !o)} aria-label="Open AI assistant">{open ? 'x' : 'AI'}</button>
      {open && (
        <div className="ai-panel" role="dialog" aria-label="AI assistant">
          <div className="ai-head">Assistant</div>
          <div className="ai-body">
            {msgs.map((m, i) => (
              <div key={i} className={`ai-msg ai-${m.role}${m.error ? ' ai-err' : ''}`}>
                {m.text}
                {m.role === 'ai' && m.generated && <small className="ai-tag">AI-generated - verify important details</small>}
              </div>
            ))}
            {busy && <div className="ai-msg ai-ai"><span className="spinner" /> Thinking...</div>}
            {msgs.length === 1 && <div className="ai-hints">{(HINTS[user.role] || []).map((h) => <button key={h} className="chip" onClick={() => send(h)}>{h}</button>)}</div>}
            <div ref={end} />
          </div>
          <div className="ai-input">
            <input value={text} maxLength={1000} placeholder="Ask a question..." onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} aria-label="Message" />
            <button className="btn btn-primary btn-small" disabled={busy || !text.trim()} onClick={() => send()}>Send</button>
          </div>
        </div>
      )}
    </>
  );
}
