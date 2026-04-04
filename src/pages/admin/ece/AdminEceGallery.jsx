import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { deleteFromCloudinary } from '../../../lib/cloudinary';
import { CloudinaryUpload } from '../../../components/ece/CloudinaryUpload';
import { Image, Plus, Trash2, Loader2, Check, X } from 'lucide-react';

const CATEGORIES = ['general', 'lab', 'project', 'event', 'batch'];
const EMPTY_FORM = { title: '', description: '', category: 'general', image_url: '', public_id: '' };

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
      .then(({ data }) => { setPhotos(data || []); setLoading(false); });
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
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-pink-500/20 flex items-center justify-center">
            <Image className="w-5 h-5 text-pink-400" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white">Manage Gallery</h1>
            <p className="text-xs text-slate-500">{photos.length} photos total</p>
          </div>
        </div>
        <div className="flex gap-2">
          {selected.size > 0 && (
            <button onClick={handleBulkDelete} disabled={bulkDeleting}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-bold transition-colors">
              {bulkDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Delete {selected.size}
            </button>
          )}
          <button onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-pink-600 hover:bg-pink-500 text-white text-sm font-bold transition-colors">
            <Plus className="w-4 h-4" /> Upload Photo
          </button>
        </div>
      </div>

      {/* Upload form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="p-5 rounded-2xl border border-white/10 bg-slate-900/60 space-y-4">
          <h2 className="text-sm font-bold text-slate-200">Upload New Photo</h2>
          <CloudinaryUpload
            folder="ece_hub/gallery"
            resourceType="image"
            accept="image/*"
            label="Select Photo"
            currentUrl={form.image_url}
            currentPublicId={form.public_id}
            onUpload={(url, pid) => setForm((f) => ({ ...f, image_url: url, public_id: pid }))}
            onDelete={() => setForm((f) => ({ ...f, image_url: '', public_id: '' }))}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="admin-label">Title *</label>
              <input className="ece-input" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} required placeholder="Photo title…" />
            </div>
            <div>
              <label className="admin-label">Category</label>
              <select className="ece-select" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-3">
            <button type="submit" disabled={saving || !form.image_url} className="ece-btn-primary flex items-center gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Save
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="ece-btn-secondary flex items-center gap-2">
              <X className="w-4 h-4" /> Cancel
            </button>
          </div>
        </form>
      )}

      {/* Photo grid */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-7 h-7 animate-spin text-slate-500" /></div>
      ) : photos.length === 0 ? (
        <div className="text-center py-12 text-slate-500 text-sm">No photos yet. Upload one above.</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {photos.map((photo) => (
            <div
              key={photo.id}
              className={`relative rounded-2xl overflow-hidden border transition-all ${selected.has(photo.id) ? 'border-blue-500 ring-2 ring-blue-500/30' : 'border-white/8'}`}
            >
              <img src={photo.image_url} alt={photo.title} className="w-full h-36 object-cover" loading="lazy" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent" />
              <p className="absolute bottom-1 left-2 right-8 text-[10px] font-semibold text-white truncate">{photo.title}</p>
              <button
                onClick={() => toggleSelect(photo.id)}
                className={`absolute top-2 left-2 w-5 h-5 rounded-full border-2 transition-all ${selected.has(photo.id) ? 'bg-blue-500 border-blue-400' : 'border-white/50 bg-black/20'}`}
              />
              <button
                onClick={() => handleDelete(photo)}
                disabled={deletingId === photo.id}
                className="absolute top-2 right-2 p-1 rounded-lg bg-black/50 hover:bg-red-600 text-white transition-colors"
              >
                {deletingId === photo.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
