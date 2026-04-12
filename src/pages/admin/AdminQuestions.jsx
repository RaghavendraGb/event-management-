import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useStore } from '../../store';
import Papa from 'papaparse';
import {
  Upload, Plus, Database, Check, ListChecks, Pencil, Trash2,
  X, ChevronDown, ChevronUp, Eye, Save, Search, Filter, CheckCircle2
} from 'lucide-react';

const DIFFICULTY_COLORS = {
  easy:   'color: var(--green); border-color: rgba(16,185,129,0.2); background: rgba(16,185,129,0.05);',
  medium: 'color: var(--amber); border-color: rgba(245,158,11,0.2); background: rgba(245,158,11,0.05);',
  hard:   'color: var(--red);   border-color: rgba(239,68,68,0.2);   background: rgba(239,68,68,0.05);',
};

const MODE_OPTIONS = [
  { key: 'global', label: 'Global (All Events)' },
  { key: 'quiz_normal', label: 'Quiz - Normal' },
  { key: 'quiz_competitive', label: 'Quiz - Competitive' },
  { key: 'youandme', label: 'You & Me' },
  { key: 'treasure_hunt', label: 'Treasure Hunt' },
  { key: 'rapid_fire_traditional', label: 'Rapid Fire - Traditional' },
  { key: 'rapid_fire_knockout', label: 'Rapid Fire - Knockout' },
];

function normalizeModeTags(tags) {
  if (!Array.isArray(tags) || tags.length === 0) return ['global'];
  const clean = [...new Set(tags.map(t => String(t || '').trim().toLowerCase()).filter(Boolean))];
  return clean.length > 0 ? clean : ['global'];
}

function getEventModeKey(event) {
  if (!event) return 'global';
  if (event.type === 'quiz') return event.quiz_mode === 'competitive' ? 'quiz_competitive' : 'quiz_normal';
  if (event.type === 'rapid_fire') return event.rapid_fire_style === 'knockout_tournament' ? 'rapid_fire_knockout' : 'rapid_fire_traditional';
  if (event.type === 'youandme') return 'youandme';
  if (event.type === 'treasure_hunt') return 'treasure_hunt';
  return 'global';
}

function modeLabel(modeKey) {
  return MODE_OPTIONS.find(m => m.key === modeKey)?.label || modeKey;
}

function resolveModeTags(rawTags, fallbackModeKey = '') {
  const normalized = normalizeModeTags(rawTags);
  if (fallbackModeKey && fallbackModeKey !== 'global' && normalized.length === 1 && normalized[0] === 'global') {
    return [fallbackModeKey];
  }
  return normalized;
}

const EMPTY_FORM = {
  question: '', optA: '', optB: '', optC: '', optD: '',
  correct: 'A', difficulty: 'medium', explanation: '',
  question_type: 'mcq',
  mode_tags: ['global'],
  wokwi_url: '',
  sim_instructions: '',
  sim_expected_output: '',
  sim_marks: 10,
};

function Label({ children }) {
  return (
    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
      {children}
    </label>
  );
}

function QuestionFields({ fd, setFd, submitLabel, onSubmit }) {
  const tags = normalizeModeTags(fd.mode_tags);
  const toggleTag = (tag) => {
    const set = new Set(tags);
    if (tag === 'global') {
      setFd({ ...fd, mode_tags: ['global'] });
      return;
    }
    set.delete('global');
    if (set.has(tag)) set.delete(tag);
    else set.add(tag);
    const next = [...set];
    setFd({ ...fd, mode_tags: next.length > 0 ? next : ['global'] });
  };

  return (
    <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button"
          onClick={() => setFd({ ...fd, question_type: 'mcq' })}
          className="btn-ghost"
          style={{
            flex: 1,
            fontSize: 11,
            background: fd.question_type !== 'simulation' ? 'var(--blue)' : 'var(--elevated)',
            color: fd.question_type !== 'simulation' ? '#fff' : 'var(--text-muted)'
          }}>
          MCQ Question
        </button>
        <button type="button"
          onClick={() => setFd({ ...fd, question_type: 'simulation' })}
          className="btn-ghost"
          style={{
            flex: 1,
            fontSize: 11,
            background: fd.question_type === 'simulation' ? 'var(--blue)' : 'var(--elevated)',
            color: fd.question_type === 'simulation' ? '#fff' : 'var(--text-muted)'
          }}>
          Simulation (Wokwi)
        </button>
      </div>

      <div>
        <Label>{fd.question_type === 'simulation' ? "Simulation Title" : "Question Text"}</Label>
        <textarea required rows={3}
          style={{ width: '100%', background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: 12, color: 'var(--text-primary)', fontSize: 14, resize: 'none' }}
          value={fd.question} onChange={e => setFd({...fd, question: e.target.value})} />
      </div>

      <div>
        <Label>Question Scope Blocks</Label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
          {MODE_OPTIONS.map((mode) => {
            const active = tags.includes(mode.key);
            return (
              <button
                key={mode.key}
                type="button"
                onClick={() => toggleTag(mode.key)}
                className="btn-ghost"
                style={{
                  justifyContent: 'flex-start',
                  padding: '8px 10px',
                  minHeight: 'unset',
                  fontSize: 11,
                  borderColor: active ? 'var(--blue)' : 'var(--border)',
                  background: active ? 'rgba(37,99,235,0.08)' : 'var(--elevated)',
                  color: active ? 'var(--text-primary)' : 'var(--text-muted)'
                }}
              >
                {active ? <Check size={12} /> : <span style={{ width: 12, height: 12, borderRadius: 3, border: '1px solid var(--border)', display: 'inline-block' }} />}
                {mode.label}
              </button>
            );
          })}
        </div>
      </div>

      {fd.question_type !== 'simulation' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {['A','B','C','D'].map(letter => (
              <div key={letter}>
                <Label>Option {letter}</Label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 10, fontWeight: 900, color: fd.correct === letter ? 'var(--blue)' : 'var(--text-muted)' }}>{letter}</span>
                  <input required placeholder={`Option ${letter}`}
                    style={{ width: '100%', background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px 10px 32px', color: 'var(--text-primary)', fontSize: 13 }}
                    value={fd[`opt${letter}`]}
                    onChange={e => setFd({...fd, [`opt${letter}`]: e.target.value})}
                  />
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <Label>Correct Answer</Label>
              <select style={{ width: '100%', background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: 10, color: 'var(--text-primary)', fontSize: 13 }}
                value={fd.correct} onChange={e => setFd({...fd, correct: e.target.value})}>
                <option value="A">A</option><option value="B">B</option>
                <option value="C">C</option><option value="D">D</option>
              </select>
            </div>
            <div>
              <Label>Difficulty</Label>
              <select style={{ width: '100%', background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: 10, color: 'var(--text-primary)', fontSize: 13 }}
                value={fd.difficulty} onChange={e => setFd({...fd, difficulty: e.target.value})}>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
          </div>
        </>
      )}

      {fd.question_type === 'simulation' && (
        <div style={{ padding: 16, background: 'rgba(59,130,246,0.03)', border: '1px solid var(--border)', borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <Label>Wokwi Embed URL</Label>
            <input required placeholder="https://wokwi.com/projects/..."
              style={{ width: '100%', background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: 10, color: 'var(--text-primary)', fontSize: 13 }}
              value={fd.wokwi_url}
              onChange={e => setFd({ ...fd, wokwi_url: e.target.value })} />
          </div>

          <div>
            <Label>Instructions</Label>
            <textarea rows={4} required
              style={{ width: '100%', background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: 10, color: 'var(--text-primary)', fontSize: 13, resize: 'none' }}
              value={fd.sim_instructions}
              onChange={e => setFd({ ...fd, sim_instructions: e.target.value })} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <Label>Expected Output</Label>
              <input style={{ width: '100%', background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: 10, color: 'var(--text-primary)', fontSize: 13 }}
                value={fd.sim_expected_output}
                onChange={e => setFd({ ...fd, sim_expected_output: e.target.value })} />
            </div>
            <div>
              <Label>Marks</Label>
              <input type="number"
                style={{ width: '100%', background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: 10, color: 'var(--text-primary)', fontSize: 13 }}
                value={fd.sim_marks}
                onChange={e => setFd({ ...fd, sim_marks: e.target.value })} />
            </div>
          </div>
        </div>
      )}

      <div>
        <Label>Explanation / Hint (Optional)</Label>
        <input style={{ width: '100%', background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: 10, color: 'var(--text-primary)', fontSize: 13 }}
          value={fd.explanation} onChange={e => setFd({...fd, explanation: e.target.value})} />
      </div>

      <button type="submit" className="btn-primary" style={{ padding: '12px 0', marginTop: 16 }}>
        <Save size={16} /> {submitLabel}
      </button>
    </form>
  );
}

export function AdminQuestions() {
  const user = useStore(state => state.user);

  const [questions, setQuestions]         = useState([]);
  const [events, setEvents]               = useState([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [eventQuestions, setEventQuestions]   = useState([]);   // array of question_ids
  const [eventQMeta, setEventQMeta]       = useState([]);   // full records with order_num
  const [tab, setTab]                     = useState('bank');
  const [creationMethod, setCreationMethod] = useState('manual');
  const [search, setSearch]               = useState('');
  const [filterDiff, setFilterDiff]       = useState('all');
  const [bankModeFilter, setBankModeFilter] = useState('all');
  const [activeBankMode, setActiveBankMode] = useState('');

  // Edit / View modal
  const [editing, setEditing]             = useState(null);
  const [viewing, setViewing]             = useState(null);
  const [editForm, setEditForm]           = useState(EMPTY_FORM);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData]           = useState(EMPTY_FORM);

  const fileInputRef = useRef(null);

  // ── Data Fetching ──────────────────────────────────────────
  const fetchData = useCallback(async () => {
    const [{ data: qData }, { data: eData }] = await Promise.all([
      supabase.from('question_bank').select('*').order('created_at', { ascending: false }),
      supabase.from('events').select('id, title, type, status, quiz_mode, rapid_fire_style').order('created_at', { ascending: false })
    ]);
    if (qData) setQuestions(qData);
    if (eData) setEvents(eData);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchData();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchData]);

  useEffect(() => {
    if (!selectedEventId) {
      const timer = setTimeout(() => {
        setEventQuestions([]);
        setEventQMeta([]);
      }, 0);
      return () => clearTimeout(timer);
    }
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
  const baseFiltered = questions.filter(q => {
    const matchSearch = q.question.toLowerCase().includes(search.toLowerCase());
    const matchDiff   = filterDiff === 'all' || q.difficulty === filterDiff;
    return matchSearch && matchDiff;
  });

  const modeCardSummaries = MODE_OPTIONS.map(mode => {
    const count = mode.key === 'global'
      ? questions.length
      : questions.filter(q => normalizeModeTags(q.tags).includes(mode.key)).length;
    return { ...mode, count };
  });

  const activeModeLabel = modeLabel(activeBankMode || 'global');
  const bankQuestions = activeBankMode
    ? baseFiltered.filter(q => {
        if (activeBankMode === 'global') return true;
        return normalizeModeTags(q.tags).includes(activeBankMode);
      })
    : [];

  const assignmentFiltered = baseFiltered.filter(q => {
    const tags = normalizeModeTags(q.tags);
    if (bankModeFilter === 'all') return true;
    if (bankModeFilter === 'global') return tags.includes('global');
    return tags.includes(bankModeFilter) || tags.includes('global');
  });

  const selectedEvent = events.find(e => e.id === selectedEventId);
  const selectedModeKey = getEventModeKey(selectedEvent);
  const contextModeKey = activeBankMode || (selectedEventId ? selectedModeKey : 'global');
  const exactModeQuestions = assignmentFiltered.filter(q => normalizeModeTags(q.tags).includes(selectedModeKey));
  const globalQuestions = assignmentFiltered.filter(q => {
    const tags = normalizeModeTags(q.tags);
    return tags.includes('global') || tags.length === 0;
  });
  const otherModeQuestions = assignmentFiltered.filter(q => {
    const tags = normalizeModeTags(q.tags);
    return !tags.includes(selectedModeKey) && !tags.includes('global');
  });

  // ── Create ─────────────────────────────────────────────────
  const handleCreate = async (e) => {
    e.preventDefault();
    let payload;
    const scopedTags = resolveModeTags(formData.mode_tags, contextModeKey);

    if (formData.question_type === 'simulation') {
      if (!formData.wokwi_url.trim()) {
        alert('Wokwi embed URL is required for simulation questions.');
        return;
      }
      payload = {
        question: formData.question,
        options: ['simulation'],
        correct_answer: 'simulation',
        difficulty: formData.difficulty,
        explanation: formData.explanation || '',
        question_type: 'simulation',
        tags: scopedTags,
        wokwi_url: formData.wokwi_url.trim(),
        sim_instructions: formData.sim_instructions.trim(),
        sim_expected_output: formData.sim_expected_output.trim(),
        sim_marks: Number(formData.sim_marks) || 10,
        created_by: user.id,
      };
    } else {
      const options = [formData.optA, formData.optB, formData.optC, formData.optD];
      const correctValue = options[['A','B','C','D'].indexOf(formData.correct)];
      payload = {
        question: formData.question,
        options,
        correct_answer: correctValue,
        difficulty: formData.difficulty,
        explanation: formData.explanation,
        question_type: 'mcq',
        tags: scopedTags,
        created_by: user.id,
      };
    }

    const { error } = await supabase.from('question_bank').insert([payload]);
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
      question: q.question,
      optA: q.options?.[0] || '',
      optB: q.options?.[1] || '',
      optC: q.options?.[2] || '',
      optD: q.options?.[3] || '',
      correct: ['A','B','C','D'][q.options?.indexOf(q.correct_answer)] || 'A',
      difficulty: q.difficulty,
      explanation: q.explanation || '',
      question_type: q.question_type || 'mcq',
      wokwi_url: q.wokwi_url || '',
      sim_instructions: q.sim_instructions || '',
      sim_expected_output: q.sim_expected_output || '',
      sim_marks: q.sim_marks || 10,
      mode_tags: normalizeModeTags(q.tags),
    });
  };

  const handleEditSave = async (e) => {
    e.preventDefault();

    let payload;

    if (editForm.question_type === 'simulation') {
      if (!editForm.wokwi_url.trim()) {
        alert('Wokwi embed URL is required for simulation questions.');
        return;
      }
      payload = {
        question: editForm.question,
        options: ['simulation'],
        correct_answer: 'simulation',
        difficulty: editForm.difficulty,
        explanation: editForm.explanation || '',
        question_type: 'simulation',
        tags: normalizeModeTags(editForm.mode_tags),
        wokwi_url: editForm.wokwi_url.trim(),
        sim_instructions: editForm.sim_instructions.trim(),
        sim_expected_output: editForm.sim_expected_output.trim(),
        sim_marks: Number(editForm.sim_marks) || 10,
      };
    } else {
      const options = [editForm.optA, editForm.optB, editForm.optC, editForm.optD];
      const correctValue = options[['A','B','C','D'].indexOf(editForm.correct)];
      payload = {
        question: editForm.question,
        options,
        correct_answer: correctValue,
        difficulty: editForm.difficulty,
        explanation: editForm.explanation,
        question_type: 'mcq',
        tags: normalizeModeTags(editForm.mode_tags),
      };
    }

    const { error } = await supabase.from('question_bank').update(payload).eq('id', editing.id);
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
      const q = questions.find((item) => item.id === qId);
      const currentTags = normalizeModeTags(q?.tags);
      if (selectedModeKey !== 'global' && currentTags.length === 1 && currentTags[0] === 'global') {
        await supabase
          .from('question_bank')
          .update({ tags: [selectedModeKey] })
          .eq('id', qId);
        setQuestions((prev) => prev.map((item) => (
          item.id === qId ? { ...item, tags: [selectedModeKey] } : item
        )));
      }

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
          const parsedModes = (row.modes || '').split(',').map(s => s.trim()).filter(Boolean);
          const tags = resolveModeTags(parsedModes, contextModeKey);
          return {
            question:      row.question,
            options,
            correct_answer: idx >= 0 ? options[idx] : options[0],
            difficulty:    row.difficulty || 'medium',
            explanation:   row.explanation || '',
            tags,
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

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8 pb-20">
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Asset Repository</h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 4 }}>Curate global assets and deploy them to specific competition environments.</p>
        </div>
        <div style={{ width: 48, height: 48, background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Database size={20} style={{ color: 'var(--blue)' }} />
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, background: 'var(--elevated)', padding: 4, borderRadius: 12, border: '1px solid var(--border)', alignSelf: 'flex-start', width: 'fit-content' }}>
        <button onClick={() => setTab('bank')}
          style={{ 
            padding: '10px 20px', borderRadius: 10, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', transition: 'all 0.2s',
            background: tab === 'bank' ? 'var(--surface)' : 'transparent',
            color: tab === 'bank' ? 'var(--blue)' : 'var(--text-muted)',
            border: tab === 'bank' ? '1px solid var(--border)' : '1px solid transparent'
          }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Database size={14} /> Global Bank ({questions.length})
          </span>
        </button>
        <button onClick={() => setTab('assign')}
          style={{ 
            padding: '10px 20px', borderRadius: 10, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', transition: 'all 0.2s',
            background: tab === 'assign' ? 'var(--surface)' : 'transparent',
            color: tab === 'assign' ? 'var(--blue)' : 'var(--text-muted)',
            border: tab === 'assign' ? '1px solid var(--border)' : '1px solid transparent'
          }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ListChecks size={14} /> Protocol Assignment
          </span>
        </button>
      </div>

      {/* ── BANK TAB ── */}
      {tab === 'bank' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
            {modeCardSummaries.map(mode => {
              const active = activeBankMode === mode.key;
              return (
                <button
                  key={mode.key}
                  type="button"
                  onClick={() => {
                    setActiveBankMode(mode.key);
                    setBankModeFilter(mode.key);
                  }}
                  className="btn-ghost"
                  style={{
                    minHeight: 74,
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    flexDirection: 'column',
                    border: active ? '1px solid var(--blue)' : '1px solid var(--border)',
                    background: active ? 'rgba(37,99,235,0.1)' : 'var(--surface)',
                    color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                    padding: '12px 14px'
                  }}
                >
                  <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{mode.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: active ? 'var(--blue)' : 'var(--text-muted)' }}>{mode.count} questions</span>
                </button>
              );
            })}
          </div>

          {activeBankMode && (
            <div style={{ display: 'flex', gap: 16, alignItems: 'center', background: 'var(--elevated)', padding: '16px 24px', borderRadius: 16, border: '1px solid var(--border)' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search size={14} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input placeholder={`Filter ${activeModeLabel} questions...`}
                  style={{ width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 16px 10px 42px', color: 'var(--text-primary)', fontSize: 13 }}
                  value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <select style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 16px', color: 'var(--text-primary)', fontSize: 12, fontWeight: 700 }}
                value={filterDiff} onChange={e => setFilterDiff(e.target.value)}>
                <option value="all">Complexity: All</option>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
              <button onClick={() => { setActiveBankMode(''); setShowCreateForm(false); }} className="btn-ghost" style={{ padding: '10px 14px', fontSize: 11 }}>
                Back To Modes
              </button>
              <div style={{ height: 24, width: 1, background: 'var(--border)' }} />
              <div style={{ display: 'flex', gap: 12 }}>
                <button onClick={() => fileInputRef.current.click()} className="btn-ghost" style={{ padding: '10px 16px', fontSize: 11 }}>
                  <Upload size={14} /> Import Protocol
                </button>
                <input type="file" accept=".csv" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
                <button onClick={() => {
                  setShowCreateForm(f => {
                    const next = !f;
                    if (next) {
                      setCreationMethod('manual');
                      setFormData(prev => ({
                        ...EMPTY_FORM,
                        mode_tags: contextModeKey && contextModeKey !== 'global' ? [contextModeKey] : ['global'],
                        difficulty: prev.difficulty || EMPTY_FORM.difficulty,
                      }));
                    }
                    return next;
                  });
                }} className="btn-primary" style={{ padding: '10px 20px', background: 'var(--blue)', color: '#000', fontSize: 11 }}>
                  <Plus size={14} /> Initialize Asset
                </button>
              </div>
            </div>
          )}

          {!activeBankMode && (
            <div style={{ padding: 44, textAlign: 'center', background: 'var(--surface)', border: '1px dashed var(--border)', borderRadius: 16 }}>
              <p style={{ color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', fontSize: 12 }}>
                Select a mode block to open only related questions.
              </p>
            </div>
          )}

          {activeBankMode && showCreateForm && (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderLeft: '4px solid var(--blue)', borderRadius: 16, padding: 32 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>New Asset Entry ({activeModeLabel})</h3>
                <button onClick={() => setShowCreateForm(false)} style={{ color: 'var(--text-muted)' }} className="hover-white">
                  <X size={20} />
                </button>
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                <button
                  type="button"
                  onClick={() => setCreationMethod('manual')}
                  className="btn-ghost"
                  style={{ background: creationMethod === 'manual' ? 'var(--blue)' : 'var(--elevated)', color: creationMethod === 'manual' ? '#fff' : 'var(--text-muted)' }}
                >
                  Manual Entry
                </button>
                <button
                  type="button"
                  onClick={() => setCreationMethod('csv')}
                  className="btn-ghost"
                  style={{ background: creationMethod === 'csv' ? 'var(--blue)' : 'var(--elevated)', color: creationMethod === 'csv' ? '#fff' : 'var(--text-muted)' }}
                >
                  CSV Import
                </button>
              </div>

              {creationMethod === 'manual' ? (
                <QuestionFields fd={formData} setFd={setFormData} submitLabel="Commit to Registry" onSubmit={handleCreate} />
              ) : (
                <div style={{ background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>
                    Upload CSV with columns: <b>question</b>, <b>option_a</b>, <b>option_b</b>, <b>option_c</b>, <b>option_d</b>, <b>correct</b>, <b>difficulty</b>, <b>explanation</b>, <b>modes</b>.
                  </p>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 16 }}>
                    Example <b>modes</b>: <i>global</i> or <i>quiz_normal,rapid_fire_traditional</i>
                  </p>
                  <button onClick={() => fileInputRef.current.click()} className="btn-primary" style={{ background: 'var(--green)', color: '#000' }}>
                    <Upload size={14} /> Select CSV File
                  </button>
                </div>
              )}
            </div>
          )}

          {activeBankMode && (
            <div style={{ display: 'grid', gap: 16 }}>
              {bankQuestions.length === 0 && (
                <div style={{ padding: 128, textAlign: 'center', background: 'var(--surface)', border: '1px solid var(--border)', borderStyle: 'dashed', borderRadius: 16 }}>
                  <Search size={48} style={{ color: 'var(--text-muted)', opacity: 0.2, margin: '0 auto 24px' }} />
                  <p style={{ color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', fontSize: 12 }}>No questions found for this mode block.</p>
                </div>
              )}
              {bankQuestions.map((q, idx) => (
                <QuestionCard key={q.id} q={q} idx={idx}
                  onEdit={() => openEdit(q)}
                  onView={() => setViewing(q)}
                  onDelete={() => handleDelete(q.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── ASSIGN TAB ── */}
      {tab === 'assign' && (
        <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 32, alignItems: 'flex-start' }}>
          
          {/* Left: Event Selection & Assigned List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24, position: 'sticky', top: 32 }}>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 24 }}>
               <Label>Target Protocol</Label>
               <select style={{ width: '100%', background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 10, padding: 14, color: 'var(--text-primary)', fontWeight: 800, fontSize: 14 }}
                value={selectedEventId} onChange={e => setSelectedEventId(e.target.value)}>
                <option value="">-- Choose Environment --</option>
                {events.map(e => (
                  <option key={e.id} value={e.id}>{e.title}</option>
                ))}
              </select>
              {selectedEvent && (
                <div style={{ marginTop: 20, padding: '12px 16px', background: 'rgba(59,130,246,0.06)', borderRadius: 10, border: '1px solid rgba(59,130,246,0.2)' }}>
                  <p style={{ fontSize: 10, fontWeight: 800, color: 'var(--blue)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Deployment Parameters</p>
                  <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>Mode: {selectedEvent.type.replace('_', ' ')}</p>
                  <p style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Lifecycle: {selectedEvent.status}</p>
                </div>
              )}
            </div>

            {selectedEventId && (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <h3 style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Assigned Assets ({eventQuestions.length})
                  </h3>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {eventQMeta.map((meta, i) => {
                    const q = questions.find(q => q.id === meta.question_id);
                    if (!q) return null;
                    return (
                      <div key={meta.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--elevated)', border: '1px solid var(--border)', padding: '10px 14px', borderRadius: 8 }}>
                        <span style={{ width: 18, height: 18, borderRadius: 4, background: 'var(--surface)', color: 'var(--text-muted)', fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i+1}</span>
                        <p style={{ flex: 1, fontSize: 12, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{q.question}</p>
                        <button onClick={() => toggleEventQuestion(q.id)} style={{ color: 'var(--text-muted)' }} className="hover-red">
                          <X size={14} />
                        </button>
                      </div>
                    );
                  })}
                  {eventQuestions.length === 0 && <p style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center', padding: 24, background: 'var(--elevated)', borderRadius: 12, border: '1px solid var(--border)', borderStyle: 'dashed' }}>Architecture unpopulated.</p>}
                </div>
              </div>
            )}
          </div>

          {/* Right: Asset Bank Selector */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {!selectedEventId ? (
              <div style={{ padding: 128, textAlign: 'center', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, borderStyle: 'dashed' }}>
                <ListChecks size={48} style={{ color: 'var(--text-muted)', opacity: 0.2, margin: '0 auto 24px' }} />
                <p style={{ color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', fontSize: 12 }}>Select a target protocol to begin assignment.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                   <h3 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Global Asset Inventory</h3>
                   <div style={{ position: 'relative', width: 300 }}>
                    <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input placeholder="Filter bank..."
                      style={{ width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px 8px 36px', color: 'var(--text-primary)', fontSize: 12 }}
                      value={search} onChange={e => setSearch(e.target.value)} />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                  <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Target Block:</span>
                  <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--blue)', background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.2)', padding: '2px 8px', borderRadius: 999 }}>
                    {modeLabel(selectedModeKey)}
                  </span>
                </div>

                <div style={{ display: 'grid', gap: 12 }}>
                  {[
                    { title: 'Exact Mode Match', subtitle: modeLabel(selectedModeKey), items: exactModeQuestions, tone: 'rgba(37,99,235,0.12)' },
                    { title: 'Global Shared Block', subtitle: 'Reusable in all event types', items: globalQuestions, tone: 'rgba(16,185,129,0.12)' },
                    { title: 'Other Mode Blocks', subtitle: 'Use only if needed', items: otherModeQuestions, tone: 'rgba(245,158,11,0.12)' },
                  ].map(section => (
                    <div key={section.title} style={{ border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface)', overflow: 'hidden' }}>
                      <div style={{ padding: '10px 14px', background: section.tone, borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <p style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase' }}>{section.title}</p>
                          <p style={{ fontSize: 10, color: 'var(--text-muted)' }}>{section.subtitle}</p>
                        </div>
                        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)' }}>{section.items.length}</span>
                      </div>

                      <div style={{ display: 'grid', gap: 10, padding: 12 }}>
                        {section.items.length === 0 && (
                          <p style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic', padding: '10px 4px' }}>No questions in this block.</p>
                        )}
                        {section.items.map(q => {
                          const assigned = eventQuestions.includes(q.id);
                          return (
                            <div key={q.id}
                              onClick={() => toggleEventQuestion(q.id)}
                              style={{
                                padding: '14px 16px', borderRadius: 10, border: '1px solid var(--border)', background: assigned ? 'rgba(59,130,246,0.06)' : 'var(--elevated)',
                                borderColor: assigned ? 'var(--blue)' : 'var(--border)', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 14
                              }}
                              className={assigned ? '' : 'hover-elevated'}
                            >
                              <div style={{ width: 20, height: 20, borderRadius: 5, border: '2px solid var(--border)', background: assigned ? 'var(--blue)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {assigned && <Check size={12} style={{ color: '#000' }} />}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{ fontSize: 13, fontWeight: 700, color: assigned ? 'var(--text-primary)' : 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{q.question}</p>
                                <div style={{ display: 'flex', gap: 10, marginTop: 4, flexWrap: 'wrap' }}>
                                  <span style={{ fontSize: 9, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{q.difficulty}</span>
                                  <span style={{ fontSize: 9, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{q.question_type}</span>
                                  {normalizeModeTags(q.tags).slice(0, 2).map(t => (
                                    <span key={t} style={{ fontSize: 9, fontWeight: 800, color: 'var(--blue)', textTransform: 'uppercase' }}>{t}</span>
                                  ))}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Edit Modal ── */}
      {editing && (
        <Modal title={`Modify Asset Entry`} onClose={() => setEditing(null)} wide>
          <QuestionFields fd={editForm} setFd={setEditForm} submitLabel="Commit Changes" onSubmit={handleEditSave} />
        </Modal>
      )}

      {/* ── View Modal ── */}
      {viewing && (
        <Modal title="Asset Technical Analysis" onClose={() => setViewing(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <p style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.5 }}>{viewing.question}</p>
            
            <div style={{ display: 'grid', gap: 10 }}>
              {viewing.options.map((opt, i) => (
                <div key={i} style={{ padding: 16, borderRadius: 10, border: '1px solid var(--border)', background: opt === viewing.correct_answer ? 'rgba(16,185,129,0.06)' : 'var(--elevated)', display: 'flex', alignItems: 'center', gap: 16 }}>
                  <span style={{ width: 24, height: 24, borderRadius: 6, background: opt === viewing.correct_answer ? 'var(--green)' : 'var(--surface)', fontSize: 10, fontWeight: 900, color: opt === viewing.correct_answer ? '#000' : 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{['A','B','C','D'][i]}</span>
                  <span style={{ fontSize: 14, color: opt === viewing.correct_answer ? 'var(--green)' : 'var(--text-primary)', fontWeight: opt === viewing.correct_answer ? 700 : 400 }}>{opt}</span>
                  {opt === viewing.correct_answer && <CheckCircle2 size={16} style={{ marginLeft: 'auto', color: 'var(--green)' }} />}
                </div>
              ))}
            </div>

            {viewing.explanation && (
              <div style={{ padding: 20, background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 12 }}>
                <Label>Supplemental Logic / Explanation</Label>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{viewing.explanation}</p>
              </div>
            )}

            <div style={{ display: 'flex', gap: 12, paddingTop: 32, borderTop: '1px solid var(--border)' }}>
              <button onClick={() => { setViewing(null); openEdit(viewing); }} className="btn-primary" style={{ flex: 1, padding: '12px', background: 'var(--blue)', color: '#000' }}>
                Access Record Controller
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
  
  const parseStyle = (str) => {
    const obj = {};
    if (!str) return obj;
    str.split(';').forEach(pair => {
      const [k, v] = pair.split(':');
      if (k && v) obj[k.trim().replace(/-([a-z])/g, g => g[1].toUpperCase())] = v.trim();
    });
    return obj;
  };

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ padding: 16, display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        <div style={{ width: 32, height: 32, borderRadius: 6, background: 'var(--elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: 'var(--text-muted)', shrink: 0 }}>
          {idx + 1}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12, lineClamp: 2 }}>{q.question}</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 8px', borderRadius: 4, border: '1px solid currentColor', textTransform: 'uppercase', letterSpacing: '0.04em', ...parseStyle(DIFFICULTY_COLORS[q.difficulty]) }}>
              {q.difficulty}
            </span>
            {q.question_type === 'simulation' ? (
               <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 8px', borderRadius: 4, background: 'rgba(168,85,247,0.1)', color: '#a855f7', textTransform: 'uppercase' }}>
                Simulation
              </span>
            ) : (
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{q.options.length} Options</span>
            )}
            {normalizeModeTags(q.tags).slice(0, 3).map(tag => (
              <span key={tag} style={{ fontSize: 9, fontWeight: 800, padding: '2px 8px', borderRadius: 4, border: '1px solid rgba(37,99,235,0.2)', color: 'var(--blue)', background: 'rgba(37,99,235,0.08)', textTransform: 'uppercase' }}>
                {tag}
              </span>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={onView} className="btn-ghost" style={{ padding: 8, minHeight: 'unset' }} title="View">
            <Eye size={14} />
          </button>
          <button onClick={onEdit} className="btn-ghost" style={{ padding: 8, minHeight: 'unset' }} title="Edit">
            <Pencil size={14} />
          </button>
          <button onClick={onDelete} className="btn-ghost" style={{ padding: 8, minHeight: 'unset', color: 'var(--red)' }} title="Delete">
            <Trash2 size={14} />
          </button>
          <button onClick={() => setExpanded(!expanded)} className="btn-ghost" style={{ padding: 8, minHeight: 'unset', background: expanded ? 'var(--blue)' : 'transparent' }}>
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {expanded && (
        <div style={{ padding: 20, background: 'var(--elevated)', borderTop: '1px solid var(--border)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {q.options.map((opt, i) => (
            <div key={i} style={{ padding: 10, borderRadius: 6, border: '1px solid var(--border)', background: opt === q.correct_answer ? 'rgba(16,185,129,0.05)' : 'var(--surface)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 10, fontWeight: 900, color: opt === q.correct_answer ? 'var(--green)' : 'var(--text-muted)' }}>{['A','B','C','D'][i]}</span>
              <span style={{ fontSize: 12, color: opt === q.correct_answer ? 'var(--green)' : 'var(--text-primary)' }}>{opt}</span>
              {opt === q.correct_answer && <Check size={12} style={{ marginLeft: 'auto', color: 'var(--green)' }} />}
            </div>
          ))}
          {q.explanation && (
            <div style={{ gridColumn: 'span 2', marginTop: 8, padding: 12, background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8, fontSize: 12 }}>
              <span style={{ fontWeight: 800, color: 'var(--amber)', textTransform: 'uppercase', fontSize: 10, marginRight: 8 }}>Explain:</span>
              <span style={{ color: 'var(--text-secondary)' }}>{q.explanation}</span>
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
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          boxShadow: '0 24px 48px rgba(0,0,0,0.5)',
          width: '100%',
          maxWidth: wide ? 640 : 440,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
        onClick={e => e.stopPropagation()}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{title}</h2>
          <button onClick={onClose} style={{ color: 'var(--text-muted)' }} className="hover-white">
            <X size={20} />
          </button>
        </div>
        <div style={{ padding: 24, overflowY: 'auto' }}>{children}</div>
      </div>
    </div>
  );
}
