import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { UserCheck, Clock } from 'lucide-react';

export function Signup() {
  const [name, setName] = useState('');
  const [college, setCollege] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSignup = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name, college: college }
      }
    });

    if (error) {
      setErrorMsg(error.message);
    } else {
      await supabase.auth.signOut();
      setSuccess(true);
    }
    setLoading(false);
  };

  if (success) {
    return (
      <div style={{
        minHeight: '100dvh',
        background: 'var(--bg)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '2rem 1rem',
      }}>
        <div style={{
          width: '100%', maxWidth: 380,
          background: 'var(--surface)',
          border: '1px solid rgba(255,255,255,0.10)',
          borderRadius: 12, padding: 32,
          textAlign: 'center',
        }}>
          <div style={{
            width: 48, height: 48, borderRadius: 8,
            background: 'rgba(16,185,129,0.12)',
            border: '1px solid rgba(16,185,129,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
          }}>
            <Clock size={22} style={{ color: 'var(--green)' }} />
          </div>
          <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
            Registration Submitted
          </p>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.6 }}>
            Your account is awaiting admin approval. Once approved, you can sign in with your email and password.
          </p>
          <div style={{
            background: 'var(--elevated)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            padding: '10px 12px',
            marginBottom: 20,
            textAlign: 'left',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <UserCheck size={12} style={{ color: 'var(--green)' }} />
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pending Approval</span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', wordBreak: 'break-all' }}>{email}</p>
          </div>
          <Link to="/login" className="btn-ghost" style={{ display: 'block', textAlign: 'center', width: '100%' }}>
            Back to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100dvh',
      background: 'var(--bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '2rem 1rem',
    }}>
      <div style={{
        width: '100%', maxWidth: 380,
        background: 'var(--surface)',
        border: '1px solid rgba(255,255,255,0.10)',
        borderRadius: 12, padding: 32,
      }}>
        <div style={{ marginBottom: 24 }}>
          <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>Zentrix</p>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Create an account — requires admin approval</p>
        </div>

        {errorMsg && (
          <div style={{
            background: 'rgba(239,68,68,0.10)',
            border: '1px solid rgba(239,68,68,0.25)',
            borderRadius: 6, padding: '10px 12px',
            marginBottom: 16, fontSize: 13, color: 'var(--red)', lineHeight: 1.5,
          }}>
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[
            { id: 'signup-name',     label: 'Full Name',     type: 'text',     value: name,     setter: setName,     placeholder: 'John Doe',                   ac: 'name' },
            { id: 'signup-college',  label: 'College',       type: 'text',     value: college,  setter: setCollege,  placeholder: 'University of Technology',   ac: 'organization' },
            { id: 'signup-email',    label: 'Email Address', type: 'email',    value: email,    setter: setEmail,    placeholder: 'you@college.edu',            ac: 'email' },
            { id: 'signup-password', label: 'Password',      type: 'password', value: password, setter: setPassword, placeholder: '••••••••',                   ac: 'new-password', minLength: 6 },
          ].map(({ id, label, type, value, setter, placeholder, ac, minLength }) => (
            <div key={id}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>
                {label}
              </label>
              <input
                id={id}
                type={type}
                required
                autoComplete={ac}
                minLength={minLength}
                value={value}
                onChange={(e) => setter(e.target.value)}
                className="input"
                placeholder={placeholder}
              />
            </div>
          ))}

          <button
            type="submit"
            id="signup-submit"
            disabled={loading}
            className="btn-primary"
            style={{ width: '100%', justifyContent: 'center', padding: '9px 16px', marginTop: 4 }}
          >
            {loading ? 'Submitting...' : 'Request Account'}
          </button>
        </form>

        <p style={{ marginTop: 20, textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
          Already approved?{' '}
          <Link to="/login" style={{ color: 'var(--blue)', textDecoration: 'none', fontWeight: 500 }}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}
