import { User, Quote } from 'lucide-react';

/**
 * Faculty wisdom card.
 * Props:
 *  - faculty: { name, designation, quote, photo_url }
 */
export function FacultyCard({ faculty }) {
  return (
    <div className="faculty-card">
      {/* Photo */}
      <div className="faculty-photo-wrap">
        {faculty.photo_url ? (
          <img src={faculty.photo_url} alt={faculty.name} className="faculty-photo" />
        ) : (
          <div className="faculty-photo-placeholder">
            <User className="w-7 h-7 text-slate-500" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="faculty-info">
        <h4 className="text-sm font-bold text-slate-200">{faculty.name}</h4>
        {faculty.designation && (
          <p className="text-xs text-slate-500 mb-2">{faculty.designation}</p>
        )}
        {faculty.quote && (
          <div className="flex gap-2">
            <Quote className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
            <p className="text-xs text-slate-400 italic leading-relaxed">"{faculty.quote}"</p>
          </div>
        )}
      </div>
    </div>
  );
}
