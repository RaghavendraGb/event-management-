import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { GalleryGrid } from '../../components/ece/GalleryGrid';
import { Loader2, Image } from 'lucide-react';

const CATEGORIES = [
  { key: 'all',     label: 'All' },
  { key: 'lab',     label: 'Lab' },
  { key: 'project', label: 'Project' },
  { key: 'event',   label: 'Event' },
  { key: 'batch',   label: 'Batch' },
  { key: 'general', label: 'General' },
];

export function EceGallery() {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('all');

  useEffect(() => {
    supabase
      .from('ece_gallery')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setPhotos(data || []);
        setLoading(false);
      });
  }, []);

  const filtered = activeCategory === 'all'
    ? photos
    : photos.filter((p) => p.category === activeCategory);

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-purple-500/20 flex items-center justify-center">
          <Image className="w-5 h-5 text-purple-400" />
        </div>
        <div>
          <h1 className="text-xl font-black text-white">Photo Gallery</h1>
          <p className="text-xs text-slate-500">Lab sessions, projects, events & more</p>
        </div>
      </div>

      {/* Category filter */}
      <div className="flex gap-2 flex-wrap">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            onClick={() => setActiveCategory(cat.key)}
            className={`
              px-3 py-1.5 rounded-xl text-xs font-bold transition-all border
              ${activeCategory === cat.key
                ? 'bg-purple-600/20 text-purple-400 border-purple-500/30'
                : 'text-slate-400 border-white/8 hover:text-white hover:bg-slate-800'
              }
            `}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-slate-500" />
        </div>
      ) : (
        <GalleryGrid photos={filtered} />
      )}
    </div>
  );
}
