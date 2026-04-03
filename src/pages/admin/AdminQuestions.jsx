import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useStore } from '../../store';
import Papa from 'papaparse';
import {
  Upload, Plus, Database, Check, ListChecks, Pencil, Trash2,
  X, ChevronDown, ChevronUp, Eye, Save, Search, Filter
} from 'lucide-react';

const DIFFICULTY_COLORS = {
  easy:   'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  medium: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  hard:   'bg-red-500/20 text-red-400 border-red-500/30',
};

const EMPTY_FORM = {
  question: '', optA: '', optB: '', optC: '', optD: '',
  correct: 'A', difficulty: 'medium', explanation: ''
};

export function AdminQuestions() {
  const user = useStore(state => state.user);

  const [questions, setQuestions]         = useState([]);
  const [events, setEvents]               = useState([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [eventQuestions, setEventQuestions]   = useState([]);   // array of question_ids
  const [eventQMeta, setEventQMeta]       = useState([]);   // full records with order_num
  const [tab, setTab]                     = useState('bank');
  const [search, setSearch]               = useState('');
  const [filterDiff, setFilterDiff]       = useState('all');

  // Edit / View modal
  const [editing, setEditing]             = useState(null);   // question object | null
  const [viewing, setViewing]             = useState(null);   // question object | null
  const [editForm, setEditForm]           = useState(EMPTY_FORM);

  // Create form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData]           = useState(EMPTY_FORM);

  const fileInputRef = useRef(null);

  // ── Data Fetching ──────────────────────────────────────────
  const fetchData = useCallback(async () => {
    const [{ data: qData }, { data: eData }] = await Promise.all([
      supabase.from('question_bank').select('*').order('created_at', { ascending: false }),
      supabase.from('events').select('id, title, type, status').order('created_at', { ascending: false })
    ]);
    if (qData) setQuestions(qData);
    if (eData) setEvents(eData);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (!selectedEventId) { setEventQuestions([]); setEventQMeta([]); return; }
    supabase
      .from('event_questions')
      .select('id, question_id, order_num')
      .eq('event_id', selectedEventId)
      .order('order_num', { ascending: true })
      .then(({ data }) => {
        if (data) {
          setEventQMeta(data);
          setEventQuestions(data.map(d => d.question_id));
        }
      });
  }, [selectedEventId]);

  // ── Filtered Questions ─────────────────────────────────────
  const filtered = questions.filter(q => {
    const matchSearch = q.question.toLowerCase().includes(search.toLowerCase());
    const matchDiff   = filterDiff === 'all' || q.difficulty === filterDiff;
    return matchSearch && matchDiff;
  });

  // ── Create ─────────────────────────────────────────────────
  const handleCreate = async (e) => {
    e.preventDefault();
    const options = [formData.optA, formData.optB, formData.optC, formData.optD];
    const correctValue = options[['A','B','C','D'].indexOf(formData.correct)];
    const { error } = await supabase.from('question_bank').insert([{
      question:      formData.question,
      options,
      correct_answer: correctValue,
      difficulty:    formData.difficulty,
      explanation:   formData.explanation,
      created_by:    user.id
    }]);
    if (!error) {
      setFormData(EMPTY_FORM);
      setShowCreateForm(false);
      fetchData();
    } else alert(error.message);
  };

  // ── Edit ───────────────────────────────────────────────────
  const openEdit = (q) => {
    setEditing(q);
    setEditForm({
      question:    q.question,
      optA:        q.options[0] || '',
      optB:        q.options[1] || '',
      optC:        q.options[2] || '',
      optD:        q.options[3] || '',
      correct:     ['A','B','C','D'][q.options.indexOf(q.correct_answer)] || 'A',
      difficulty:  q.difficulty,
      explanation: q.explanation || ''
    });
  };

  const handleEditSave = async (e) => {
    e.preventDefault();
    const options      = [editForm.optA, editForm.optB, editForm.optC, editForm.optD];
    const correctValue = options[['A','B','C','D'].indexOf(editForm.correct)];
    const { error } = await supabase.from('question_bank').update({
      question:      editForm.question,
      options,
      correct_answer: correctValue,
      difficulty:    editForm.difficulty,
      explanation:   editForm.explanation,
    }).eq('id', editing.id);
    if (!error) { setEditing(null); fetchData(); }
    else alert(error.message);
  };

  // ── Delete ─────────────────────────────────────────────────
  const handleDelete = async (qId) => {
    if (!confirm('Delete this question from the global bank? It will also be removed from all events.')) return;
    await supabase.from('question_bank').delete().eq('id', qId);
    fetchData();
  };

  // ── Assign / Unassign to Event ─────────────────────────────
  const toggleEventQuestion = async (qId) => {
    if (!selectedEventId) return;
    if (eventQuestions.includes(qId)) {
      await supabase.from('event_questions').delete()
        .match({ event_id: selectedEventId, question_id: qId });
      setEventQuestions(prev => prev.filter(id => id !== qId));
      setEventQMeta(prev => prev.filter(r => r.question_id !== qId));
    } else {
      const nextOrder = eventQuestions.length + 1;
      const { data } = await supabase.from('event_questions')
        .insert([{ event_id: selectedEventId, question_id: qId, order_num: nextOrder }])
        .select();
      if (data) {
        setEventQuestions(prev => [...prev, qId]);
        setEventQMeta(prev => [...prev, data[0]]);
      }
    }
  };

  // ── CSV Upload ─────────────────────────────────────────────
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: async (results) => {
        const payload = results.data.map(row => {
          const options    = [row.option_a, row.option_b, row.option_c, row.option_d];
          const correctKey = row.correct?.toUpperCase();
          const idx        = ['A','B','C','D'].indexOf(correctKey);
          return {
            question:      row.question,
            options,
            correct_answer: idx >= 0 ? options[idx] : options[0],
            difficulty:    row.difficulty || 'medium',
            explanation:   row.explanation || '',
            created_by:    user.id
          };
        });
        const { error } = await supabase.from('question_bank').insert(payload);
        if (error) alert(error.message);
        else { alert(`✅ Imported ${payload.length} questions!`); fetchData(); }
      }
    });
    e.target.value = '';
  };

  // ── Question Form Fields ───────────────────────────────────
  const QuestionFields = ({ fd, setFd, submitLabel, onSubmit }) => (
    <form onSubmit={onSubmit} className="space-y-3">
      <textarea required placeholder="Question text..." rows={3}
        className="w-full bg-slate-900 border border-white/10 rounded-lg p-3 text-sm text-white resize-none focus:outline-none focus:border-blue-500"
        value={fd.question} onChange={e => setFd({...fd, question: e.target.value})} />

      <div className="grid grid-cols-2 gap-2">
        {['A','B','C','D'].map(letter => (
          <div key={letter} className="relative">
            <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-xs font-black w-5 h-5 rounded flex items-center justify-center
              ${fd.correct === letter ? 'bg-emerald-500 text-white' : 'bg-slate-700 text-slate-400'}`}>
              {letter}
            </span>
            <input required placeholder={`Option ${letter}`}
              className="w-full bg-slate-900 border border-white/10 rounded-lg pl-10 py-2.5 pr-3 text-sm text-white focus:outline-none focus:border-blue-500"
              value={fd[`opt${letter}`]}
              onChange={e => setFd({...fd, [`opt${letter}`]: e.target.value})}
            />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Correct Answer</label>
          <select className="w-full bg-slate-900 border border-white/10 rounded-lg p-2.5 text-white text-sm"
            value={fd.correct} onChange={e => setFd({...fd, correct: e.target.value})}>
            <option value="A">A</option><option value="B">B</option>
            <option value="C">C</option><option value="D">D</option>
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Difficulty</label>
          <select className="w-full bg-slate-900 border border-white/10 rounded-lg p-2.5 text-white text-sm"
            value={fd.difficulty} onChange={e => setFd({...fd, difficulty: e.target.value})}>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </div>
      </div>

      <input placeholder="Explanation / hint (optional)"
        className="w-full bg-slate-900 border border-white/10 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
        value={fd.explanation} onChange={e => setFd({...fd, explanation: e.target.value})} />

      <button type="submit"
        className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-black uppercase text-sm tracking-widest rounded-lg transition-all">
        <Save className="w-4 h-4 inline mr-2" />{submitLabel}
      </button>
    </form>
  );

  const selectedEvent = events.find(e => e.id === selectedEventId);

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto">
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-3xl font-black text-white uppercase tracking-widest mb-1">Question Central</h1>
          <p className="text-slate-400 text-sm">Build, edit, delete questions — then assign them to events.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-3 border-b border-white/10 mb-8 pb-4">
        <button onClick={() => setTab('bank')}
          className={`font-bold px-5 py-2 rounded-xl transition-all flex items-center gap-2 text-sm
            ${tab === 'bank' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}>
          <Database className="w-4 h-4" /> Question Bank ({questions.length})
        </button>
        <button onClick={() => setTab('assign')}
          className={`font-bold px-5 py-2 rounded-xl transition-all flex items-center gap-2 text-sm
            ${tab === 'assign' ? 'bg-purple-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}>
          <ListChecks className="w-4 h-4" /> Assign to Event
        </button>
      </div>

      {/* ── BANK TAB ── */}
      {tab === 'bank' && (
        <div className="space-y-6">

          {/* Toolbar */}
          <div className="flex flex-col md:flex-row gap-3 items-start md:items-center justify-between">
            <div className="flex gap-3 flex-1 flex-wrap">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input placeholder="Search questions..."
                  className="w-full bg-slate-900 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <div className="relative">
                <Filter className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <select className="bg-slate-900 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:outline-none"
                  value={filterDiff} onChange={e => setFilterDiff(e.target.value)}>
                  <option value="all">All Difficulty</option>
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => fileInputRef.current.click()}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-black rounded-lg uppercase tracking-widest transition-all">
                <Upload className="w-4 h-4" /> CSV Import
              </button>
              <input type="file" accept=".csv" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
              <button onClick={() => setShowCreateForm(f => !f)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-black rounded-lg uppercase tracking-widest transition-all">
                <Plus className="w-4 h-4" /> Add Question
              </button>
            </div>
          </div>

          {/* Create Form */}
          {showCreateForm && (
            <div className="glass-card p-6 border-l-4 border-l-blue-500">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-black text-white flex items-center gap-2"><Plus className="w-4 h-4" /> New Question</h3>
                <button onClick={() => setShowCreateForm(false)} className="text-slate-500 hover:text-white"><X className="w-5 h-5" /></button>
              </div>
              <QuestionFields fd={formData} setFd={setFormData} submitLabel="Add to Bank" onSubmit={handleCreate} />
            </div>
          )}

          {/* CSV format hint */}
          <p className="text-xs text-slate-600 font-mono">
            CSV columns: question, option_a, option_b, option_c, option_d, correct (A/B/C/D), difficulty (easy/medium/hard), explanation
          </p>

          {/* Question List */}
          <div className="space-y-3">
            {filtered.length === 0 && (
              <div className="glass-card p-12 text-center text-slate-500">
                {search || filterDiff !== 'all' ? 'No questions match your filter.' : 'No questions yet — add one above or import a CSV.'}
              </div>
            )}
            {filtered.map((q, idx) => (
              <QuestionCard key={q.id} q={q} idx={idx}
                onEdit={() => openEdit(q)}
                onView={() => setViewing(q)}
                onDelete={() => handleDelete(q.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── ASSIGN TAB ── */}
      {tab === 'assign' && (
        <div className="max-w-4xl space-y-6">
          <div className="glass-card p-5 border-l-4 border-l-purple-500">
            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Select Event</label>
            <select className="w-full bg-slate-900 border border-white/10 rounded-lg p-3 text-white font-bold"
              value={selectedEventId} onChange={e => setSelectedEventId(e.target.value)}>
              <option value="">-- Pick an event --</option>
              {events.map(e => (
                <option key={e.id} value={e.id}>{e.title} [{e.type.replace('_',' ')}] — {e.status}</option>
              ))}
            </select>
            {selectedEvent && (
              <p className="text-xs text-purple-400 font-bold mt-2 uppercase tracking-widest">
                Mode: {selectedEvent.type.replace('_', ' ')}  •  {eventQuestions.length} questions assigned
              </p>
            )}
          </div>

          {selectedEventId && (
            <>
              {/* Assigned Summary */}
              {eventQuestions.length > 0 && (
                <div className="glass-card p-4 border border-purple-500/20 bg-purple-900/5">
                  <h3 className="text-xs font-black text-purple-400 uppercase tracking-widest mb-3">
                    Assigned Questions ({eventQuestions.length}) — drag order coming soon
                  </h3>
                  <div className="space-y-2">
                    {eventQMeta.map((meta, i) => {
                      const q = questions.find(q => q.id === meta.question_id);
                      if (!q) return null;
                      return (
                        <div key={meta.id} className="flex items-center gap-3 bg-slate-900 rounded-lg px-4 py-2.5 border border-purple-500/20">
                          <span className="w-6 h-6 shrink-0 bg-purple-600 text-white text-xs font-black rounded flex items-center justify-center">{i+1}</span>
                          <p className="text-sm text-white flex-1 truncate">{q.question}</p>
                          <button onClick={() => toggleEventQuestion(q.id)}
                            className="text-slate-500 hover:text-red-400 transition-colors ml-2" title="Remove from event">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* All Questions Selector */}
              <div>
                <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                  All Bank Questions
                  <span className="text-slate-700">— click to assign / unassign</span>
                </h3>
                {/* search within assign */}
                <div className="relative mb-3">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input placeholder="Filter questions..."
                    className="w-full bg-slate-900 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
                    value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <div className="space-y-2">
                  {filtered.map(q => {
                    const assigned = eventQuestions.includes(q.id);
                    return (
                      <div key={q.id}
                        onClick={() => toggleEventQuestion(q.id)}
                        className={`p-4 rounded-xl border flex items-center justify-between cursor-pointer transition-all
                          ${assigned
                            ? 'bg-purple-900/20 border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.15)]'
                            : 'bg-slate-900/50 border-white/5 hover:border-slate-600'}`}>
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <span className={`text-[10px] px-2 py-0.5 rounded border font-black uppercase ${DIFFICULTY_COLORS[q.difficulty]}`}>
                            {q.difficulty}
                          </span>
                          <p className={`text-sm font-bold truncate ${assigned ? 'text-white' : 'text-slate-400'}`}>{q.question}</p>
                        </div>
                        <div className={`w-6 h-6 shrink-0 rounded-full border-2 flex items-center justify-center ml-4
                          ${assigned ? 'bg-purple-500 border-purple-400 text-white' : 'border-slate-700'}`}>
                          {assigned && <Check className="w-3.5 h-3.5" />}
                        </div>
                      </div>
                    );
                  })}
                  {filtered.length === 0 && (
                    <div className="text-center p-8 text-slate-500 border border-dashed border-slate-800 rounded-xl">
                      No questions in bank yet. Add some in the Question Bank tab.
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Edit Modal ── */}
      {editing && (
        <Modal title={`Edit Question`} onClose={() => setEditing(null)} wide>
          <QuestionFields fd={editForm} setFd={setEditForm} submitLabel="Save Changes" onSubmit={handleEditSave} />
        </Modal>
      )}

      {/* ── View Modal ── */}
      {viewing && (
        <Modal title="Question Detail" onClose={() => setViewing(null)}>
          <div className="space-y-4">
            <p className="text-white font-bold text-lg leading-relaxed">{viewing.question}</p>
            <div className="grid grid-cols-2 gap-2">
              {viewing.options.map((opt, i) => (
                <div key={i} className={`p-3 rounded-lg border text-sm font-medium flex items-center gap-2
                  ${opt === viewing.correct_answer ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300' : 'bg-slate-900 border-slate-700 text-slate-400'}`}>
                  <span className={`w-5 h-5 rounded text-xs font-black flex items-center justify-center shrink-0
                    ${opt === viewing.correct_answer ? 'bg-emerald-500 text-white' : 'bg-slate-700 text-slate-400'}`}>
                    {['A','B','C','D'][i]}
                  </span>
                  {opt}
                  {opt === viewing.correct_answer && <Check className="w-4 h-4 ml-auto text-emerald-400" />}
                </div>
              ))}
            </div>
            {viewing.explanation && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                <p className="text-xs font-black text-amber-400 uppercase tracking-widest mb-1">Explanation</p>
                <p className="text-amber-200/80 text-sm">{viewing.explanation}</p>
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <span className={`text-xs px-3 py-1 rounded-full border font-black uppercase ${DIFFICULTY_COLORS[viewing.difficulty]}`}>
                {viewing.difficulty}
              </span>
            </div>
            <div className="flex gap-3 pt-2 border-t border-white/5">
              <button onClick={() => { setViewing(null); openEdit(viewing); }}
                className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg flex items-center justify-center gap-2 text-sm">
                <Pencil className="w-4 h-4" /> Edit This Question
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Question Card ──────────────────────────────────────────
function QuestionCard({ q, idx, onEdit, onView, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="bg-slate-900/60 border border-white/5 rounded-xl overflow-hidden hover:border-slate-700 transition-all group">
      <div className="p-4 flex items-start gap-4">
        <span className="shrink-0 w-7 h-7 bg-slate-800 text-slate-400 text-xs font-black rounded flex items-center justify-center mt-0.5">
          {idx + 1}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-sm leading-relaxed line-clamp-2 group-hover:line-clamp-none transition-all">
            {q.question}
          </p>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className={`text-[10px] px-2 py-0.5 rounded border font-black uppercase ${DIFFICULTY_COLORS[q.difficulty]}`}>
              {q.difficulty}
            </span>
            <span className="text-[10px] text-slate-600 font-mono">{q.options.length} options</span>
            {q.explanation && <span className="text-[10px] text-amber-600 font-bold">Has hint</span>}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={onView} title="View"
            className="p-1.5 text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 rounded transition-all">
            <Eye className="w-4 h-4" />
          </button>
          <button onClick={onEdit} title="Edit"
            className="p-1.5 text-slate-500 hover:text-amber-400 hover:bg-amber-500/10 rounded transition-all">
            <Pencil className="w-4 h-4" />
          </button>
          <button onClick={onDelete} title="Delete"
            className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-all">
            <Trash2 className="w-4 h-4" />
          </button>
          <button onClick={() => setExpanded(f => !f)} title="Toggle options"
            className="p-1.5 text-slate-500 hover:text-white hover:bg-slate-700 rounded transition-all">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>
      {expanded && (
        <div className="border-t border-white/5 px-4 pb-4 pt-3 grid grid-cols-2 gap-2 bg-slate-950/30">
          {q.options.map((opt, i) => (
            <div key={i} className={`flex items-center gap-2 p-2 rounded-lg text-sm border
              ${opt === q.correct_answer ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-slate-900 border-slate-800 text-slate-400'}`}>
              <span className={`w-5 h-5 rounded text-xs font-black flex items-center justify-center shrink-0
                ${opt === q.correct_answer ? 'bg-emerald-500 text-white' : 'bg-slate-700 text-slate-500'}`}>
                {['A','B','C','D'][i]}
              </span>
              {opt}
              {opt === q.correct_answer && <Check className="w-3.5 h-3.5 text-emerald-400 ml-auto" />}
            </div>
          ))}
          {q.explanation && (
            <div className="col-span-2 mt-1 bg-amber-500/10 border border-amber-500/20 rounded-lg p-2 text-xs text-amber-200/80">
              <span className="font-black text-amber-400 uppercase tracking-widest mr-2">Hint:</span>{q.explanation}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Reusable Modal ────────────────────────────────────────
function Modal({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className={`bg-slate-900 border border-white/10 rounded-2xl shadow-2xl w-full overflow-y-auto max-h-[90vh]
          ${wide ? 'max-w-2xl' : 'max-w-lg'}`}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-white/5">
          <h2 className="font-black text-white text-lg">{title}</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
