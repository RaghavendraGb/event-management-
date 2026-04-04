import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { CreatorCard } from '../../components/ece/CreatorCard';
import { FacultyCard } from '../../components/ece/FacultyCard';
import { Loader2, Building2, GraduationCap, Heart } from 'lucide-react';

export function EceOrganisation() {
  const [org, setOrg] = useState(null);
  const [creators, setCreators] = useState([]);
  const [faculty, setFaculty] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      supabase.from('ece_organisation').select('*').limit(1).single(),
      supabase.from('ece_creators').select('*').order('order_num'),
      supabase.from('ece_faculty').select('*').order('order_num'),
    ]).then(([orgRes, creatorsRes, facultyRes]) => {
      setOrg(orgRes.data);
      setCreators(creatorsRes.data || []);
      setFaculty(facultyRes.data || []);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-12">
      {/* Section 1: College Header */}
      <section className="text-center space-y-3">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-blue-500/20 border border-blue-500/30 mb-2">
          <Building2 className="w-8 h-8 text-blue-400" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-white leading-tight">
          {org?.college_name || 'East Point College of Engineering and Technology'}
        </h1>
        <p className="text-base text-blue-400 font-semibold">
          {org?.department || 'Department of Electronics and Communication Engineering'}
        </p>
        <p className="text-sm text-slate-500">Embedded Systems Resource Hub</p>
        <div className="h-px bg-white/8 max-w-xs mx-auto mt-4" />
      </section>

      {/* Section 2: HOD Dedication */}
      {org?.hod_name && (
        <section className="space-y-6">
          <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest text-center">
            Dedication
          </h2>
          <div className="p-6 rounded-3xl border border-blue-500/20 bg-blue-500/5 text-center space-y-3">
            <p className="text-slate-400 text-sm">This platform is dedicated to</p>
            <h3 className="text-xl font-black text-white">{org.hod_name}</h3>
            <p className="text-blue-400 text-sm font-semibold">HOD, ECE Department</p>
            {org.hod_message && (
              <blockquote className="max-w-xl mx-auto text-slate-300 text-sm italic leading-relaxed border-l-2 border-blue-500/40 pl-4 text-left">
                "{org.hod_message}"
              </blockquote>
            )}
          </div>
        </section>
      )}

      {/* Faculty */}
      {faculty.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest text-center">
            <GraduationCap className="inline w-4 h-4 mr-1 mb-0.5" />
            Faculty
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {faculty.map((f) => (
              <FacultyCard key={f.id} faculty={f} />
            ))}
          </div>
        </section>
      )}

      {/* Section 3: Creators */}
      {creators.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest text-center">
            <Heart className="inline w-4 h-4 mr-1 mb-0.5 text-pink-400" />
            Platform Creators
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {creators.map((c) => (
              <CreatorCard key={c.id} creator={c} />
            ))}
          </div>
        </section>
      )}

      {/* Section 4: Acknowledgements */}
      {org?.acknowledgements && (
        <section className="space-y-3">
          <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest text-center">
            Acknowledgements
          </h2>
          <div className="p-5 rounded-2xl border border-white/8 bg-slate-900/40">
            <p className="text-slate-400 text-sm leading-relaxed whitespace-pre-wrap">
              {org.acknowledgements}
            </p>
          </div>
        </section>
      )}
    </div>
  );
}
