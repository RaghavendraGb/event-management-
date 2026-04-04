import { useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { supabase, initClockOffset } from './lib/supabase';
import { useStore } from './store';
import { useNetworkStatus } from './lib/useNetworkStatus';
import { WifiOff } from 'lucide-react';
// Pages
import { Home } from './pages/Home';
import { Login } from './pages/Login';
import { Signup } from './pages/Signup';
import { Dashboard } from './pages/Dashboard';
import { Leaderboard } from './pages/Leaderboard';

// Event Pages
import { EventList } from './pages/events/EventList';
import { EventDetail } from './pages/events/EventDetail';

// Live Pages
import { Lobby } from './pages/live/Lobby';
import { LiveEvent } from './pages/live/LiveEvent';
import { Results } from './pages/live/Results';
import { Certificate } from './pages/live/Certificate';
import { Verify } from './pages/live/Verify';

// Admin Pages
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { AdminEvents } from './pages/admin/AdminEvents';
import { AdminQuestions } from './pages/admin/AdminQuestions';
import { AdminParticipants } from './pages/admin/AdminParticipants';
import { AdminUsers } from './pages/admin/AdminUsers';

function App() {
  const { setUser, setAuthLoading } = useStore();
  const networkStatus = useStore((state) => state.networkStatus);

  // Feature 5: Wire network intelligence hook (writes to store)
  useNetworkStatus();

  // FIX #28: generation counter — each auth event gets a unique id.
  // fetchProfile checks at the end if it's still the current request,
  // preventing a stale SIGNED_OUT from overwriting a fresh SIGNED_IN.
  const fetchGenRef = useRef(0);

  const fetchProfile = async (sessionUser) => {
    const myGen = ++fetchGenRef.current;

    if (!sessionUser) {
      if (fetchGenRef.current === myGen) {
        setUser(null);
        setAuthLoading(false);
      }
      return;
    }
    const { data: profile } = await supabase
      .from('users')
      .select('*')
      .eq('id', sessionUser.id)
      .single();

    // Abort if a newer auth event has already fired
    if (fetchGenRef.current !== myGen) return;

    // J: Block pending-approval AND rejected users from accessing the app
    if (profile?.status === 'pending' || profile?.status === 'rejected') {
      await supabase.auth.signOut();
      setUser(null);
      setAuthLoading(false);
      return;
    }

    setUser(profile || { id: sessionUser.id, role: 'user', email: sessionUser.email });
    setAuthLoading(false);
  };

  useEffect(() => {
    // Fix #1: Sync clock offset once so all timers compensate for client drift
    initClockOffset();

    // 1. Check active session on load
    supabase.auth.getSession().then(({ data: { session } }) => {
      fetchProfile(session?.user);
    });

    // 2. Listen for auth changes (login/logout/signup)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        // Only trigger loading state sequence if they are actually changing auth boundaries
        if (_event === 'SIGNED_OUT' || _event === 'SIGNED_IN') {
           setAuthLoading(true);
        }
        fetchProfile(session?.user);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [setUser, setAuthLoading]);

  return (
    <Router>
      <Routes>
        <Route element={<AppLayout />}>
          {/* Public / Generic Routes */}
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/events" element={<EventList />} />
          <Route path="/events/:id" element={<EventDetail />} />
          <Route path="/leaderboard/:id" element={<Leaderboard />} />
          <Route path="/verify/:cert_uid" element={<Verify />} />

          {/* Regular Protected Routes */}
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/lobby/:id" element={<Lobby />} />
            <Route path="/live/:id" element={<LiveEvent />} />
            <Route path="/results/:id" element={<Results />} />
            <Route path="/certificate/:id" element={<Certificate />} />
          </Route>

          {/* Admin Protected Routes */}
          <Route element={<ProtectedRoute requireAdmin />}>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/events" element={<AdminEvents />} />
            <Route path="/admin/questions" element={<AdminQuestions />} />
            <Route path="/admin/participants" element={<AdminParticipants />} />
            <Route path="/admin/users" element={<AdminUsers />} />
          </Route>
          
          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>

      {/* Global Offline PWA Modal — only for fully offline state */}
      {networkStatus === 'offline' && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center text-center p-6 select-none">
           <WifiOff className="w-24 h-24 text-slate-500 mb-6 animate-pulse" />
           <h2 className="text-3xl font-black text-white uppercase tracking-widest mb-2">Connection Lost</h2>
           <p className="text-slate-400 max-w-md bg-slate-900 border border-slate-800 p-4 rounded-xl leading-relaxed">
             You are securely offline. Don't panic! Your answers are aggressively saved natively in this browser window. 
             Connecting to the network will automatically resume your session.
           </p>
        </div>
      )}
    </Router>
  );
}

export default App;
