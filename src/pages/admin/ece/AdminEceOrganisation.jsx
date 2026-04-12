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

const Label = ({ children }) => (
  <label style={{ display: 'flex', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
    {children}
  </label>
);

export function AdminEceOrganisation() {
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
  const [opError, setOpError] = useState('');

  const clearOpError = () => setOpError('');

  const normalizeText = (value) => String(value || '').trim();

  const safeDeleteCloudinary = async (publicId, resourceType = 'image') => {
    if (!publicId) return;
    try {
      await deleteFromCloudinary(publicId, resourceType);
    } catch {
      // Keep UX resilient even if remote file cleanup fails.
    }
  };

  const loadData = async () => {
    setLoading(true);
    clearOpError();
    try {
      const [orgRes, creatorsRes, facultyRes] = await Promise.all([
        supabase.from('ece_organisation').select('*').limit(1).maybeSingle(),
        supabase.from('ece_creators').select('*').order('order_num'),
        supabase.from('ece_faculty').select('*').order('order_num'),
      ]);

      if (orgRes.error && orgRes.error.code !== 'PGRST116') {
        throw new Error(orgRes.error.message || 'Failed loading organisation data');
      }
      if (creatorsRes.error) throw new Error(creatorsRes.error.message || 'Failed loading creators');
      if (facultyRes.error) throw new Error(facultyRes.error.message || 'Failed loading faculty');

      if (orgRes.data) {
        setOrgId(orgRes.data.id);
        setOrgForm({ college_name: orgRes.data.college_name, department: orgRes.data.department, hod_name: orgRes.data.hod_name, hod_message: orgRes.data.hod_message || '', acknowledgements: orgRes.data.acknowledgements || '' });
      }

      setCreators(creatorsRes.data || []);
      setFaculty(facultyRes.data || []);
    } catch (err) {
      setOpError(err.message || 'Unable to load organisation data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadData();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  // -- Seed default creators if none exist --
  const handleSeedCreators = async () => {
    clearOpError();
    const { error } = await supabase.from('ece_creators').insert(DEFAULT_CREATORS);
    if (error) {
      setOpError(error.message || 'Unable to seed default creators.');
      return;
    }
    await loadData();
  };

  // --- Org save ---
  const handleSaveOrg = async (e) => {
    e.preventDefault();
    setSavingOrg(true);
    clearOpError();
    try {
      if (orgId) {
        const { error } = await supabase.from('ece_organisation').update({ ...orgForm, updated_at: new Date().toISOString() }).eq('id', orgId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('ece_organisation').insert(orgForm).select().single();
        if (error) throw error;
        setOrgId(data?.id);
      }
      await loadData();
    } catch (err) {
      setOpError(err.message || 'Unable to save organisation details.');
    } finally {
      setSavingOrg(false);
    }
  };

  // --- Faculty CRUD ---
  const handleFacultySubmit = async (e) => {
    e.preventDefault();
    setSavingFaculty(true);
    clearOpError();
    const payload = {
      ...facultyForm,
      name: normalizeText(facultyForm.name),
      designation: normalizeText(facultyForm.designation),
      quote: normalizeText(facultyForm.quote),
      photo_url: normalizeText(facultyForm.photo_url) || null,
      photo_public_id: normalizeText(facultyForm.photo_public_id) || null,
      order_num: Number(facultyForm.order_num) || 0,
    };
    try {
      if (editFacultyId) {
        const { error } = await supabase.from('ece_faculty').update(payload).eq('id', editFacultyId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('ece_faculty').insert(payload);
        if (error) throw error;
      }
      setShowFacultyForm(false);
      setEditFacultyId(null);
      setFacultyForm(EMPTY_FACULTY);
      await loadData();
    } catch (err) {
      setOpError(err.message || 'Unable to save faculty profile.');
    } finally {
      setSavingFaculty(false);
    }
  };

  const handleDeleteFaculty = async (f) => {
    if (!window.confirm(`Delete faculty "${f.name}"?`)) return;
    setDeletingFacultyId(f.id);
    clearOpError();
    try {
      await safeDeleteCloudinary(f.photo_public_id, 'image');
      const { error } = await supabase.from('ece_faculty').delete().eq('id', f.id);
      if (error) throw error;
      await loadData();
    } catch (err) {
      setOpError(err.message || 'Unable to delete faculty profile.');
    } finally {
      setDeletingFacultyId(null);
    }
  };

  // --- Creator CRUD ---
  const handleCreatorSubmit = async (e) => {
    e.preventDefault();
    setSavingCreator(true);
    clearOpError();
    const payload = {
      ...creatorForm,
      name: normalizeText(creatorForm.name),
      role: normalizeText(creatorForm.role),
      instagram: normalizeText(creatorForm.instagram) || null,
      github: normalizeText(creatorForm.github) || null,
      phone: normalizeText(creatorForm.phone) || null,
      photo_url: normalizeText(creatorForm.photo_url) || null,
      photo_public_id: normalizeText(creatorForm.photo_public_id) || null,
      order_num: Number(creatorForm.order_num) || 0,
    };
    try {
      if (editCreatorId) {
        const { error } = await supabase.from('ece_creators').update(payload).eq('id', editCreatorId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('ece_creators').insert(payload);
        if (error) throw error;
      }
      setShowCreatorForm(false);
      setEditCreatorId(null);
      setCreatorForm(EMPTY_CREATOR);
      await loadData();
    } catch (err) {
      setOpError(err.message || 'Unable to save creator profile.');
    } finally {
      setSavingCreator(false);
    }
  };

  const handleDeleteCreator = async (c) => {
    if (!window.confirm(`Delete creator "${c.name}"?`)) return;
    setDeletingCreatorId(c.id);
    clearOpError();
    try {
      await safeDeleteCloudinary(c.photo_public_id, 'image');
      const { error } = await supabase.from('ece_creators').delete().eq('id', c.id);
      if (error) throw error;
      await loadData();
    } catch (err) {
      setOpError(err.message || 'Unable to delete creator profile.');
    } finally {
      setDeletingCreatorId(null);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <Loader2 size={32} className="animate-spin" style={{ color: 'var(--blue)' }} />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-12">
      {opError && (
        <div style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.4)', color: '#fecaca', borderRadius: 10, padding: '10px 12px', fontSize: 12 }}>
          {opError}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 40 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Institution Control</h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 4 }}>Manage institutional identity, faculty directories, and platform credits.</p>
        </div>
      </div>

      {/* --- College Info --- */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <h2 style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Institutional Identity</h2>
        <form onSubmit={handleSaveOrg} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <Label>Educational Entity Name</Label>
              <input style={{ width: '100%', background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: 10, color: 'var(--text-primary)', fontSize: 13 }}
                value={orgForm.college_name} onChange={(e) => setOrgForm((f) => ({ ...f, college_name: e.target.value }))} />
            </div>
            <div>
              <Label>Department / Faculty</Label>
              <input style={{ width: '100%', background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: 10, color: 'var(--text-primary)', fontSize: 13 }}
                value={orgForm.department} onChange={(e) => setOrgForm((f) => ({ ...f, department: e.target.value }))} />
            </div>
          </div>
          <div>
            <Label>Head of Department (HOD)</Label>
            <input style={{ width: '100%', background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: 10, color: 'var(--text-primary)', fontSize: 13 }}
              value={orgForm.hod_name} onChange={(e) => setOrgForm((f) => ({ ...f, hod_name: e.target.value }))} placeholder="Dr. Yogesh G S" />
          </div>
          <div>
            <Label>HOD Message / Vision Statement</Label>
            <textarea style={{ width: '100%', background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: 10, color: 'var(--text-primary)', fontSize: 13, resize: 'none' }}
              value={orgForm.hod_message} onChange={(e) => setOrgForm((f) => ({ ...f, hod_message: e.target.value }))} rows={3} />
          </div>
          <div>
            <Label>Platform Acknowledgements</Label>
            <textarea style={{ width: '100%', background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: 10, color: 'var(--text-primary)', fontSize: 13, resize: 'none' }}
              value={orgForm.acknowledgements} onChange={(e) => setOrgForm((f) => ({ ...f, acknowledgements: e.target.value }))} rows={4} placeholder="Recognizing contributors and supporters…" />
          </div>
          <button type="submit" disabled={savingOrg} className="btn-primary" style={{ padding: '12px 24px', alignSelf: 'flex-start' }}>
            {savingOrg ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            Commit Institutional Updates
          </button>
        </form>
      </section>

      {/* --- Faculty --- */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Academic Staff</h2>
          <button onClick={() => { setShowFacultyForm(!showFacultyForm); setFacultyForm(EMPTY_FACULTY); setEditFacultyId(null); }}
            className="btn-ghost" style={{ fontSize: 11, background: 'var(--elevated)' }}>
            <Plus size={14} /> Onboard Faculty
          </button>
        </div>

        {showFacultyForm && (
          <form onSubmit={handleFacultySubmit} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderLeft: '4px solid var(--blue)', borderRadius: 12, padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <Label>Full Name *</Label>
                <input required style={{ width: '100%', background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: 10, color: 'var(--text-primary)', fontSize: 13 }}
                  value={facultyForm.name} onChange={(e) => setFacultyForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <Label>Academic Designation</Label>
                <input style={{ width: '100%', background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: 10, color: 'var(--text-primary)', fontSize: 13 }}
                  value={facultyForm.designation} onChange={(e) => setFacultyForm((f) => ({ ...f, designation: e.target.value }))} placeholder="Associate Professor" />
              </div>
            </div>
            <div>
              <Label>Distinguished Wisdom / Quote</Label>
              <input style={{ width: '100%', background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: 10, color: 'var(--text-primary)', fontSize: 13 }}
                value={facultyForm.quote} onChange={(e) => setFacultyForm((f) => ({ ...f, quote: e.target.value }))} placeholder="Message to the students…" />
            </div>
            
            <Label>Portrait Upload</Label>
            <div style={{ display: 'flex', justifyContent: 'center', padding: 20, background: 'var(--elevated)', borderRadius: 8, border: '1px solid var(--border)' }}>
              <CloudinaryUpload
                folder="ece_hub/faculty" resourceType="image" accept="image/*" label="Select High-Res Portrait"
                currentUrl={facultyForm.photo_url} currentPublicId={facultyForm.photo_public_id}
                onUpload={async (url, pid) => {
                  if (facultyForm.photo_public_id && facultyForm.photo_public_id !== pid) {
                    await safeDeleteCloudinary(facultyForm.photo_public_id, 'image');
                  }
                  setFacultyForm((f) => ({ ...f, photo_url: url, photo_public_id: pid }));
                }}
                onDelete={async () => {
                  setFacultyForm((f) => ({ ...f, photo_url: '', photo_public_id: '' }));
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: 12, paddingTop: 12 }}>
              <button type="submit" disabled={savingFaculty} className="btn-primary" style={{ flex: 1, padding: '12px 0' }}>
                {savingFaculty ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                {editFacultyId ? 'Verify & Update Record' : 'Create Staff Profile'}
              </button>
            </div>
          </form>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
          {faculty.map((f) => (
            <div key={f.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
              {f.photo_url ? (
                <img src={f.photo_url} alt={f.name} style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', background: 'var(--elevated)' }} />
              ) : (
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <User size={20} style={{ color: 'var(--text-muted)' }} />
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{f.name}</p>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{f.designation}</p>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button onClick={() => { setFacultyForm({ name: f.name, designation: f.designation || '', quote: f.quote || '', photo_url: f.photo_url || '', photo_public_id: f.photo_public_id || '', order_num: f.order_num }); setEditFacultyId(f.id); setShowFacultyForm(true); }}
                  className="btn-ghost" style={{ padding: 8, minHeight: 'unset' }}>
                  <Pencil size={14} />
                </button>
                <button onClick={() => handleDeleteFaculty(f)} disabled={deletingFacultyId === f.id}
                  className="btn-ghost" style={{ padding: 8, minHeight: 'unset', color: 'var(--red)' }}>
                  {deletingFacultyId === f.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                </button>
              </div>
            </div>
          ))}
        </div>
        {faculty.length === 0 && <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, padding: '20px 0' }}>No academic records initialized.</p>}
      </section>

      {/* --- Creators --- */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Development Syndicate</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            {creators.length === 0 && (
              <button onClick={handleSeedCreators}
                className="btn-ghost" style={{ fontSize: 11, background: 'rgba(59,130,246,0.1)', color: 'var(--blue)' }}>
                Initialize Defaults
              </button>
            )}
            <button onClick={() => { setShowCreatorForm(!showCreatorForm); setCreatorForm(EMPTY_CREATOR); setEditCreatorId(null); }}
              className="btn-ghost" style={{ fontSize: 11, background: 'var(--elevated)' }}>
              <Plus size={14} /> New Architect
            </button>
          </div>
        </div>

        {showCreatorForm && (
          <form onSubmit={handleCreatorSubmit} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderLeft: '4px solid var(--blue)', borderRadius: 12, padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <Label>Architect Name *</Label>
                <input required style={{ width: '100%', background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: 10, color: 'var(--text-primary)', fontSize: 13 }}
                  value={creatorForm.name} onChange={(e) => setCreatorForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <Label>Strategic Role *</Label>
                <input required style={{ width: '100%', background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: 10, color: 'var(--text-primary)', fontSize: 13 }}
                  value={creatorForm.role} onChange={(e) => setCreatorForm((f) => ({ ...f, role: e.target.value }))} placeholder="Lead Systems Architect" />
              </div>
              <div>
                <Label>Social Handle (Instagram)</Label>
                <input style={{ width: '100%', background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: 10, color: 'var(--text-primary)', fontSize: 13 }}
                  value={creatorForm.instagram} onChange={(e) => setCreatorForm((f) => ({ ...f, instagram: e.target.value }))} placeholder="@handle" />
              </div>
              <div>
                <Label>Protocol ID (GitHub)</Label>
                <input style={{ width: '100%', background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: 10, color: 'var(--text-primary)', fontSize: 13 }}
                  value={creatorForm.github} onChange={(e) => setCreatorForm((f) => ({ ...f, github: e.target.value }))} placeholder="username" />
              </div>
              <div>
                <Label>Direct Comms (Phone)</Label>
                <input style={{ width: '100%', background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: 10, color: 'var(--text-primary)', fontSize: 13 }}
                  value={creatorForm.phone} onChange={(e) => setCreatorForm((f) => ({ ...f, phone: e.target.value }))} placeholder="+91 98765 43210" />
              </div>
              <div>
                <Label>Sequential Order</Label>
                <input type="number" style={{ width: '100%', background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: 10, color: 'var(--text-primary)', fontSize: 13 }}
                  value={creatorForm.order_num} onChange={(e) => setCreatorForm((f) => ({ ...f, order_num: e.target.value }))} />
              </div>
            </div>

            <Label>Identity Matrix (Photo)</Label>
            <div style={{ display: 'flex', justifyContent: 'center', padding: 20, background: 'var(--elevated)', borderRadius: 8, border: '1px solid var(--border)' }}>
              <CloudinaryUpload
                folder="ece_hub/creators" resourceType="image" accept="image/*" label="Select High-Res Identity Photo"
                currentUrl={creatorForm.photo_url} currentPublicId={creatorForm.photo_public_id}
                onUpload={async (url, pid) => {
                  if (creatorForm.photo_public_id && creatorForm.photo_public_id !== pid) {
                    await safeDeleteCloudinary(creatorForm.photo_public_id, 'image');
                  }
                  setCreatorForm((f) => ({ ...f, photo_url: url, photo_public_id: pid }));
                }}
                onDelete={async () => {
                  setCreatorForm((f) => ({ ...f, photo_url: '', photo_public_id: '' }));
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: 12, paddingTop: 12 }}>
              <button type="submit" disabled={savingCreator} className="btn-primary" style={{ flex: 1, padding: '12px 0' }}>
                {savingCreator ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                {editCreatorId ? 'Verify & Update Identity' : 'Authorize New Architect'}
              </button>
            </div>
          </form>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
          {creators.map((c) => (
            <div key={c.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
              {c.photo_url ? (
                <img src={c.photo_url} alt={c.name} style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover', background: 'var(--elevated)' }} />
              ) : (
                <div style={{ width: 48, height: 48, borderRadius: 8, background: 'var(--elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <User size={20} style={{ color: 'var(--text-muted)' }} />
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{c.name}</p>
                <p style={{ fontSize: 11, color: 'var(--blue)', marginTop: 2, fontWeight: 600 }}>{c.role}</p>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button onClick={() => { setCreatorForm({ name: c.name, role: c.role, instagram: c.instagram || '', github: c.github || '', phone: c.phone || '', photo_url: c.photo_url || '', photo_public_id: c.photo_public_id || '', order_num: c.order_num }); setEditCreatorId(c.id); setShowCreatorForm(true); }}
                  className="btn-ghost" style={{ padding: 8, minHeight: 'unset' }}>
                  <Pencil size={14} />
                </button>
                <button onClick={() => handleDeleteCreator(c)} disabled={deletingCreatorId === c.id}
                  className="btn-ghost" style={{ padding: 8, minHeight: 'unset', color: 'var(--red)' }}>
                  {deletingCreatorId === c.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                </button>
              </div>
            </div>
          ))}
        </div>
        {creators.length === 0 && <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, padding: '20px 0' }}>Development Syndicate unassigned.</p>}
      </section>
    </div>
  );
}
