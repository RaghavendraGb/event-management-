import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { deleteFromCloudinary } from '../../../lib/cloudinary';
import { CloudinaryUpload } from '../../../components/ece/CloudinaryUpload';
import { Image, Plus, Trash2, Loader2, Check, X } from 'lucide-react';

const CATEGORIES = ['general', 'lab', 'project', 'event', 'batch'];
const EMPTY_FORM = { title: '', description: '', category: 'general', image_url: '', public_id: '' };

const Label = ({ children }) => (
  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
    {children}
  </label>
);

export function AdminEceGallery() {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const loadPhotos = () => {
    supabase.from('ece_gallery').select('*').order('created_at', { ascending: false })
      .then(({ data }) => {
        setPhotos(data || []);
        setLoading(false);
      });
  };

  useEffect(() => { loadPhotos(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.image_url) return alert('Please upload an image first.');
    setSaving(true);
    await supabase.from('ece_gallery').insert({
      title: form.title.trim(),
      description: form.description.trim() || null,
      category: form.category,
      image_url: form.image_url,
      public_id: form.public_id,
    });
    setSaving(false);
    setForm(EMPTY_FORM);
    setShowForm(false);
    loadPhotos();
  };

  const handleDelete = async (photo) => {
    if (!window.confirm(`Delete this photo? This cannot be undone.`)) return;
    setDeletingId(photo.id);
    await deleteFromCloudinary(photo.public_id, 'image');
    await supabase.from('ece_gallery').delete().eq('id', photo.id);
    setDeletingId(null);
    loadPhotos();
  };

  const handleBulkDelete = async () => {
    if (!selected.size) return;
    if (!window.confirm(`Delete ${selected.size} photo(s)?`)) return;
    setBulkDeleting(true);
    const toDelete = photos.filter((p) => selected.has(p.id));
    await Promise.all(toDelete.map((p) => deleteFromCloudinary(p.public_id, 'image')));
    await supabase.from('ece_gallery').delete().in('id', [...selected]);
    setSelected(new Set());
    setBulkDeleting(false);
    loadPhotos();
  };

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>Gallery Master</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>Curate and oversee the ECE visual archive.</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          {selected.size > 0 && (
            <button onClick={handleBulkDelete} disabled={bulkDeleting}
              className="btn-ghost" style={{ color: 'var(--red)', background: 'rgba(239,68,68,0.08)', padding: '0 20px', fontSize: 11, fontWeight: 700 }}>
              {bulkDeleting ? <Loader2 size={14} className="animate-spin mr-2" /> : <Trash2 size={14} className="mr-2" />} 
              Purge ({selected.size})
            </button>
          )}
          <button onClick={() => setShowForm(!showForm)}
            className="btn-primary" style={{ padding: '10px 20px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>
            <Plus size={16} /> New Asset
          </button>
        </div>
      </div>

      {/* Upload Form Section */}
      {showForm && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 32, animation: 'fadeIn 0.2s ease-out' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>New Image Asset</h2>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Inject historical or current media into the hub.</p>
            </div>
            <button onClick={() => setShowForm(false)} className="btn-ghost" style={{ padding: 8, minHeight: 'unset' }}>
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div style={{ padding: 32, background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 16, display: 'flex', justifyContent: 'center' }}>
              <CloudinaryUpload
                folder="ece_hub/gallery" resourceType="image" accept="image/*" label="Drop High-Res Archive Photo Here"
                currentUrl={form.image_url} currentPublicId={form.public_id}
                onUpload={(url, pid) => setForm((f) => ({ ...f, image_url: url, public_id: pid }))}
                onDelete={() => setForm((f) => ({ ...f, image_url: '', public_id: '' }))}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
              <div>
                <Label>Asset Title / Caption *</Label>
                <input required className="input" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Identifying caption for the gallery…" />
              </div>
              <div>
                <Label>Metadata Category</Label>
                <select className="select" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, borderTop: '1px solid var(--border)', paddingTop: 24, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowForm(false)} type="button" className="btn-ghost" style={{ padding: '10px 24px' }}>Discard</button>
              <button type="submit" disabled={saving || !form.image_url} className="btn-primary" style={{ padding: '10px 32px' }}>
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Deploy to Archive
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Visual Registry */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <h3 style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Historical Visual Registry</h3>
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-slate-500" /></div>
        ) : photos.length === 0 ? (
          <div style={{ textAlign: 'center', py: 64, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 48 }}>
            <Image size={32} style={{ color: 'var(--text-muted)', marginBottom: 12, opacity: 0.3 }} />
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No media assets detected. Command center ready for uploads.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 20 }}>
            {photos.map((photo) => (
              <div
                key={photo.id}
                style={{
                  position: 'relative',
                  borderRadius: 16,
                  overflow: 'hidden',
                  background: 'var(--surface)',
                  border: selected.has(photo.id) ? '2px solid var(--blue)' : '1px solid var(--border)',
                  cursor: 'pointer',
                  transition: 'transform 0.2s, border-color 0.2s',
                  aspectRatio: '4/3'
                }}
                onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
                onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
                onClick={() => toggleSelect(photo.id)}
              >
                <img src={photo.image_url} alt={photo.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, transparent 50%)', pointerEvents: 'none' }} />
                
                <div style={{ position: 'absolute', bottom: 16, left: 16, right: 16, pointerEvents: 'none' }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#fff', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{photo.title}</p>
                  <p style={{ fontSize: 9, fontWeight: 900, color: 'var(--blue)', textTransform: 'uppercase', margin: 0, marginTop: 4 }}>{photo.category}</p>
                </div>

                <div style={{ position: 'absolute', top: 12, left: 12, width: 22, height: 22, borderRadius: '50%', border: '2px solid #fff', background: selected.has(photo.id) ? 'var(--blue)' : 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s' }}>
                  {selected.has(photo.id) && <Check size={12} color="#fff" strokeWidth={3} />}
                </div>

                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(photo); }}
                  disabled={deletingId === photo.id}
                  className="btn-ghost"
                  style={{ position: 'absolute', top: 10, right: 10, padding: 8, minHeight: 'unset', background: 'rgba(0,0,0,0.5)', color: '#fff', borderRadius: 10 }}
                  onMouseOver={(e) => { e.currentTarget.style.color = 'var(--red)'; }}
                  onMouseOut={(e) => { e.currentTarget.style.color = '#fff'; }}
                >
                  {deletingId === photo.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
