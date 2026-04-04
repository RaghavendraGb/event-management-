import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { deleteFromCloudinary } from '../../../lib/cloudinary';
import { CloudinaryUpload } from '../../../components/ece/CloudinaryUpload';
import { Building2, Plus, Trash2, Loader2, Check, X, Pencil, GripVertical, User } from 'lucide-react';

const DEFAULT_ORG = { college_name: 'East Point College of Engineering and Technology', department: 'Department of Electronics and Communication Engineering', hod_name: 'Dr. Yogesh G S', hod_message: '', acknowledgements: '' };

const DEFAULT_CREATORS = [
  { name: 'URAVAKONDA ABUBAKAR SIDDIK', role: 'Lead Developer', instagram: '@abubakar_dev', github: 'abubakar-siddik', phone: '+91 98765 43210', photo_url: '', photo_public_id: '', order_num: 0 },
  { name: 'RAHUL SHARMA', role: 'Frontend Developer', instagram: '@rahul_dev', github: 'rahul-sharma', phone: '+91 98765 43211', photo_url: '', photo_public_id: '', order_num: 1 },
  { name: 'PRIYA KUMAR', role: 'Content & Design', instagram: '@priya_design', github: 'priya-kumar', phone: '+91 98765 43212', photo_url: '', photo_public_id: '', order_num: 2 },
];

const EMPTY_FACULTY = { name: '', designation: '', quote: '', photo_url: '', photo_public_id: '', order_num: 0 };
const EMPTY_CREATOR = { name: '', role: '', instagram: '', github: '', phone: '', photo_url: '', photo_public_id: '', order_num: 0 };

export function AdminEceOrganisation() {
  const [org, setOrg] = useState(null);
  const [orgId, setOrgId] = useState(null);
  const [creators, setCreators] = useState([]);
  const [faculty, setFaculty] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingOrg, setSavingOrg] = useState(false);
  const [orgForm, setOrgForm] = useState(DEFAULT_ORG);

  // Faculty form
  const [showFacultyForm, setShowFacultyForm] = useState(false);
  const [facultyForm, setFacultyForm] = useState(EMPTY_FACULTY);
  const [editFacultyId, setEditFacultyId] = useState(null);
  const [savingFaculty, setSavingFaculty] = useState(false);
  const [deletingFacultyId, setDeletingFacultyId] = useState(null);

  // Creator form
  const [showCreatorForm, setShowCreatorForm] = useState(false);
  const [creatorForm, setCreatorForm] = useState(EMPTY_CREATOR);
  const [editCreatorId, setEditCreatorId] = useState(null);
  const [savingCreator, setSavingCreator] = useState(false);
  const [deletingCreatorId, setDeletingCreatorId] = useState(null);

  const loadData = async () => {
    const [orgRes, creatorsRes, facultyRes] = await Promise.all([
      supabase.from('ece_organisation').select('*').limit(1).single(),
      supabase.from('ece_creators').select('*').order('order_num'),
      supabase.from('ece_faculty').select('*').order('order_num'),
    ]);
    if (orgRes.data) {
      setOrg(orgRes.data);
      setOrgId(orgRes.data.id);
      setOrgForm({ college_name: orgRes.data.college_name, department: orgRes.data.department, hod_name: orgRes.data.hod_name, hod_message: orgRes.data.hod_message || '', acknowledgements: orgRes.data.acknowledgements || '' });
    }
    setCreators(creatorsRes.data || []);
    setFaculty(facultyRes.data || []);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  // -- Seed default creators if none exist --
  const handleSeedCreators = async () => {
    await supabase.from('ece_creators').insert(DEFAULT_CREATORS);
    loadData();
  };

  // --- Org save ---
  const handleSaveOrg = async (e) => {
    e.preventDefault();
    setSavingOrg(true);
    if (orgId) {
      await supabase.from('ece_organisation').update({ ...orgForm, updated_at: new Date().toISOString() }).eq('id', orgId);
    } else {
      const { data } = await supabase.from('ece_organisation').insert(orgForm).select().single();
      setOrgId(data?.id);
    }
    setSavingOrg(false);
    loadData();
  };

  // --- Faculty CRUD ---
  const handleFacultySubmit = async (e) => {
    e.preventDefault();
    setSavingFaculty(true);
    const payload = { ...facultyForm, name: facultyForm.name.trim(), order_num: Number(facultyForm.order_num) || 0 };
    if (editFacultyId) {
      await supabase.from('ece_faculty').update(payload).eq('id', editFacultyId);
    } else {
      await supabase.from('ece_faculty').insert(payload);
    }
    setSavingFaculty(false);
    setShowFacultyForm(false);
    setEditFacultyId(null);
    setFacultyForm(EMPTY_FACULTY);
    loadData();
  };

  const handleDeleteFaculty = async (f) => {
    if (!window.confirm(`Delete faculty "${f.name}"?`)) return;
    setDeletingFacultyId(f.id);
    if (f.photo_public_id) await deleteFromCloudinary(f.photo_public_id, 'image');
    await supabase.from('ece_faculty').delete().eq('id', f.id);
    setDeletingFacultyId(null);
    loadData();
  };

  // --- Creator CRUD ---
  const handleCreatorSubmit = async (e) => {
    e.preventDefault();
    setSavingCreator(true);
    const payload = { ...creatorForm, name: creatorForm.name.trim(), order_num: Number(creatorForm.order_num) || 0 };
    if (editCreatorId) {
      await supabase.from('ece_creators').update(payload).eq('id', editCreatorId);
    } else {
      await supabase.from('ece_creators').insert(payload);
    }
    setSavingCreator(false);
    setShowCreatorForm(false);
    setEditCreatorId(null);
    setCreatorForm(EMPTY_CREATOR);
    loadData();
  };

  const handleDeleteCreator = async (c) => {
    if (!window.confirm(`Delete creator "${c.name}"?`)) return;
    setDeletingCreatorId(c.id);
    if (c.photo_public_id) await deleteFromCloudinary(c.photo_public_id, 'image');
    await supabase.from('ece_creators').delete().eq('id', c.id);
    setDeletingCreatorId(null);
    loadData();
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-blue-400" /></div>;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-10">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-blue-500/20 flex items-center justify-center">
          <Building2 className="w-5 h-5 text-blue-400" />
        </div>
        <h1 className="text-xl font-black text-white">Manage Organisation</h1>
      </div>

      {/* --- College Info --- */}
      <section className="space-y-4">
        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest">College Information</h2>
        <form onSubmit={handleSaveOrg} className="p-5 rounded-2xl border border-white/10 bg-slate-900/60 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="admin-label">College Name</label>
              <input className="ece-input" value={orgForm.college_name} onChange={(e) => setOrgForm((f) => ({ ...f, college_name: e.target.value }))} />
            </div>
            <div>
              <label className="admin-label">Department</label>
              <input className="ece-input" value={orgForm.department} onChange={(e) => setOrgForm((f) => ({ ...f, department: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="admin-label">HOD Name</label>
            <input className="ece-input" value={orgForm.hod_name} onChange={(e) => setOrgForm((f) => ({ ...f, hod_name: e.target.value }))} placeholder="Dr. Yogesh G S" />
          </div>
          <div>
            <label className="admin-label">HOD Message / Quote</label>
            <textarea className="ece-textarea" value={orgForm.hod_message} onChange={(e) => setOrgForm((f) => ({ ...f, hod_message: e.target.value }))} rows={3} />
          </div>
          <div>
            <label className="admin-label">Acknowledgements</label>
            <textarea className="ece-textarea" value={orgForm.acknowledgements} onChange={(e) => setOrgForm((f) => ({ ...f, acknowledgements: e.target.value }))} rows={4} placeholder="Special thanks to…" />
          </div>
          <button type="submit" disabled={savingOrg} className="ece-btn-primary flex items-center gap-2">
            {savingOrg ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Save College Info
          </button>
        </form>
      </section>

      {/* --- Faculty --- */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Faculty</h2>
          <button onClick={() => { setShowFacultyForm(!showFacultyForm); setFacultyForm(EMPTY_FACULTY); setEditFacultyId(null); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-sm font-bold text-slate-200 transition-colors">
            <Plus className="w-4 h-4" /> Add Faculty
          </button>
        </div>

        {showFacultyForm && (
          <form onSubmit={handleFacultySubmit} className="p-5 rounded-2xl border border-white/10 bg-slate-900/60 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="admin-label">Name *</label>
                <input className="ece-input" value={facultyForm.name} onChange={(e) => setFacultyForm((f) => ({ ...f, name: e.target.value }))} required />
              </div>
              <div>
                <label className="admin-label">Designation</label>
                <input className="ece-input" value={facultyForm.designation} onChange={(e) => setFacultyForm((f) => ({ ...f, designation: e.target.value }))} placeholder="Assistant Professor" />
              </div>
            </div>
            <div>
              <label className="admin-label">Wisdom Quote</label>
              <input className="ece-input" value={facultyForm.quote} onChange={(e) => setFacultyForm((f) => ({ ...f, quote: e.target.value }))} placeholder="'Learn, unlearn, relearn.'" />
            </div>
            <CloudinaryUpload
              folder="ece_hub/faculty"
              resourceType="image"
              accept="image/*"
              label="Faculty Photo"
              currentUrl={facultyForm.photo_url}
              currentPublicId={facultyForm.photo_public_id}
              onUpload={(url, pid) => setFacultyForm((f) => ({ ...f, photo_url: url, photo_public_id: pid }))}
              onDelete={async (pid) => { await deleteFromCloudinary(pid, 'image'); setFacultyForm((f) => ({ ...f, photo_url: '', photo_public_id: '' })); }}
            />
            <div className="flex gap-3">
              <button type="submit" disabled={savingFaculty} className="ece-btn-primary flex items-center gap-2">
                {savingFaculty ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {editFacultyId ? 'Update' : 'Add'}
              </button>
              <button type="button" onClick={() => setShowFacultyForm(false)} className="ece-btn-secondary flex items-center gap-2"><X className="w-4 h-4" /> Cancel</button>
            </div>
          </form>
        )}

        <div className="space-y-2">
          {faculty.map((f) => (
            <div key={f.id} className="flex items-center gap-3 p-4 rounded-2xl border border-white/8 bg-slate-900/60">
              {f.photo_url ? (
                <img src={f.photo_url} alt={f.name} className="w-10 h-10 rounded-full object-cover shrink-0" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center shrink-0"><User className="w-5 h-5 text-slate-500" /></div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-200">{f.name}</p>
                <p className="text-xs text-slate-500">{f.designation}</p>
              </div>
              <div className="flex gap-1 shrink-0">
                <button onClick={() => { setFacultyForm({ name: f.name, designation: f.designation || '', quote: f.quote || '', photo_url: f.photo_url || '', photo_public_id: f.photo_public_id || '', order_num: f.order_num }); setEditFacultyId(f.id); setShowFacultyForm(true); }}
                  className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-500 hover:text-white transition-colors">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => handleDeleteFaculty(f)} disabled={deletingFacultyId === f.id}
                  className="p-1.5 rounded-lg hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition-colors">
                  {deletingFacultyId === f.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          ))}
          {faculty.length === 0 && <p className="text-xs text-slate-600 text-center py-4">No faculty added yet.</p>}
        </div>
      </section>

      {/* --- Creators --- */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Creators</h2>
          <div className="flex gap-2">
            {creators.length === 0 && (
              <button onClick={handleSeedCreators}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 text-xs font-bold transition-colors">
                Seed Defaults
              </button>
            )}
            <button onClick={() => { setShowCreatorForm(!showCreatorForm); setCreatorForm(EMPTY_CREATOR); setEditCreatorId(null); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-sm font-bold text-slate-200 transition-colors">
              <Plus className="w-4 h-4" /> Add Creator
            </button>
          </div>
        </div>

        {showCreatorForm && (
          <form onSubmit={handleCreatorSubmit} className="p-5 rounded-2xl border border-white/10 bg-slate-900/60 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="admin-label">Name *</label>
                <input className="ece-input" value={creatorForm.name} onChange={(e) => setCreatorForm((f) => ({ ...f, name: e.target.value }))} required />
              </div>
              <div>
                <label className="admin-label">Role *</label>
                <input className="ece-input" value={creatorForm.role} onChange={(e) => setCreatorForm((f) => ({ ...f, role: e.target.value }))} required placeholder="Lead Developer" />
              </div>
              <div>
                <label className="admin-label">Instagram</label>
                <input className="ece-input" value={creatorForm.instagram} onChange={(e) => setCreatorForm((f) => ({ ...f, instagram: e.target.value }))} placeholder="@handle" />
              </div>
              <div>
                <label className="admin-label">GitHub</label>
                <input className="ece-input" value={creatorForm.github} onChange={(e) => setCreatorForm((f) => ({ ...f, github: e.target.value }))} placeholder="username" />
              </div>
              <div>
                <label className="admin-label">Phone</label>
                <input className="ece-input" value={creatorForm.phone} onChange={(e) => setCreatorForm((f) => ({ ...f, phone: e.target.value }))} placeholder="+91 98765 43210" />
              </div>
              <div>
                <label className="admin-label">Order</label>
                <input type="number" className="ece-input" value={creatorForm.order_num} onChange={(e) => setCreatorForm((f) => ({ ...f, order_num: e.target.value }))} />
              </div>
            </div>
            <CloudinaryUpload
              folder="ece_hub/creators"
              resourceType="image"
              accept="image/*"
              label="Creator Photo"
              currentUrl={creatorForm.photo_url}
              currentPublicId={creatorForm.photo_public_id}
              onUpload={(url, pid) => setCreatorForm((f) => ({ ...f, photo_url: url, photo_public_id: pid }))}
              onDelete={async (pid) => { await deleteFromCloudinary(pid, 'image'); setCreatorForm((f) => ({ ...f, photo_url: '', photo_public_id: '' })); }}
            />
            <div className="flex gap-3">
              <button type="submit" disabled={savingCreator} className="ece-btn-primary flex items-center gap-2">
                {savingCreator ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {editCreatorId ? 'Update' : 'Add'}
              </button>
              <button type="button" onClick={() => setShowCreatorForm(false)} className="ece-btn-secondary flex items-center gap-2"><X className="w-4 h-4" /> Cancel</button>
            </div>
          </form>
        )}

        <div className="space-y-2">
          {creators.map((c) => (
            <div key={c.id} className="flex items-center gap-3 p-4 rounded-2xl border border-white/8 bg-slate-900/60">
              {c.photo_url ? (
                <img src={c.photo_url} alt={c.name} className="w-10 h-10 rounded-full object-cover shrink-0" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center shrink-0"><User className="w-5 h-5 text-slate-500" /></div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-200">{c.name}</p>
                <p className="text-xs text-blue-400">{c.role}</p>
              </div>
              <div className="flex gap-1 shrink-0">
                <button onClick={() => { setCreatorForm({ name: c.name, role: c.role, instagram: c.instagram || '', github: c.github || '', phone: c.phone || '', photo_url: c.photo_url || '', photo_public_id: c.photo_public_id || '', order_num: c.order_num }); setEditCreatorId(c.id); setShowCreatorForm(true); }}
                  className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-500 hover:text-white transition-colors">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => handleDeleteCreator(c)} disabled={deletingCreatorId === c.id}
                  className="p-1.5 rounded-lg hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition-colors">
                  {deletingCreatorId === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          ))}
          {creators.length === 0 && <p className="text-xs text-slate-600 text-center py-4">No creators yet. Click "Seed Defaults" to add the 3 placeholder creators.</p>}
        </div>
      </section>
    </div>
  );
}
