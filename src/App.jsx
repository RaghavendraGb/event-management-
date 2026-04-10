import { Suspense, lazy, useCallback, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { supabase, initClockOffset } from './lib/supabase';
import { useStore } from './store';
import { useNetworkStatus } from './lib/useNetworkStatus';
import { WifiOff } from 'lucide-react';

const lazyNamed = (loader, exportName) =>
  lazy(() => loader().then((mod) => ({ default: mod[exportName] })));

const Home = lazyNamed(() => import('./pages/Home'), 'Home');
const Login = lazyNamed(() => import('./pages/Login'), 'Login');
const Signup = lazyNamed(() => import('./pages/Signup'), 'Signup');
const Dashboard = lazyNamed(() => import('./pages/Dashboard'), 'Dashboard');
const Leaderboard = lazyNamed(() => import('./pages/Leaderboard'), 'Leaderboard');
const Profile = lazyNamed(() => import('./pages/Profile'), 'Profile');
const EventList = lazyNamed(() => import('./pages/events/EventList'), 'EventList');
const EventDetail = lazyNamed(() => import('./pages/events/EventDetail'), 'EventDetail');
const Lobby = lazyNamed(() => import('./pages/live/Lobby'), 'Lobby');
const LiveEvent = lazyNamed(() => import('./pages/live/LiveEvent'), 'LiveEvent');
const Results = lazyNamed(() => import('./pages/live/Results'), 'Results');
const Certificate = lazyNamed(() => import('./pages/live/Certificate'), 'Certificate');
const Verify = lazyNamed(() => import('./pages/live/Verify'), 'Verify');
const LiveCoding = lazyNamed(() => import('./pages/live/LiveCoding'), 'LiveCoding');
const AdminCodingProblems = lazyNamed(() => import('./pages/admin/AdminCodingProblems'), 'AdminCodingProblems');
const AdminDashboard = lazyNamed(() => import('./pages/admin/AdminDashboard'), 'AdminDashboard');
const AdminEvents = lazyNamed(() => import('./pages/admin/AdminEvents'), 'AdminEvents');
const AdminQuestions = lazyNamed(() => import('./pages/admin/AdminQuestions'), 'AdminQuestions');
const AdminParticipants = lazyNamed(() => import('./pages/admin/AdminParticipants'), 'AdminParticipants');
const AdminUsers = lazyNamed(() => import('./pages/admin/AdminUsers'), 'AdminUsers');
const AdminSimulations = lazyNamed(() => import('./pages/admin/AdminSimulations'), 'AdminSimulations');
const EceHub = lazyNamed(() => import('./pages/ece/EceHub'), 'EceHub');
const EceTopic = lazyNamed(() => import('./pages/ece/EceTopic'), 'EceTopic');
const EceGallery = lazyNamed(() => import('./pages/ece/EceGallery'), 'EceGallery');
const EceNotices = lazyNamed(() => import('./pages/ece/EceNotices'), 'EceNotices');
const EceChat = lazyNamed(() => import('./pages/ece/EceChat'), 'EceChat');
const EceDoubts = lazyNamed(() => import('./pages/ece/EceDoubts'), 'EceDoubts');
const EceOrganisation = lazyNamed(() => import('./pages/ece/EceOrganisation'), 'EceOrganisation');
const AdminEceDashboard = lazyNamed(() => import('./pages/admin/ece/AdminEceDashboard'), 'AdminEceDashboard');
const AdminEceTopics = lazyNamed(() => import('./pages/admin/ece/AdminEceTopics'), 'AdminEceTopics');
const AdminEceResources = lazyNamed(() => import('./pages/admin/ece/AdminEceResources'), 'AdminEceResources');
const AdminEceGallery = lazyNamed(() => import('./pages/admin/ece/AdminEceGallery'), 'AdminEceGallery');
const AdminEceNotices = lazyNamed(() => import('./pages/admin/ece/AdminEceNotices'), 'AdminEceNotices');
const AdminEceDoubts = lazyNamed(() => import('./pages/admin/ece/AdminEceDoubts'), 'AdminEceDoubts');
const AdminEceChat = lazyNamed(() => import('./pages/admin/ece/AdminEceChat'), 'AdminEceChat');
const AdminEceQuotes = lazyNamed(() => import('./pages/admin/ece/AdminEceQuotes'), 'AdminEceQuotes');
const AdminEceOrganisation = lazyNamed(() => import('./pages/admin/ece/AdminEceOrganisation'), 'AdminEceOrganisation');

function RouteLoader() {
  return (
    <div className="h-screen bg-slate-950 flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-slate-800 border-t-blue-500 rounded-full animate-spin" />
    </div>
  );
}

function App() {
  const { setUser, setAuthLoading } = useStore();
  const networkStatus = useStore((state) => state.networkStatus);

  // Feature 5: Wire network intelligence hook (writes to store)
  useNetworkStatus();

  // FIX #28: generation counter — each auth event gets a unique id.
  // fetchProfile checks at the end if it's still the current request,
  // preventing a stale SIGNED_OUT from overwriting a fresh SIGNED_IN.
  const fetchGenRef = useRef(0);

  const fetchProfile = useCallback(async (sessionUser) => {
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
  }, [setAuthLoading, setUser]);

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
  }, [setUser, setAuthLoading, fetchProfile]);

  return (
    <Router>
      <Suspense fallback={<RouteLoader />}>
        <Routes>
          <Route element={<AppLayout />}>
          {/* Public / Generic Routes */}
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/events" element={<EventList />} />
          <Route path="/events/:id" element={<EventDetail />} />
          <Route path="/leaderboard/:id" element={<Leaderboard />} />
          <Route path="/profile/:userId" element={<Profile />} />
          <Route path="/verify/:cert_uid" element={<Verify />} />

          {/* Regular Protected Routes */}
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/lobby/:id" element={<Lobby />} />
            <Route path="/live/:id" element={<LiveEvent />} />
            <Route path="/results/:id" element={<Results />} />
            <Route path="/certificate/:id" element={<Certificate />} />
            <Route path="/live-coding/:id" element={<LiveCoding />} />
          </Route>

          {/* Admin Protected Routes */}
          <Route element={<ProtectedRoute requireAdmin />}>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/events" element={<AdminEvents />} />
            <Route path="/admin/questions" element={<AdminQuestions />} />
            <Route path="/admin/participants" element={<AdminParticipants />} />
            <Route path="/admin/users" element={<AdminUsers />} />
            <Route path="/admin/simulations" element={<AdminSimulations />} />
            <Route path="/admin/coding-problems" element={<AdminCodingProblems />} />
          </Route>

          {/* ECE Hub — Public Routes */}
          <Route path="/ece" element={<EceHub />} />
          <Route path="/ece/topic/:id" element={<EceTopic />} />
          <Route path="/ece/gallery" element={<EceGallery />} />
          <Route path="/ece/notices" element={<EceNotices />} />
          <Route path="/ece/organisation" element={<EceOrganisation />} />

          {/* ECE Hub — Auth Required Routes */}
          <Route element={<ProtectedRoute />}>
            <Route path="/ece/chat" element={<EceChat />} />
            <Route path="/ece/doubts" element={<EceDoubts />} />
          </Route>

          {/* ECE Hub — Admin Routes */}
          <Route element={<ProtectedRoute requireAdmin />}>
            <Route path="/admin/ece" element={<AdminEceDashboard />} />
            <Route path="/admin/ece/topics" element={<AdminEceTopics />} />
            <Route path="/admin/ece/resources" element={<AdminEceResources />} />
            <Route path="/admin/ece/gallery" element={<AdminEceGallery />} />
            <Route path="/admin/ece/notices" element={<AdminEceNotices />} />
            <Route path="/admin/ece/doubts" element={<AdminEceDoubts />} />
            <Route path="/admin/ece/chat" element={<AdminEceChat />} />
            <Route path="/admin/ece/quotes" element={<AdminEceQuotes />} />
            <Route path="/admin/ece/organisation" element={<AdminEceOrganisation />} />
          </Route>
          
          {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </Suspense>

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
