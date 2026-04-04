import { useState, useRef } from 'react';
import { Upload, X, FileText, Loader2, Image } from 'lucide-react';
import { deleteFromCloudinary } from '../../lib/cloudinary';

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

/**
 * Reusable Cloudinary upload component.
 * Props:
 *  - folder: string (e.g. 'ece_hub/gallery')
 *  - resourceType: 'image' | 'raw' (for PDFs)
 *  - accept: string (e.g. 'image/*' or '.pdf')
 *  - label: string
 *  - currentUrl: string | null (existing file URL)
 *  - currentPublicId: string | null (existing file public_id)
 *  - onUpload: (url, publicId) => void
 *  - onDelete: (publicId) => void
 */
export function CloudinaryUpload({
  folder = 'ece_hub',
  resourceType = 'image',
  accept = 'image/*',
  label = 'Upload File',
  currentUrl = null,
  currentPublicId = null,
  onUpload,
  onDelete,
}) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const isImage = resourceType === 'image';

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    setProgress(0);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', UPLOAD_PRESET);
      if (folder) formData.append('folder', folder);

      const xhr = new XMLHttpRequest();
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const pct = Math.round((event.loaded / event.total) * 100);
          setProgress(pct);
        }
      };

      const result = await new Promise((resolve, reject) => {
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(JSON.parse(xhr.responseText));
          } else {
            reject(new Error('Upload failed: ' + xhr.status));
          }
        };
        xhr.onerror = () => reject(new Error('Network error'));
        xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType === 'raw' ? 'raw' : 'image'}/upload`);
        xhr.send(formData);
      });

      setProgress(100);
      setTimeout(() => { setProgress(0); setUploading(false); }, 500);
      onUpload?.(result.secure_url, result.public_id);
    } catch (err) {
      setError(err.message || 'Upload failed');
      setUploading(false);
      setProgress(0);
    }
    e.target.value = '';
  };

  const handleRemove = async () => {
    if (currentPublicId) {
      await deleteFromCloudinary(currentPublicId, resourceType === 'raw' ? 'raw' : 'image');
      onDelete?.(currentPublicId);
    }
  };

  return (
    <div className="space-y-2">
      <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{label}</label>

      {/* Current file preview */}
      {currentUrl && !uploading && (
        <div className="relative inline-block">
          {isImage ? (
            <img
              src={currentUrl}
              alt="Current"
              className="w-20 h-20 object-cover rounded-xl border border-white/10"
            />
          ) : (
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-800 rounded-xl border border-white/10">
              <FileText className="w-5 h-5 text-blue-400 shrink-0" />
              <span className="text-xs text-slate-300 truncate max-w-[140px]">Current file</span>
            </div>
          )}
          <button
            onClick={handleRemove}
            className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center hover:bg-red-400 transition-colors"
            title="Remove file"
          >
            <X className="w-3 h-3 text-white" />
          </button>
        </div>
      )}

      {/* Upload area */}
      {!currentUrl && !uploading && (
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-white/20 hover:border-blue-500/50 hover:bg-blue-500/5 transition-all text-slate-400 hover:text-blue-400 text-sm"
        >
          {isImage ? <Image className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
          {label}
        </button>
      )}

      {/* Upload progress */}
      {uploading && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
            <span>Uploading... {progress}%</span>
          </div>
          <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all duration-200 rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {error && (
        <p className="text-xs text-red-400 flex items-center gap-1">
          <X className="w-3 h-3" /> {error}
        </p>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}
