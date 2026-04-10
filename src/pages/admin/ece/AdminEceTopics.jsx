import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { deleteFromCloudinary } from '../../../lib/cloudinary';
import { CloudinaryUpload } from '../../../components/ece/CloudinaryUpload';
import { Plus, Trash2, Loader2, Cpu, GripVertical, Pencil, X, Check } from 'lucide-react';

const DEFAULT_COLORS = ['#3b82f6','#8b5cf6','#ec4899','#10b981','#f59e0b','#ef4444','#06b6d4','#84cc16'];

const EMPTY_FORM = { name: '', description: '', color: '#3b82f6', icon_url: '', icon_public_id: '', order_num: 0, position_x: 450, position_y: 310 };

const Label = ({ children }) => (
  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
    {children}
  </label>
);

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

  const dotLeft = `${(x / 900) * 100}%`;
  const dotTop = `${(y / 620) * 100}%`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        Canvas Placement (Drag Dot)
      </label>
      <div
        ref={canvasRef}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '900/620',
          background: 'var(--elevated)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          cursor: 'crosshair',
          overflow: 'hidden',
          backgroundImage: 'radial-gradient(var(--border) 1px, transparent 1px)',
          backgroundSize: '20px 20px'
        }}
      >
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <div style={{ width: 1, height: '100%', background: 'rgba(59,130,246,0.1)' }} />
          <div style={{ position: 'absolute', height: 1, width: '100%', background: 'rgba(59,130,246,0.1)' }} />
        </div>
        <div
          style={{
            position: 'absolute',
            width: 14,
            height: 14,
            borderRadius: '50%',
            background: 'var(--blue)',
            border: '2px solid #fff',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            left: dotLeft,
            top: dotTop,
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none'
          }}
        />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
        <span>X: {x}</span>
        <span>Y: {y}</span>
        <span>Relative to 900x620</span>
      </div>
    </div>
  );
}

export function AdminEceTopics() {
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const loadTopics = () => {
    supabase.from('ece_topics').select('*, ece_resources(id)').order('order_num')
      .then(({ data }) => {
        setTopics(data || []);
        setLoading(false);
      });
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
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>Map Architect</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>Configure knowledge nodes and mind map trajectories.</p>
        </div>
        <button
          onClick={() => { setShowForm(!showForm); setForm(EMPTY_FORM); setEditId(null); }}
          className="btn-primary" style={{ padding: '10px 20px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}
        >
          <Plus size={16} /> New Node
        </button>
      </div>

      {/* Form Section */}
      {showForm && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 32, animation: 'fadeIn 0.2s ease-out' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>{editId ? 'Architecting Node' : 'Establish New Node'}</h2>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Define node metadata and spatial coordinates.</p>
            </div>
            <button onClick={() => { setShowForm(false); setEditId(null); }} className="btn-ghost" style={{ padding: 8, minHeight: 'unset' }}>
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
              <div>
                <Label>Node Label *</Label>
                <input required className="input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Embedded Systems" />
              </div>
              <div>
                <Label>Sequencing Index</Label>
                <input type="number" className="input" value={form.order_num} onChange={(e) => setForm((f) => ({ ...f, order_num: e.target.value }))} />
              </div>
            </div>

            <div>
              <Label>Description / Syllabus Context</Label>
              <textarea rows={3} className="input" style={{ resize: 'none' }} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Defining the academic scope of this node…" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(250px, 1fr) 1.5fr', gap: 32 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div>
                  <Label>Visual Accent</Label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {DEFAULT_COLORS.map((c) => (
                      <button key={c} type="button" onClick={() => setForm((f) => ({ ...f, color: c }))}
                        style={{ width: 28, height: 28, borderRadius: 8, background: c, border: form.color === c ? '2px solid #fff' : '1px solid rgba(0,0,0,0.2)', cursor: 'pointer', transition: 'transform 0.1s' }}
                        onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
                        onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <Label>Resource Icon (Cloudinary)</Label>
                  <div style={{ padding: 16, background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 12 }}>
                    <CloudinaryUpload
                      folder="ece_hub/topics" resourceType="image" accept="image/*" label="Drop icon SVG/PNG"
                      currentUrl={form.icon_url} currentPublicId={form.icon_public_id}
                      onUpload={handleIconUpload} onDelete={handleIconDelete}
                    />
                  </div>
                </div>
              </div>

              <div>
                <PositionCanvas
                  x={Number(form.position_x) || 0}
                  y={Number(form.position_y) || 0}
                  onChange={(px, py) => setForm((f) => ({ ...f, position_x: px, position_y: py }))}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, borderTop: '1px solid var(--border)', paddingTop: 24, justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowForm(false); setEditId(null); }} type="button" className="btn-ghost" style={{ padding: '10px 24px' }}>Cancel</button>
              <button type="submit" disabled={saving} className="btn-primary" style={{ padding: '10px 32px' }}>
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} 
                {editId ? 'Verify & Persist' : 'Establish Node'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Topics list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h3 style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Active Nodes Registry</h3>
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-slate-500" /></div>
        ) : topics.length === 0 ? (
          <div style={{ textAlign: 'center', py: 48, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 32 }}>
            <Cpu size={32} style={{ color: 'var(--text-muted)', marginBottom: 12, opacity: 0.3 }} />
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No topics architected yet. Initialize your first node above.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {topics.map((topic) => (
              <div key={topic.id} style={{ 
                display: 'flex', alignItems: 'center', gap: 16, padding: '14px 20px', 
                borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border)',
                transition: 'border-color 0.2s',
              }}
              onMouseOver={(e) => e.currentTarget.style.borderColor = 'var(--blue)'}
              onMouseOut={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
              >
                <GripVertical size={14} style={{ color: 'var(--text-muted)', cursor: 'grab', shrink: 0 }} />
                
                {topic.icon_url ? (
                  <img src={topic.icon_url} alt={topic.name} style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'contain', background: 'var(--elevated)', padding: 4, shrink: 0 }} />
                ) : (
                  <div style={{ width: 40, height: 40, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 900, color: '#fff', background: topic.color || 'var(--blue)', shrink: 0 }}>
                    {topic.name.charAt(0)}
                  </div>
                )}

                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{topic.name}</p>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{topic.ece_resources?.length || 0} Professional Resources Linked</p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-muted)', background: 'var(--elevated)', padding: '3px 10px', borderRadius: 6, border: '1px solid var(--border)' }}>
                    X:{topic.position_x} Y:{topic.position_y}
                  </div>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: topic.color || 'var(--blue)', boxShadow: `0 0 8px ${topic.color}` }} />
                  <div style={{ display: 'flex', gap: 4, marginLeft: 8 }}>
                    <button onClick={() => handleEdit(topic)} className="btn-ghost" style={{ padding: 8, minHeight: 'unset' }}>
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => handleDelete(topic)} disabled={deletingId === topic.id} className="btn-ghost" style={{ padding: 8, minHeight: 'unset', color: 'var(--red)' }}>
                      {deletingId === topic.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
