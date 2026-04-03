import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useStore } from '../../store';
import {
  CalendarClock, Play, Square, Plus, Pencil,
  Trash2, X, Check, ListChecks, Users, Clock,
  ChevronDown, ChevronUp, AlertTriangle, RotateCcw
} from 'lucide-react';

const INPUT_CLS = "w-full bg-slate-900 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-blue-500 transition-colors";

const TYPE_LABELS = { quiz: 'Standard Quiz', rapid_fire: 'Rapid Fire', treasure_hunt: 'Treasure Hunt' };
const TYPE_COLORS = {
  quiz:         'bg-blue-500/20 text-blue-400 border-blue-500/30',
  rapid_fire:   'bg-orange-500/20 text-orange-400 border-orange-500/30',
  treasure_hunt:'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
};

const EMPTY_FORM = {
  title: '', description: '', type: 'quiz',
  start_at: '', end_at: '', max_participants: 100, sponsor_logo_url: ''
};

export function AdminEvents() {
  const user = useStore(state => state.user);

  const [events, setEvents]             = useState([]);
  const [questions, setQuestions]       = useState([]);
  const [loading, setLoading]           = useState(true);
  const [showForm, setShowForm]         = useState(false);
  const [editingEvent, setEditingEvent] = useState(null); // event object | null
  const [formData, setFormData]         = useState(EMPTY_FORM);

  // Per-event question assignment panel
  const [expandedEventId, setExpandedEventId]  = useState(null);
  const [assignedQMap, setAssignedQMap]        = useState({}); // { eventId: [questionId,...] }
  const [assignedMetaMap, setAssignedMetaMap]  = useState({}); // { eventId: [{ id, question_id, order_num },...] }

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
  const loadEventQuestions = async (eventId) => {
    if (assignedQMap[eventId]) return; // already cached
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

  const toggleExpand = async (eventId) => {
    if (expandedEventId === eventId) { setExpandedEventId(null); return; }
    setExpandedEventId(eventId);
    await loadEventQuestions(eventId);
  };

  // ── Create ─────────────────────────────────────────────────
  const handleCreate = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from('events')
      .insert([{ ...formData, max_participants: Number(formData.max_participants), created_by: user.id }]);
    if (error) { alert(error.message); return; }
    setShowForm(false);
    setFormData(EMPTY_FORM);
    fetchEvents();
  };

  // ── Edit / Update ──────────────────────────────────────────
  const openEdit = (evt) => {
    setEditingEvent(evt);
    setFormData({
      title:           evt.title,
      description:     evt.description || '',
      type:            evt.type,
      start_at:        evt.start_at ? evt.start_at.slice(0, 16) : '',
      end_at:          evt.end_at ? evt.end_at.slice(0, 16) : '',
      max_participants: evt.max_participants || 100,
      sponsor_logo_url: evt.sponsor_logo_url || '',
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from('events')
      .update({ ...formData, max_participants: Number(formData.max_participants) })
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

  // ── Status Control ─────────────────────────────────────────
  const setStatus = async (id, status) => {
    const updates = { status };
    if (status === 'live')  updates.start_at = new Date().toISOString();
    if (status === 'ended') updates.end_at   = new Date().toISOString();
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

  // ── Question Assignment (per event panel) ──────────────────
  const toggleQuestion = async (eventId, qId) => {
    const current = assignedQMap[eventId] || [];
    const meta    = assignedMetaMap[eventId] || [];

    if (current.includes(qId)) {
      // Remove
      await supabase.from('event_questions')
        .delete().match({ event_id: eventId, question_id: qId });
      setAssignedQMap(m => ({ ...m, [eventId]: current.filter(id => id !== qId) }));
      setAssignedMetaMap(m => ({ ...m, [eventId]: meta.filter(r => r.question_id !== qId) }));
    } else {
      // Add
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

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="w-10 h-10 border-4 border-slate-800 border-t-blue-500 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-3xl font-black text-white uppercase tracking-widest">Event Master</h1>
          <p className="text-slate-400 mt-1 text-sm">Create, edit, manage lifecycle & assign questions to events.</p>
        </div>
        <button
          onClick={() => { setEditingEvent(null); setFormData(EMPTY_FORM); setShowForm(f => !f); }}
          className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl font-black uppercase tracking-widest text-sm flex items-center gap-2 transition-all shadow-[0_0_15px_rgba(37,99,235,0.3)]">
          <Plus className="w-4 h-4" /> Create Event
        </button>
      </div>

      {/* ── Create / Edit Form ── */}
      {showForm && (
        <form
          onSubmit={editingEvent ? handleUpdate : handleCreate}
          className="glass-card p-6 mb-8 border-l-4 border-l-blue-500">
          <div className="flex justify-between items-center mb-5">
            <h2 className="font-black text-white text-lg">
              {editingEvent ? `✏️ Editing: ${editingEvent.title}` : '➕ New Event'}
            </h2>
            <button type="button" onClick={cancelForm} className="text-slate-500 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Label>Event Title</Label>
              <input required type="text"
                className={INPUT_CLS}
                value={formData.title}
                onChange={e => setFormData({...formData, title: e.target.value})} />
            </div>

            <div className="md:col-span-2">
              <Label>Description</Label>
              <textarea rows={3}
                className="Input resize-none"
                value={formData.description}
                onChange={e => setFormData({...formData, description: e.target.value})} />
            </div>

            <div>
              <Label>Event Type</Label>
              <select className={INPUT_CLS}
                value={formData.type}
                onChange={e => setFormData({...formData, type: e.target.value})}>
                <option value="quiz">Standard Quiz</option>
                <option value="rapid_fire">Rapid Fire</option>
                <option value="treasure_hunt">Treasure Hunt</option>
              </select>
              <p className="text-xs text-slate-600 mt-1">
                {formData.type === 'quiz'         && 'All questions shown at once, submit when ready.'}
                {formData.type === 'rapid_fire'   && 'One question at a time with countdown timer per question.'}
                {formData.type === 'treasure_hunt'&& 'Sequential — must answer correctly to unlock the next.'}
              </p>
            </div>

            <div>
              <Label>Max Participants</Label>
              <input type="number" min={1}
                className={INPUT_CLS}
                value={formData.max_participants}
                onChange={e => setFormData({...formData, max_participants: e.target.value})} />
            </div>

            <div>
              <Label>Scheduled Start</Label>
              <input required type="datetime-local" className={INPUT_CLS}
                value={formData.start_at}
                onChange={e => setFormData({...formData, start_at: e.target.value})} />
            </div>

            <div>
              <Label>Hard Cutoff / End Time</Label>
              <input required type="datetime-local" className={INPUT_CLS}
                value={formData.end_at}
                onChange={e => setFormData({...formData, end_at: e.target.value})} />
            </div>

            <div className="md:col-span-2">
              <Label>Sponsor Logo URL (optional)</Label>
              <input type="url" className={INPUT_CLS}
                placeholder="https://..."
                value={formData.sponsor_logo_url}
                onChange={e => setFormData({...formData, sponsor_logo_url: e.target.value})} />
            </div>

            <div className="md:col-span-2 flex justify-end gap-3 border-t border-white/5 pt-4 mt-2">
              <button type="button" onClick={cancelForm}
                className="px-5 py-2 text-slate-400 hover:text-white font-bold transition-colors">Cancel</button>
              <button type="submit"
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-2.5 rounded-xl font-black uppercase tracking-widest text-sm transition-all">
                {editingEvent ? '💾 Save Changes' : '🚀 Deploy Event'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* ── Event List ── */}
      {events.length === 0 ? (
        <div className="glass-card p-16 text-center text-slate-500">
          No events yet. Click "Create Event" to deploy your first competition.
        </div>
      ) : (
        <div className="space-y-4">
          {events.map((evt) => {
            const participantCount = evt.participation?.[0]?.count || 0;
            const isExpanded       = expandedEventId === evt.id;
            const assigned         = assignedQMap[evt.id] || [];
            const assignedMeta     = assignedMetaMap[evt.id] || [];

            return (
              <div key={evt.id}
                className={`border rounded-2xl overflow-hidden transition-all
                  ${evt.status === 'live'
                    ? 'border-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.08)]'
                    : evt.status === 'ended'
                    ? 'border-slate-800'
                    : 'border-white/8 hover:border-slate-700'}`}>

                {/* Event Header Row */}
                <div className="bg-slate-900/60 p-5 flex flex-col xl:flex-row gap-4 items-start xl:items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap mb-2">
                      <h3 className="text-xl font-black text-white">{evt.title}</h3>

                      <span className={`text-[10px] px-2.5 py-1 rounded-full border font-black uppercase tracking-widest ${TYPE_COLORS[evt.type]}`}>
                        {TYPE_LABELS[evt.type]}
                      </span>

                      {evt.status === 'live' && (
                        <span className="bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest animate-pulse flex items-center gap-1">
                          <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" /> Live
                        </span>
                      )}
                      {evt.status === 'upcoming' && (
                        <span className="bg-blue-500/20 border border-blue-500/30 text-blue-400 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest">
                          Upcoming
                        </span>
                      )}
                      {evt.status === 'ended' && (
                        <span className="bg-slate-700/50 border border-slate-700 text-slate-400 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest">
                          Ended
                        </span>
                      )}
                    </div>

                    {evt.description && (
                      <p className="text-slate-400 text-sm line-clamp-1 mb-3">{evt.description}</p>
                    )}

                    <div className="flex items-center gap-5 text-xs text-slate-500 font-mono flex-wrap">
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3 h-3" />
                        {new Date(evt.start_at).toLocaleString()} → {new Date(evt.end_at).toLocaleString()}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Users className="w-3 h-3" />
                        {participantCount} / {evt.max_participants || '∞'} participants
                      </span>
                      <span className="flex items-center gap-1.5">
                        <ListChecks className="w-3 h-3" />
                        {isExpanded ? (assigned.length) : '?'} questions
                      </span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 flex-wrap shrink-0">
                    {/* Lifecycle */}
                    {evt.status === 'upcoming' && (
                      <button onClick={() => setStatus(evt.id, 'live')}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase text-xs tracking-widest rounded-lg flex items-center gap-2 shadow-[0_0_12px_rgba(16,185,129,0.3)] transition-all">
                        <Play className="w-3.5 h-3.5" /> Go Live
                      </button>
                    )}
                    {evt.status === 'live' && (
                      <button onClick={() => setStatus(evt.id, 'ended')}
                        className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-black uppercase text-xs tracking-widest rounded-lg flex items-center gap-2 shadow-[0_0_12px_rgba(220,38,38,0.3)] transition-all">
                        <Square className="w-3.5 h-3.5 fill-white" /> End Event
                      </button>
                    )}
                    <button onClick={() => setStatus(evt.id, 'upcoming')} title="Reset to Upcoming"
                      className="p-2 text-slate-500 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-all border border-transparent hover:border-amber-500/20">
                      <RotateCcw className="w-4 h-4" />
                    </button>

                    {/* Questions Toggle */}
                    <button onClick={() => toggleExpand(evt.id)}
                      className={`px-3 py-2 rounded-lg text-xs font-black uppercase tracking-widest border flex items-center gap-2 transition-all
                        ${isExpanded ? 'bg-purple-600 text-white border-purple-500' : 'text-slate-400 border-slate-700 hover:border-purple-500 hover:text-purple-400'}`}>
                      <ListChecks className="w-4 h-4" />
                      Questions
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>

                    {/* Edit */}
                    <button onClick={() => openEdit(evt)}
                      className="p-2 text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg border border-transparent hover:border-blue-500/20 transition-all">
                      <Pencil className="w-4 h-4" />
                    </button>

                    {/* Delete */}
                    <button onClick={() => handleDelete(evt.id)}
                      className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg border border-transparent hover:border-red-500/20 transition-all">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* ── Inline Question Assignment Panel ── */}
                {isExpanded && (
                  <div className="border-t border-white/5 bg-slate-950/40 p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-sm font-black text-purple-400 uppercase tracking-widest flex items-center gap-2">
                        <ListChecks className="w-4 h-4" />
                        Questions for "{evt.title}"
                        <span className="text-white bg-purple-600 px-2.5 py-0.5 rounded-full text-xs">{assigned.length}</span>
                      </h4>
                      <p className="text-xs text-slate-600">
                        Mode: <span className="text-slate-400 font-bold">{TYPE_LABELS[evt.type]}</span>
                      </p>
                    </div>

                    {/* Assigned list */}
                    {assigned.length > 0 && (
                      <div className="mb-4 space-y-2">
                        {assignedMeta.map((meta, i) => {
                          const q = questions.find(q => q.id === meta.question_id);
                          if (!q) return null;
                          return (
                            <div key={meta.id} className="flex items-center gap-3 bg-purple-900/10 border border-purple-500/20 rounded-lg px-4 py-2.5">
                              <span className="w-6 h-6 shrink-0 bg-purple-600 text-white text-xs font-black rounded flex items-center justify-center">{i+1}</span>
                              <span className={`text-[10px] border px-1.5 py-0.5 rounded font-bold uppercase ${
                                q.difficulty === 'easy' ? 'text-emerald-400 border-emerald-500/30' :
                                q.difficulty === 'hard' ? 'text-red-400 border-red-500/30' :
                                'text-amber-400 border-amber-500/30'}`}>
                                {q.difficulty}
                              </span>
                              <p className="text-sm text-white flex-1 truncate">{q.question}</p>
                              <button onClick={() => removeQuestion(evt.id, q.id)}
                                className="text-slate-500 hover:text-red-400 transition-colors" title="Remove">
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* All questions selector */}
                    <div className="max-h-64 overflow-y-auto custom-scrollbar space-y-2 border border-white/5 rounded-xl p-3 bg-slate-900/30">
                      {questions.length === 0 && (
                        <p className="text-center text-slate-500 py-6 text-sm">
                          No questions in bank. Go to the Questions page first to add some.
                        </p>
                      )}
                      {questions.map(q => {
                        const isAssigned = assigned.includes(q.id);
                        return (
                          <div key={q.id} onClick={() => toggleQuestion(evt.id, q.id)}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all border
                              ${isAssigned
                                ? 'bg-purple-900/20 border-purple-500/40'
                                : 'bg-slate-900 border-transparent hover:border-slate-700'}`}>
                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0
                              ${isAssigned ? 'bg-purple-500 border-purple-400' : 'border-slate-600'}`}>
                              {isAssigned && <Check className="w-3 h-3 text-white" />}
                            </div>
                            <span className={`text-[10px] border px-1.5 py-0.5 rounded font-bold uppercase shrink-0 ${
                              q.difficulty === 'easy' ? 'text-emerald-400 border-emerald-500/30' :
                              q.difficulty === 'hard' ? 'text-red-400 border-red-500/30' :
                              'text-amber-400 border-amber-500/30'}`}>
                              {q.difficulty}
                            </span>
                            <p className={`text-sm flex-1 truncate font-medium ${isAssigned ? 'text-white' : 'text-slate-400'}`}>
                              {q.question}
                            </p>
                          </div>
                        );
                      })}
                    </div>

                    {assigned.length === 0 && (
                      <div className="flex items-center gap-2 mt-3 text-amber-400 text-xs font-bold bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-2">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        No questions assigned — participants will see an empty quiz!
                      </div>
                    )}
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

// ── Tiny helpers ──────────────────────────────────────────
const Label = ({ children }) => (
  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">{children}</label>
);
