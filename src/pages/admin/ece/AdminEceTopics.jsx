import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { deleteFromCloudinary } from '../../../lib/cloudinary';
import { CloudinaryUpload } from '../../../components/ece/CloudinaryUpload';
import { Plus, Trash2, Loader2, Cpu, GripVertical, Pencil, X, Check } from 'lucide-react';

const DEFAULT_COLORS = ['#3b82f6','#8b5cf6','#ec4899','#10b981','#f59e0b','#ef4444','#06b6d4','#84cc16'];

const EMPTY_FORM = { name: '', description: '', color: '#3b82f6', icon_url: '', icon_public_id: '', order_num: 0, position_x: 450, position_y: 310 };

// ── Mini drag-preview canvas for mind map position ────────────────
function PositionCanvas({ x, y, onChange }) {
  const canvasRef = useRef(null);
  const dragging = useRef(false);

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

  const getPos = useCallback((clientX, clientY) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const scaleX = 900 / rect.width;
    const scaleY = 620 / rect.height;
    const px = clamp(Math.round((clientX - rect.left) * scaleX), 0, 900);
    const py = clamp(Math.round((clientY - rect.top) * scaleY), 0, 620);
    onChange(px, py);
  }, [onChange]);

  const onMouseDown = (e) => { dragging.current = true; getPos(e.clientX, e.clientY); };
  const onMouseMove = (e) => { if (dragging.current) getPos(e.clientX, e.clientY); };
  const onMouseUp = () => { dragging.current = false; };
  const onTouchStart = (e) => { dragging.current = true; const t = e.touches[0]; getPos(t.clientX, t.clientY); };
  const onTouchMove = (e) => { if (dragging.current) { const t = e.touches[0]; getPos(t.clientX, t.clientY); } };
  const onTouchEnd = () => { dragging.current = false; };

  // Convert 900x620 coords to canvas %
  const dotLeft = `${(x / 900) * 100}%`;
  const dotTop = `${(y / 620) * 100}%`;

  return (
    <div className="space-y-2">
      <label className="admin-label">Mind Map Position <span className="text-slate-600 font-normal">(drag the dot)</span></label>
      <div
        ref={canvasRef}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        className="relative w-full rounded-xl border border-blue-500/20 bg-slate-800/80 cursor-crosshair select-none overflow-hidden"
        style={{ aspectRatio: '900/620', maxWidth: '400px',
          backgroundImage: 'linear-gradient(rgba(59,130,246,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,0.04) 1px, transparent 1px)',
          backgroundSize: '10% 10%'
        }}
      >
        {/* Center cross */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-px h-full bg-blue-500/10" />
          <div className="absolute h-px w-full bg-blue-500/10" />
        </div>
        {/* Dot */}
        <div
          className="absolute w-5 h-5 rounded-full bg-blue-500 border-2 border-white shadow-lg -translate-x-1/2 -translate-y-1/2 pointer-events-none transition-none"
          style={{ left: dotLeft, top: dotTop }}
        />
      </div>
      <p className="text-[10px] text-slate-500">X: <span className="text-slate-300 font-mono">{x}</span> &nbsp;/&nbsp; Y: <span className="text-slate-300 font-mono">{y}</span> &nbsp;—&nbsp; canvas is 900×620. Center is 450,310.</p>
    </div>
  );
}

export function AdminEceTopics() {
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const loadTopics = () => {
    supabase.from('ece_topics').select('*, ece_resources(id)').order('order_num')
      .then(({ data }) => { setTopics(data || []); setLoading(false); });
  };

  useEffect(() => { loadTopics(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      color: form.color,
      icon_url: form.icon_url || null,
      icon_public_id: form.icon_public_id || null,
      order_num: Number(form.order_num) || 0,
      position_x: Number(form.position_x) || 0,
      position_y: Number(form.position_y) || 0,
    };
    if (editId) {
      await supabase.from('ece_topics').update(payload).eq('id', editId);
    } else {
      await supabase.from('ece_topics').insert(payload);
    }
    setSaving(false);
    setForm(EMPTY_FORM);
    setEditId(null);
    setShowForm(false);
    loadTopics();
  };

  const handleEdit = (topic) => {
    setForm({ ...topic, icon_url: topic.icon_url || '', icon_public_id: topic.icon_public_id || '' });
    setEditId(topic.id);
    setShowForm(true);
  };

  const handleDelete = async (topic) => {
    if (!window.confirm(`Delete topic "${topic.name}"? This will also delete all its resources.`)) return;
    setDeletingId(topic.id);
    // Delete icon from Cloudinary
    if (topic.icon_public_id) {
      await deleteFromCloudinary(topic.icon_public_id, 'image');
    }
    await supabase.from('ece_topics').delete().eq('id', topic.id);
    setDeletingId(null);
    loadTopics();
  };

  const handleIconUpload = (url, public_id) => {
    setForm((f) => ({ ...f, icon_url: url, icon_public_id: public_id }));
  };

  const handleIconDelete = async (public_id) => {
    await deleteFromCloudinary(public_id, 'image');
    setForm((f) => ({ ...f, icon_url: '', icon_public_id: '' }));
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-500/20 flex items-center justify-center">
            <Cpu className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white">Manage Topics</h1>
            <p className="text-xs text-slate-500">Topics appear as nodes in the mind map</p>
          </div>
        </div>
        <button
          onClick={() => { setShowForm(!showForm); setForm(EMPTY_FORM); setEditId(null); }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Topic
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="p-5 rounded-2xl border border-white/10 bg-slate-900/60 space-y-4">
          <h2 className="text-sm font-bold text-slate-200">{editId ? 'Edit Topic' : 'New Topic'}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="admin-label">Name *</label>
              <input className="ece-input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required placeholder="e.g. Microcontrollers" />
            </div>
            <div>
              <label className="admin-label">Order</label>
              <input type="number" className="ece-input" value={form.order_num} onChange={(e) => setForm((f) => ({ ...f, order_num: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="admin-label">Description</label>
            <textarea className="ece-textarea" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2} placeholder="Brief description…" />
          </div>
          {/* Color */}
          <div>
            <label className="admin-label">Color</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {DEFAULT_COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setForm((f) => ({ ...f, color: c }))}
                  className={`w-7 h-7 rounded-lg transition-all ${form.color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900' : ''}`}
                  style={{ background: c }}
                />
              ))}
              <input type="color" value={form.color} onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                className="w-7 h-7 rounded-lg cursor-pointer border-0 bg-transparent" title="Custom color" />
            </div>
          </div>
          {/* Icon upload */}
          <CloudinaryUpload
            folder="ece_hub/topics"
            resourceType="image"
            accept="image/*"
            label="Topic Icon Image"
            currentUrl={form.icon_url}
            currentPublicId={form.icon_public_id}
            onUpload={handleIconUpload}
            onDelete={handleIconDelete}
          />
          {/* Mind map position canvas */}
          <PositionCanvas
            x={Number(form.position_x) || 0}
            y={Number(form.position_y) || 0}
            onChange={(px, py) => setForm((f) => ({ ...f, position_x: px, position_y: py }))}
          />
          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="ece-btn-primary flex items-center gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {editId ? 'Update' : 'Create'}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setEditId(null); setForm(EMPTY_FORM); }} className="ece-btn-secondary flex items-center gap-2">
              <X className="w-4 h-4" /> Cancel
            </button>
          </div>
        </form>
      )}

      {/* Topics list */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-7 h-7 animate-spin text-slate-500" /></div>
      ) : topics.length === 0 ? (
        <div className="text-center py-12 text-slate-500 text-sm">No topics yet. Add one above.</div>
      ) : (
        <div className="space-y-3">
          {topics.map((topic) => (
            <div key={topic.id} className="flex items-center gap-3 p-4 rounded-2xl border border-white/8 bg-slate-900/60">
              <GripVertical className="w-4 h-4 text-slate-600 shrink-0" />
              {/* Icon */}
              {topic.icon_url ? (
                <img src={topic.icon_url} alt={topic.name} className="w-10 h-10 rounded-xl object-contain shrink-0" />
              ) : (
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-base font-black text-white shrink-0"
                  style={{ background: topic.color || '#3b82f6' }}>
                  {topic.name.charAt(0)}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-100">{topic.name}</p>
                <p className="text-xs text-slate-500">{topic.ece_resources?.length || 0} resources</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <div className="w-4 h-4 rounded-full shrink-0" style={{ background: topic.color }} />
                <button onClick={() => handleEdit(topic)} className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => handleDelete(topic)} disabled={deletingId === topic.id}
                  className="p-2 rounded-lg hover:bg-red-500/10 text-slate-400 hover:text-red-400 transition-colors">
                  {deletingId === topic.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
