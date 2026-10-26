import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useToast } from '../context/Toast.jsx';
import { useFetch, fmtDateTime, errMsg } from '../hooks.js';
import { Async, Button, Card, PageHeader, Pagination } from '../components/ui.jsx';

export default function Notifications() {
  const toast = useToast();
  const nav = useNavigate();
  const [page, setPage] = useState(1);
  const state = useFetch(() => api.get('/notifications', { page, limit: 15 }), [page]);

  async function open(n) {
    try { if (!n.read) await api.post(`/notifications/${n.id}/read`); } catch (e) { /* non-fatal */ }
    if (n.link) nav(n.link); else state.reload();
  }
  async function readAll() { try { await api.post('/notifications/read-all'); toast.success('All marked as read.'); state.reload(); } catch (e) { toast.error(errMsg(e)); } }
  return (
    <>
      <PageHeader title="Notifications"><Button small variant="ghost" onClick={readAll}>Mark all as read</Button></PageHeader>
      <Card>
        <Async state={state} empty={(d) => d.data.length === 0}>{(d) => (
          <>
            <ul className="notes">{d.data.map((n) => (
              <li key={n.id} className={n.read ? '' : 'unread'}><button className="note-btn" onClick={() => open(n)}><b>{n.title}</b><span>{n.message}</span><small className="muted">{fmtDateTime(n.createdAt)}</small></button></li>
            ))}</ul>
            <Pagination pagination={d.pagination} onPage={setPage} />
          </>
        )}</Async>
      </Card>
    </>
  );
}
