import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useStore } from '../../store';
import {
  CalendarClock, Play, Square, Plus, Pencil,
  Trash2, X, Check, ListChecks, Users, Clock,
  ChevronDown, ChevronUp, TriangleAlert, RotateCcw,
  ShieldAlert, SkipForward, Activity, Trophy, Megaphone
} from 'lucide-react';
import { AdminStatusPanel } from '../../components/live/AdminStatusPanel';

const INPUT_CLS = "w-full bg-slate-900 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-blue-500 transition-colors";

const TYPE_LABELS = { quiz: 'Standard Quiz', rapid_fire: 'Rapid Fire', treasure_hunt: 'Treasure Hunt', coding_challenge: 'Coding Challenge' };
const TYPE_COLORS = {
  quiz:             'color: var(--blue); border-color: rgba(37,99,235,0.25); background: rgba(37,99,235,0.06);',
  rapid_fire:       'color: var(--amber); border-color: rgba(245,158,11,0.25); background: rgba(245,158,11,0.06);',
  treasure_hunt:    'color: var(--green); border-color: rgba(16,185,129,0.25); background: rgba(16,185,129,0.06);',
  coding_challenge: 'color: #a855f7; border-color: rgba(168,85,247,0.25); background: rgba(168,85,247,0.06);',
};

const EMPTY_FORM = {
  title: '', description: '', type: 'quiz',
  start_at: '', end_at: '', max_participants: 100, sponsor_logo_url: '',
  question_count: ''  // Feature 12: UI-only, not sent to DB
};

// Helper to parse the legacy string styles into objects
const parseStyle = (str) => {
  const obj = {};
  str.split(';').forEach(pair => {
    const [k, v] = pair.split(':');
    if (k && v) obj[k.trim().replace(/-([a-z])/g, g => g[1].toUpperCase())] = v.trim();
  });
  return obj;
};

const dayStart = (dateValue) => {
  if (!dateValue) return '';
  return new Date(`${dateValue}T00:00:00`).toISOString();
};

const dayEnd = (dateValue) => {
  if (!dateValue) return '';
  return new Date(`${dateValue}T23:59:59.999`).toISOString();
};

const Label = ({ children }) => (
  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
    {children}
  </label>
);

export function AdminEvents() {
  const user = useStore(state => state.user);

  const [events, setEvents]             = useState([]);
  const [questions, setQuestions]       = useState([]);
  const [loading, setLoading]           = useState(true);
  const [showForm, setShowForm]         = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [formData, setFormData]         = useState(EMPTY_FORM);

  // Per-event question assignment panel
  const [expandedEventId, setExpandedEventId]  = useState(null);
  const [assignedQMap, setAssignedQMap]        = useState({});
  const [assignedMetaMap, setAssignedMetaMap]  = useState({});

  // Feature 12: guided selection state per event
  // { [eventId]: { active: bool, target: number, currentStep: number } }
  const [guidedState, setGuidedState] = useState({});

  // Feature 10: Go Live / End Event confirmation modal
  // null | { eventId, action: 'live' | 'ended', title, participantCount, questionCount }
  const [confirmModal, setConfirmModal] = useState(null);
  const [confirmInput, setConfirmInput] = useState('');

  // Feature 3: Admin status panel expanded event
  const [statusPanelEventId, setStatusPanelEventId] = useState(null);

  // ── Fetch ──────────────────────────────────────────────────
  const fetchEvents = useCallback(async () => {
    const { data } = await supabase
      .from('events')
      .select('*, participation(count)')
      .order('created_at', { ascending: false });
    if (data) setEvents(data);
    setLoading(false);
  }, []);

  const fetchQuestions = useCallback(async () => {
    const { data } = await supabase
      .from('question_bank')
      .select('id, question, difficulty, correct_answer, options')
      .order('created_at', { ascending: false });
    if (data) setQuestions(data);
  }, []);

  useEffect(() => { fetchEvents(); fetchQuestions(); }, [fetchEvents, fetchQuestions]);

  // Load event questions when expanding
  const toggleExpand = async (eventId) => {
    if (expandedEventId === eventId) { setExpandedEventId(null); return; }
    setExpandedEventId(eventId);
    // Always re-fetch when expanding to catch another-admin edits (fix #24)
    const { data } = await supabase
      .from('event_questions')
      .select('id, question_id, order_num')
      .eq('event_id', eventId)
      .order('order_num', { ascending: true });
    if (data) {
      setAssignedQMap(m => ({ ...m, [eventId]: data.map(d => d.question_id) }));
      setAssignedMetaMap(m => ({ ...m, [eventId]: data }));
    }
  };

  // ── Create ─────────────────────────────────────────────────
  const handleCreate = async (e) => {
    e.preventDefault();
    const { question_count, ...rest } = formData; // strip UI-only field
    const payload = {
      ...rest,
      start_at: dayStart(formData.start_at),
      end_at:   dayEnd(formData.end_at || formData.start_at),
      max_participants: Number(formData.max_participants),
      created_by: user.id
    };
    const { data: created, error } = await supabase.from('events')
      .insert([payload]).select().single();
    if (error) { alert(error.message); return; }
    setShowForm(false);
    setFormData(EMPTY_FORM);
    await fetchEvents();
    // Feature 12: Auto-expand + enter guided selection if question_count was set
    if (created?.id) {
      setExpandedEventId(created.id);
      setAssignedQMap(m => ({ ...m, [created.id]: [] }));
      setAssignedMetaMap(m => ({ ...m, [created.id]: [] }));
      const targetCount = parseInt(question_count, 10);
      if (targetCount > 0) {
        setGuidedState(s => ({
          ...s,
          [created.id]: { active: true, target: targetCount, currentStep: 1 }
        }));
      }
    }
  };

  // ── Edit / Update ──────────────────────────────────────────
  const openEdit = (evt) => {
    setEditingEvent(evt);
    setFormData({
      title:           evt.title,
      description:     evt.description || '',
      type:            evt.type,
      start_at:        evt.start_at ? evt.start_at.slice(0, 10) : '',
      end_at:          evt.end_at   ? evt.end_at.slice(0, 10)   : '',
      max_participants: evt.max_participants || 100,
      sponsor_logo_url: evt.sponsor_logo_url || '',
      question_count:  '',
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    const { question_count, ...rest } = formData;
    const payload = {
      ...rest,
      start_at: dayStart(formData.start_at),
      end_at:   dayEnd(formData.end_at || formData.start_at),
      max_participants: Number(formData.max_participants)
    };
    const { error } = await supabase.from('events')
      .update(payload)
      .eq('id', editingEvent.id);
    if (error) { alert(error.message); return; }
    setShowForm(false);
    setEditingEvent(null);
    setFormData(EMPTY_FORM);
    fetchEvents();
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditingEvent(null);
    setFormData(EMPTY_FORM);
  };

  // ── Feature 10: Status Control with confirmation guard ──────
  const initiateStatusChange = (evt, status) => {
    const participantCount = evt.participation?.[0]?.count || 0;
    const questionCount = assignedQMap[evt.id]?.length ?? '?';
    setConfirmModal({
      eventId: evt.id,
      action: status,
      title: evt.title,
      participantCount,
      questionCount,
    });
    setConfirmInput('');
  };

  const confirmStatusChange = async () => {
    if (!confirmModal || confirmInput !== 'CONFIRM') return;
    const { eventId, action } = confirmModal;

    let updates = { status: action };
    if (action === 'live') {
      updates.status = 'live';
      updates.start_at = new Date().toISOString();
      updates.results_announced = false; // Reset on start
    }
    if (action === 'ended') {
      updates.status = 'ended';
      updates.end_at = new Date().toISOString();
    }
    if (action === 'announce') {
      const { error } = await supabase.from('events').update({ results_announced: true }).eq('id', eventId);
      if (!error) fetchEvents();
      else alert(error.message);
      setConfirmModal(null);
      setConfirmInput('');
      return;
    }

    const { error } = await supabase.from('events').update(updates).eq('id', eventId);
    if (!error) fetchEvents();
    else alert(error.message);
    setConfirmModal(null);
    setConfirmInput('');
  };

  const setStatusDirect = async (id, status) => {
    // For reset-to-upcoming (less dangerous), no guard needed
    const updates = { status };
    if (status === 'upcoming') updates.results_announced = false; 
    const { error } = await supabase.from('events').update(updates).eq('id', id);
    if (!error) fetchEvents();
    else alert(error.message);
  };

  // ── Delete ─────────────────────────────────────────────────
  const handleDelete = async (id) => {
    if (!confirm('⚠️ Delete this event permanently? This will remove all participations and assigned questions.')) return;
    await supabase.from('events').delete().eq('id', id);
    fetchEvents();
  };

  // ── Question Assignment ────────────────────────────────────
  const toggleQuestion = async (eventId, qId) => {
    const current = assignedQMap[eventId] || [];
    const meta    = assignedMetaMap[eventId] || [];

    if (current.includes(qId)) {
      await supabase.from('event_questions')
        .delete().match({ event_id: eventId, question_id: qId });
      setAssignedQMap(m => ({ ...m, [eventId]: current.filter(id => id !== qId) }));
      setAssignedMetaMap(m => ({ ...m, [eventId]: meta.filter(r => r.question_id !== qId) }));
    } else {
      const nextOrder = current.length + 1;
      const { data } = await supabase.from('event_questions')
        .insert([{ event_id: eventId, question_id: qId, order_num: nextOrder }])
        .select();
      if (data) {
        setAssignedQMap(m => ({ ...m, [eventId]: [...current, qId] }));
        setAssignedMetaMap(m => ({ ...m, [eventId]: [...meta, data[0]] }));
      }
    }
  };

  const removeQuestion = async (eventId, qId) => {
    await supabase.from('event_questions')
      .delete().match({ event_id: eventId, question_id: qId });
    setAssignedQMap(m => ({ ...m, [eventId]: (m[eventId] || []).filter(id => id !== qId) }));
    setAssignedMetaMap(m => ({ ...m, [eventId]: (m[eventId] || []).filter(r => r.question_id !== qId) }));
  };

  // Feature 12: Guided selection actions
  const guidedAddQuestion = async (eventId, qId) => {
    await toggleQuestion(eventId, qId);
    const gs = guidedState[eventId];
    if (!gs) return;
    const nextStep = gs.currentStep + 1;
    if (nextStep > gs.target) {
      setGuidedState(s => ({ ...s, [eventId]: { ...gs, active: false } }));
    } else {
      setGuidedState(s => ({ ...s, [eventId]: { ...gs, currentStep: nextStep } }));
    }
  };

  const guidedSkipQuestion = (eventId) => {
    const gs = guidedState[eventId];
    if (!gs) return;
    const nextStep = gs.currentStep + 1;
    if (nextStep > gs.target) {
      setGuidedState(s => ({ ...s, [eventId]: { ...gs, active: false } }));
    } else {
      setGuidedState(s => ({ ...s, [eventId]: { ...gs, currentStep: nextStep } }));
    }
  };

  const exitGuidedMode = (eventId) => {
    setGuidedState(s => ({ ...s, [eventId]: { ...(s[eventId] || {}), active: false } }));
  };

  // ── Announce Winner (separate from End Event) ───────────────────────
  // Sets results_announced = true WITHOUT changing event status.
  // Participants on waiting screen see the ceremony; event stays live.

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60dvh' }}>
      <div style={{ width: 40, height: 40, border: '3px solid var(--elevated)', borderTopColor: 'var(--blue)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  );

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-10 pb-20">

      {/* Feature 10: Confirmation Modal */}
      {confirmModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'var(--surface)', border: `1px solid ${confirmModal.action === 'live' ? 'rgba(16,185,129,0.4)' : confirmModal.action === 'announce' ? 'rgba(245,158,11,0.4)' : 'rgba(239,68,68,0.4)'}`, borderRadius: 12, padding: 32, maxWidth: 460, width: '100%', boxShadow: '0 20px 40px rgba(0,0,0,0.4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--elevated)', border: '1px solid var(--border)' }}>
                {confirmModal.action === 'live' ? <Play size={20} style={{ color: 'var(--green)' }} /> :
                 confirmModal.action === 'announce' ? <Trophy size={20} style={{ color: 'var(--amber)' }} /> :
                 <Square size={20} style={{ color: 'var(--red)' }} />
                }
              </div>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
                  {confirmModal.action === 'live' ? 'Deploy Event Live?' : 
                   confirmModal.action === 'announce' ? 'Announce Winner Ceremony?' : 'End Active Event?'}
                </h3>
                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{confirmModal.title}</p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 24 }}>
              <div style={{ background: 'var(--elevated)', padding: '12px 8px', borderRadius: 6, textAlign: 'center' }}>
                <p style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>{confirmModal.participantCount}</p>
                <p style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Users</p>
              </div>
              <div style={{ background: 'var(--elevated)', padding: '12px 8px', borderRadius: 6, textAlign: 'center' }}>
                <p style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>{confirmModal.questionCount}</p>
                <p style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Questions</p>
              </div>
              <div style={{ background: 'var(--elevated)', padding: '12px 8px', borderRadius: 6, textAlign: 'center' }}>
                <p style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>{confirmModal.action}</p>
                <p style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Action</p>
              </div>
            </div>

            {confirmModal.action === 'ended' && (
              <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', padding: 12, borderRadius: 8, marginBottom: 24 }}>
                <p style={{ fontSize: 12, color: 'var(--red)', fontWeight: 600, textAlign: 'center' }}>Warning: This will immediately close all active sessions.</p>
              </div>
            )}

            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>Verification: Type <span style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 700, color: 'var(--text-primary)', background: 'var(--elevated)', padding: '2px 6px', borderRadius: 4 }}>CONFIRM</span> below</p>
            <input
              type="text"
              value={confirmInput}
              onChange={e => setConfirmInput(e.target.value)}
              placeholder="CONFIRM"
              style={{ width: '100%', background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: 12, color: 'var(--text-primary)', fontFamily: 'ui-monospace, monospace', textTransform: 'uppercase', marginBottom: 24, fontSize: 14 }}
            />

            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => { setConfirmModal(null); setConfirmInput(''); }}
                className="btn-ghost"
                style={{ flex: 1, padding: '10px 0' }}
              >
                Cancel
              </button>
              <button
                onClick={confirmStatusChange}
                disabled={confirmInput !== 'CONFIRM'}
                className="btn-primary"
                style={{
                  flex: 1,
                  padding: '10px 0',
                  background: confirmModal.action === 'live' ? 'var(--green)' : confirmModal.action === 'announce' ? 'var(--amber)' : 'var(--red)',
                  color: confirmModal.action === 'live' ? '#000' : confirmModal.action === 'announce' ? '#000' : '#fff'
                }}
              >
                {confirmModal.action === 'live' ? 'Confirm Live' : 
                 confirmModal.action === 'announce' ? 'Confirm Announce' : 'Confirm End'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Event Master</h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 4 }}>Manage competition lifecycle, question assignments, and real-time deployments.</p>
        </div>
        <button
          onClick={() => { setEditingEvent(null); setFormData(EMPTY_FORM); setShowForm(f => !f); }}
          className="btn-primary"
          style={{ padding: '12px 24px', background: 'var(--blue)', color: '#000', fontSize: 12 }}
        >
          <Plus size={16} /> {showForm ? 'Discard Entry' : 'Create Deployment'}
        </button>
      </div>

      {/* ── Create / Edit Form ── */}
      {showForm && (
        <form
          onSubmit={editingEvent ? handleUpdate : handleCreate}
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderLeft: '4px solid var(--blue)', borderRadius: 12, padding: 32 }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {editingEvent ? `Edit: ${editingEvent.title}` : 'Initialize Deployment'}
            </h2>
            <button type="button" onClick={cancelForm} style={{ color: 'var(--text-muted)', cursor: 'pointer' }} className="hover-white">
              <X size={20} />
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 24 }}>
            <div style={{ gridColumn: 'span 2' }}>
              <Label>Event Identity</Label>
              <input required type="text"
                placeholder="e.g. National Hackathon 2026"
                style={{ width: '100%', background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 16px', color: 'var(--text-primary)', fontWeight: 700 }}
                value={formData.title}
                onChange={e => setFormData({...formData, title: e.target.value})} />
            </div>

            <div style={{ gridColumn: 'span 2' }}>
              <Label>Description / Rules</Label>
              <textarea rows={3}
                style={{ width: '100%', background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 16px', color: 'var(--text-primary)', fontSize: 14, resize: 'none' }}
                placeholder="Detail the competition parameters..."
                value={formData.description}
                onChange={e => setFormData({...formData, description: e.target.value})} />
            </div>

            <div>
              <Label>Deployment Type</Label>
              <select style={{ width: '100%', background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 16px', color: 'var(--text-primary)', fontWeight: 700 }}
                value={formData.type}
                onChange={e => setFormData({...formData, type: e.target.value})}>
                <option value="quiz">Standard Quiz</option>
                <option value="rapid_fire">Rapid Fire</option>
                <option value="treasure_hunt">Treasure Hunt</option>
                <option value="coding_challenge">Coding Challenge</option>
              </select>
            </div>

            {!editingEvent && (
              <div>
                <Label>Question Target <span style={{ color: 'var(--text-muted)', fontWeight: 400, textTransform: 'none' }}>(Guides Selection)</span></Label>
                <input type="number" min={1} max={200}
                  style={{ width: '100%', background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 16px', color: 'var(--text-primary)', fontWeight: 700, fontMono: true }}
                  placeholder="e.g. 15"
                  value={formData.question_count}
                  onChange={e => setFormData({...formData, question_count: e.target.value})} />
              </div>
            )}

            <div>
              <Label>Personnel Capacity</Label>
              <input type="number" min={1}
                style={{ width: '100%', background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 16px', color: 'var(--text-primary)', fontWeight: 700, fontMono: true }}
                value={formData.max_participants}
                onChange={e => setFormData({...formData, max_participants: e.target.value})} />
            </div>

            <div>
              <Label>Deployment Logic</Label>
              <p style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {formData.type === 'quiz'         && 'Discontinuous — manual batch submission.'}
                {formData.type === 'rapid_fire'   && 'Continuous — high-frequency temporal judgment.'}
                {formData.type === 'treasure_hunt'&& 'Sequential — locked architectural progression.'}
                {formData.type === 'coding_challenge' && 'Compiler Verified — judging against hidden matrices.'}
              </p>
            </div>

            <div>
              <Label>Temporal Start</Label>
              <input required type="date" style={{ width: '100%', background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 16px', color: 'var(--text-primary)', fontWeight: 700 }}
                value={formData.start_at}
                onChange={e => setFormData({...formData, start_at: e.target.value})} />
            </div>

            <div>
              <Label>Temporal End <span style={{ color: 'var(--text-muted)', fontWeight: 400, textTransform: 'none' }}>(Optional)</span></Label>
              <input type="date" style={{ width: '100%', background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 16px', color: 'var(--text-primary)', fontWeight: 700 }}
                value={formData.end_at}
                onChange={e => setFormData({...formData, end_at: e.target.value})} />
            </div>

            <div style={{ gridColumn: 'span 2' }}>
              <Label>Sponsor Signature (Logo URL)</Label>
              <input type="url" style={{ width: '100%', background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 16px', color: 'var(--text-primary)', fontSize: 13 }}
                placeholder="https://signature.cdn.com/asset.png"
                value={formData.sponsor_logo_url}
                onChange={e => setFormData({...formData, sponsor_logo_url: e.target.value})} />
            </div>

            <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end', gap: 16, borderTop: '1px solid var(--border)', paddingTop: 24, marginTop: 8 }}>
              <button type="button" onClick={cancelForm} className="btn-ghost" style={{ padding: '10px 24px' }}>Discard</button>
              <button type="submit" className="btn-primary" style={{ padding: '10px 32px', background: 'var(--green)', color: '#000' }}>
                {editingEvent ? 'Commit Changes' : 'Initialize Infrastructure'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* ── Event List ── */}
      {events.length === 0 ? (
        <div style={{ padding: 128, textAlign: 'center', background: 'var(--surface)', border: '1px solid var(--border)', borderStyle: 'dashed', borderRadius: 16 }}>
          <CalendarClock size={48} style={{ color: 'var(--text-muted)', opacity: 0.2, margin: '0 auto 24px' }} />
          <p style={{ color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', fontSize: 12 }}>No deployments registered in the architecture.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 20 }}>
          {events.map((evt) => {
            const participantCount = evt.participation?.[0]?.count || 0;
            const isExpanded       = expandedEventId === evt.id;
            const assigned         = assignedQMap[evt.id] || [];
            const assignedMeta     = assignedMetaMap[evt.id] || [];
            const guided           = guidedState[evt.id];
            const isGuidedActive   = guided?.active && isExpanded;

            const unassignedQuestions = questions.filter(q => !assigned.includes(q.id));
            const guidedQuestionIndex = (guided?.currentStep ?? 1) - 1;
            const guidedQuestion = unassignedQuestions[guidedQuestionIndex] || unassignedQuestions[0] || null;

            return (
              <div key={evt.id}
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 12,
                  overflow: 'hidden',
                  transition: 'all 0.2s',
                  ...(evt.status === 'live' ? { border: '1px solid var(--green)', boxShadow: '0 12px 48px rgba(16,185,129,0.1)' } : {})
                }}
              >

                {/* Event Header Row */}
                <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
                        <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{evt.title}</h3>
                        <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 8px', borderRadius: 4, border: '1px solid currentColor', textTransform: 'uppercase', letterSpacing: '0.04em', ...parseStyle(TYPE_COLORS[evt.type]) }}>
                          {TYPE_LABELS[evt.type]}
                        </span>

                        {evt.status === 'live' && (
                          <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 8px', borderRadius: 4, background: 'rgba(16,185,129,0.1)', color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: 6 }}>
                             <Activity size={10} /> Live Phase
                          </span>
                        )}
                        {evt.status === 'upcoming' && (
                          <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 8px', borderRadius: 4, background: 'var(--elevated)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', border: '1px solid var(--border)' }}>
                            Upcoming
                          </span>
                        )}
                      </div>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: 24, fontSize: 12, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <CalendarClock size={14} /> {new Date(evt.start_at).toLocaleDateString()}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Users size={14} /> <span style={{ color: 'var(--text-secondary)', fontWeight: 700 }}>{participantCount}</span> Registered
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <ListChecks size={14} /> <span style={{ color: 'var(--text-secondary)', fontWeight: 700 }}>{assigned.length}</span> Assigned
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      {evt.status === 'upcoming' && (
                        <button onClick={() => initiateStatusChange(evt, 'live')} className="btn-primary" style={{ padding: '8px 16px', background: 'var(--green)', color: '#000', fontSize: 10 }}>
                          Authorize Live Phase
                        </button>
                      )}
                      {evt.status === 'live' && (
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={() => initiateStatusChange(evt, 'announce')} disabled={evt.results_announced} className="btn-primary" style={{ padding: '8px 16px', background: 'var(--amber)', color: '#000', fontSize: 10, opacity: evt.results_announced ? 0.5 : 1 }}>
                            Announce Winner
                          </button>
                          <button onClick={() => initiateStatusChange(evt, 'ended')} className="btn-primary" style={{ padding: '8px 16px', background: 'var(--red)', color: '#fff', fontSize: 10 }}>
                            End Session
                          </button>
                          <button onClick={() => setStatusPanelEventId(p => p === evt.id ? null : evt.id)} className="btn-ghost" style={{ padding: '8px 16px', fontSize: 10, background: statusPanelEventId === evt.id ? 'var(--blue)' : 'var(--elevated)' }}>
                             Real-time Stats
                          </button>
                        </div>
                      )}
                      
                      <button onClick={() => toggleExpand(evt.id)} className="btn-ghost" style={{ padding: '8px 16px', fontSize: 10, background: isExpanded ? 'var(--blue)' : 'var(--elevated)', color: isExpanded ? '#000' : 'var(--text-primary)' }}>
                        Question Matrix
                      </button>

                      <div style={{ display: 'flex', gap: 4, marginLeft: 8 }}>
                        <button onClick={() => openEdit(evt)} className="btn-ghost" style={{ padding: 8, minHeight: 'unset', background: 'var(--elevated)' }} title="Edit Configuration">
                          <Pencil size={14} style={{ color: 'var(--text-muted)' }} />
                        </button>
                        <button onClick={() => handleDelete(evt.id)} className="btn-ghost" style={{ padding: 8, minHeight: 'unset', background: 'var(--elevated)' }} title="Terminate Deployment">
                          <Trash2 size={14} style={{ color: 'var(--red)' }} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Status Panel Body */}
                {statusPanelEventId === evt.id && evt.status === 'live' && (
                  <div style={{ padding: 32, background: 'var(--elevated)', borderTop: '1px solid var(--border)' }}>
                     <AdminStatusPanel eventId={evt.id} totalQuestions={assigned.length} />
                  </div>
                )}

                {/* ── Inline Question Assignment Panel ── */}
                {isExpanded && evt.type !== 'coding_challenge' && (
                  <div style={{ borderTop: '1px solid var(--border)', background: 'var(--elevated)', padding: 32 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                      <h4 style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Architectural Asset Assignment
                      </h4>
                      <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        Protocol: <span style={{ color: 'var(--blue)', fontWeight: 800 }}>{TYPE_LABELS[evt.type]}</span>
                      </p>
                    </div>

                    {/* Feature 12: Guided selection mode */}
                    {isGuidedActive && (
                      <div style={{ marginBottom: 32, padding: 24, background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                          <p style={{ fontSize: 12, fontWeight: 800, color: 'var(--blue)', textTransform: 'uppercase' }}>
                            Personnel Selection Logic: Asset {guided.currentStep} / {guided.target}
                          </p>
                          <button onClick={() => exitGuidedMode(evt.id)} style={{ fontSize: 9, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', background: 'transparent', border: 'none', cursor: 'pointer' }}>Exit Logic</button>
                        </div>

                        <div style={{ display: 'flex', gap: 6, marginBottom: 24 }}>
                          {Array.from({ length: guided.target }, (_, i) => (
                            <div key={i} style={{ height: 4, flex: 1, borderRadius: 2, background: i < guided.currentStep - 1 ? 'var(--blue)' : i === guided.currentStep - 1 ? 'var(--blue)' : 'var(--surface)', opacity: i === guided.currentStep - 1 ? 0.6 : 1 }} />
                          ))}
                        </div>

                        {guidedQuestion ? (
                          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
                            <div style={{ marginBottom: 16 }}>
                              <span style={{ fontSize: 9, fontWeight: 800, color: guidedQuestion.difficulty === 'easy' ? 'var(--green)' : 'var(--red)', background: 'var(--elevated)', border: '1px solid var(--border)', padding: '2px 8px', borderRadius: 4, textTransform: 'uppercase', marginBottom: 8, display: 'inline-block' }}>{guidedQuestion.difficulty}</span>
                              <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.5 }}>{guidedQuestion.question}</p>
                            </div>
                            <div style={{ display: 'flex', gap: 12 }}>
                              <button onClick={() => guidedAddQuestion(evt.id, guidedQuestion.id)} className="btn-primary" style={{ flex: 1, padding: '10px', background: 'var(--blue)', color: '#000', fontSize: 11 }}>Authorize Asset</button>
                              <button onClick={() => guidedSkipQuestion(evt.id)} className="btn-ghost" style={{ flex: 1, padding: '10px', fontSize: 11 }}>Skip Selection</button>
                            </div>
                          </div>
                        ) : (
                          <p style={{ color: 'var(--text-muted)', fontSize: 12, textAlign: 'center' }}>Bank exhausted. No available assets matching parameters.</p>
                        )}
                      </div>
                    )}

                    {/* Matrix List */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
                       <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                         <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Assigned Assets ({assigned.length})</label>
                         <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                           {assignedMeta.map((meta, i) => {
                             const q = questions.find(q => q.id === meta.question_id);
                             if (!q) return null;
                             return (
                               <div key={meta.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--surface)', border: '1px solid var(--border)', padding: '10px 16px', borderRadius: 8 }}>
                                 <span style={{ width: 20, height: 20, borderRadius: 4, background: 'var(--elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: 'var(--text-muted)' }}>{i+1}</span>
                                 <p style={{ flex: 1, fontSize: 12, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{q.question}</p>
                                 <button onClick={() => removeQuestion(evt.id, q.id)} style={{ color: 'var(--text-muted)', cursor: 'pointer' }} className="hover-red">
                                   <X size={14} />
                                 </button>
                               </div>
                             );
                           })}
                           {assigned.length === 0 && <p style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic', padding: 12, background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--border)', textAlign: 'center' }}>Matrix unpopulated.</p>}
                         </div>
                       </div>

                       <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                         <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Global Asset Bank</label>
                         {!isGuidedActive && (
                           <div style={{ maxHeight: 320, overflowY: 'auto', paddingRight: 8 }} className="custom-scrollbar">
                             <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                               {questions.map(q => {
                                 const isAssigned = assigned.includes(q.id);
                                 return (
                                   <div key={q.id} onClick={() => toggleQuestion(evt.id, q.id)}
                                     style={{ display: 'flex', alignItems: 'center', gap: 12, background: isAssigned ? 'rgba(59,130,246,0.06)' : 'var(--surface)', border: isAssigned ? '1px solid var(--blue)' : '1px solid var(--border)', padding: '10px 16px', borderRadius: 8, cursor: 'pointer', transition: 'all 0.2s' }}>
                                     <div style={{ width: 16, height: 16, borderRadius: 4, border: '1px solid var(--border)', background: isAssigned ? 'var(--blue)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                       {isAssigned && <Check size={10} style={{ color: '#000' }} />}
                                     </div>
                                     <p style={{ flex: 1, fontSize: 12, color: isAssigned ? 'var(--text-primary)' : 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{q.question}</p>
                                     <span style={{ fontSize: 8, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{q.difficulty}</span>
                                   </div>
                                 );
                               })}
                             </div>
                           </div>
                         )}
                         {isGuidedActive && <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, borderStyle: 'dashed' }}>
                             <p style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Guided Selection Override Active</p>
                           </div>}
                       </div>
                    </div>
                  </div>
                )}

                {/* Hint for coding events */}
                {isExpanded && evt.type === 'coding_challenge' && (
                  <div style={{ borderTop: '1px solid var(--border)', background: 'var(--elevated)', padding: 48, textAlign: 'center' }}>
                    <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Algorithmic configurations are managed in the specialized Coding editor.</p>
                    <Link to="/admin/coding-problems" style={{ marginTop: 16, display: 'inline-block', fontSize: 11, fontWeight: 800, color: 'var(--blue)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Open Controller Matrix</Link>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

