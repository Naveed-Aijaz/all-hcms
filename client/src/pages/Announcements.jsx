import { useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../context/Auth.jsx';
import { useToast } from '../context/Toast.jsx';
import { useFetch, fmtDateTime, errMsg } from '../hooks.js';
import { Async, Button, Card, Field, PageHeader, Pagination, fieldErrors } from '../components/ui.jsx';

export default function Announcements() {
  const { user } = useAuth();
  const toast = useToast();
  const canPost = user.role === 'admin' || user.role === 'hr';
  const [page, setPage] = useState(1);
  const [v, setV] = useState({ title: '', body: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const state = useFetch(() => api.get('/announcements', { page, limit: 10 }), [page]);

  async function post(e) {
    e.preventDefault();
    const er = {};
    if (!v.title.trim()) er.title = 'Required';
    if (!v.body.trim()) er.body = 'Required';
    setErrors(er);
    if (Object.keys(er).length) return;
    setBusy(true);
    try { await api.post('/announcements', v); toast.success('Announcement published and everyone was notified.'); setV({ title: '', body: '' }); setPage(1); state.reload(); }
    catch (err) { setErrors({ ...fieldErrors(err), form: err.message }); } finally { setBusy(false); }
  }
  async function remove(id) { try { await api.del(`/announcements/${id}`); toast.success('Announcement deleted.'); state.reload(); } catch (e) { toast.error(errMsg(e)); } }
  return (
    <>
      <PageHeader title="Announcements" />
      {canPost && (
        <Card title="New announcement">
          <form onSubmit={post} noValidate>
            <Field label="Title" error={errors.title}><input value={v.title} maxLength={140} onChange={(e) => setV({ ...v, title: e.target.value })} /></Field>
            <Field label="Message" error={errors.body}><textarea rows={3} maxLength={2000} value={v.body} onChange={(e) => setV({ ...v, body: e.target.value })} /></Field>
            {errors.form && <div className="alert alert-error">{errors.form}</div>}
            <Button type="submit" loading={busy}>Publish</Button>
          </form>
        </Card>
      )}
      <Async state={state} empty={(d) => d.data.length === 0}>{(d) => (
        <>
          {d.data.map((a) => (
            <Card key={a.id} title={a.title} actions={canPost && (user.role === 'admin' || a.authorName === user.name) ? <Button small variant="ghost" onClick={() => remove(a.id)}>Delete</Button> : null}>
              <p className="pre">{a.body}</p><small className="muted">{a.authorName} - {fmtDateTime(a.createdAt)}</small>
            </Card>
          ))}
          <Pagination pagination={d.pagination} onPage={setPage} />
        </>
      )}</Async>
    </>
  );
}
