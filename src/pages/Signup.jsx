import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { UserCheck, Clock, UserPlus } from 'lucide-react';

export function Signup() {
  const navigate = useNavigate();
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
        data: {
          full_name: name,
          college: college
        }
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
      <div className="flex flex-col items-center justify-center min-h-[75vh] px-4 py-8">
        <div className="glass-card w-full max-w-sm sm:max-w-md p-6 sm:p-10 text-center space-y-5">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-blue-500/20 border border-blue-500/40 flex items-center justify-center mx-auto shadow-[0_0_30px_rgba(37,99,235,0.3)]">
            <Clock className="w-8 h-8 sm:w-10 sm:h-10 text-blue-400" />
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white uppercase tracking-wide">Registration Submitted!</h2>
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 text-left space-y-2">
            <div className="flex items-center gap-2 text-blue-400 font-bold text-xs uppercase tracking-wider">
              <UserCheck className="w-4 h-4 shrink-0" /> Pending Admin Approval
            </div>
            <p className="text-slate-300 text-sm leading-relaxed">
              Your account has been registered and is awaiting administrator approval.
              Once approved, you can log in with your email and password.
            </p>
            <p className="text-slate-500 text-xs break-all">
              Registered: <span className="text-slate-300 font-mono">{email}</span>
            </p>
          </div>
          <Link
            to="/login"
            className="block w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold transition-all text-sm uppercase tracking-widest"
          >
            Back to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[75vh] px-4 py-8">
      <div className="glass-card w-full max-w-sm sm:max-w-md p-6 sm:p-8">

        <div className="flex flex-col items-center mb-6 text-center">
          <div className="w-12 h-12 rounded-2xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center mb-4">
            <UserPlus className="w-6 h-6 text-purple-400" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white">Create Account</h2>
          <p className="text-sm text-slate-400 mt-1">Registration requires admin approval to log in.</p>
        </div>
        
        {errorMsg && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-xl text-red-200 text-sm">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSignup} className="space-y-4">
          {[
            { label: 'Full Name',     type: 'text',     value: name,     setter: setName,     placeholder: 'John Doe',                   ac: 'name' },
            { label: 'College Name',  type: 'text',     value: college,  setter: setCollege,  placeholder: 'University of Technology',   ac: 'organization' },
            { label: 'Email Address', type: 'email',    value: email,    setter: setEmail,    placeholder: 'you@college.edu',            ac: 'email' },
            { label: 'Password',      type: 'password', value: password, setter: setPassword, placeholder: '••••••••',                   ac: 'new-password', minLength: 6 },
          ].map(({ label, type, value, setter, placeholder, ac, minLength }) => (
            <div key={label}>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">{label}</label>
              <input 
                type={type}
                required
                autoComplete={ac}
                minLength={minLength}
                value={value}
                onChange={(e) => setter(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all text-base" 
                placeholder={placeholder}
              />
            </div>
          ))}

          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold mt-2 disabled:opacity-50 transition-all shadow-[0_0_15px_rgba(37,99,235,0.4)] hover:shadow-[0_0_25px_rgba(37,99,235,0.6)] active:scale-[0.98] text-base"
          >
            {loading ? 'Submitting...' : 'Request Account'}
          </button>
        </form>

        <p className="mt-6 text-center text-slate-400 text-sm">
          Already approved?{' '}
          <Link to="/login" className="text-blue-400 hover:text-blue-300 font-medium">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
