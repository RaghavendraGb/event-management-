import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  Home, 
  CalendarDays, 
  LayoutDashboard, 
  Settings, 
  LogOut,
  Trophy,
  Users,
  UserCog,
  Menu,
  X,
  ChevronDown,
  ChevronUp,
  AlertTriangle
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '../../lib/utils';
import { useStore } from '../../store';
import { supabase } from '../../lib/supabase';

const navItems = [
  { name: 'Home',       path: '/',              icon: Home },
  { name: 'Dashboard',  path: '/dashboard',     icon: LayoutDashboard },
  { name: 'Events',     path: '/events',        icon: CalendarDays },
  { name: 'Leaderboard', path: '/leaderboard/public', icon: Trophy },
];

const adminItems = [
  { name: 'Admin',      path: '/admin',               icon: Settings },
  { name: 'Events',     path: '/admin/events',        icon: CalendarDays },
  { name: 'Questions',  path: '/admin/questions',     icon: Trophy },
  { name: 'Participants', path: '/admin/participants', icon: Users },
  { name: 'Users',      path: '/admin/users',         icon: UserCog },
];

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useStore((state) => state.user);
  const liveEventRuntime = useStore((state) => state.liveEventRuntime);
  const [isOpen, setIsOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  
  // Feature 4: live nav warning modal
  const [liveNavWarning, setLiveNavWarning] = useState(null); // target path | null

  const isAdmin = user?.role === 'admin';
  const isLiveActive = !!liveEventRuntime?.eventId;

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setIsOpen(false);
    navigate('/login');
  };

  /**
   * Feature 4: Intercept nav clicks during live event.
   * Shows in-app warning instead of navigating directly.
   */
  const handleNavClick = (e, path) => {
    if (isLiveActive && !path.startsWith('/live/')) {
      e.preventDefault();
      setLiveNavWarning(path);
    }
  };

  const confirmLeave = () => {
    const target = liveNavWarning;
    setLiveNavWarning(null);
    setIsOpen(false);
    navigate(target);
  };

  const cancelLeave = () => setLiveNavWarning(null);

  // Bottom nav only shows top 4 items (mobile)
  const bottomNavItems = [
    { name: 'Home',      path: '/',          icon: Home },
    { name: 'Events',    path: '/events',    icon: CalendarDays },
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    ...(isAdmin ? [{ name: 'Admin', path: '/admin', icon: Settings }] : []),
  ];

  const NavLink = ({ item, mobile = false }) => {
    const isActive = location.pathname === item.path;
    return (
      <Link
        to={item.path}
        onClick={(e) => {
          if (mobile) setIsOpen(false);
          handleNavClick(e, item.path);
        }}
        className={cn(
          mobile
            ? 'flex items-center gap-3 px-4 py-3 rounded-xl text-base font-medium transition-all duration-200'
            : 'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 min-w-0',
          isActive
            ? 'bg-blue-600/10 text-blue-400'
            : 'text-slate-300 hover:bg-slate-800 hover:text-white'
        )}
      >
        <item.icon className="w-5 h-5 shrink-0" />
        <span className={mobile ? '' : 'truncate'}>{item.name}</span>
      </Link>
    );
  };

  const AdminNavLink = ({ item, mobile = false }) => {
    const isActive = location.pathname === item.path;
    return (
      <Link
        to={item.path}
        onClick={() => { if (mobile) setIsOpen(false); }}
        className={cn(
          mobile
            ? 'flex items-center gap-3 px-4 py-3 rounded-xl text-base font-medium transition-all duration-200'
            : 'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 min-w-0',
          isActive
            ? 'bg-purple-600/10 text-purple-400'
            : 'text-slate-300 hover:bg-slate-800 hover:text-white'
        )}
      >
        <item.icon className="w-5 h-5 shrink-0" />
        <span className={mobile ? '' : 'truncate'}>{item.name}</span>
      </Link>
    );
  };

  return (
    <>
      {/* ── Feature 4: Live Event Nav Warning Modal ──── */}
      {liveNavWarning && (
        <div className="fixed inset-0 z-[500] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/30 rounded-2xl p-6 max-w-sm w-full shadow-2xl shadow-amber-500/10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h3 className="font-black text-white text-base">You're in a Live Event</h3>
                <p className="text-xs text-slate-400">Leaving will count as a tab violation</p>
              </div>
            </div>
            <p className="text-sm text-slate-300 mb-6 leading-relaxed">
              Navigating away from the live event will trigger an anti-cheat violation strike. Three strikes will auto-submit your session.
            </p>
            <div className="flex gap-3">
              <button
                onClick={cancelLeave}
                className="flex-1 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-sm transition-colors"
              >
                Stay in Event
              </button>
              <button
                onClick={confirmLeave}
                className="flex-1 px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-bold text-sm transition-colors"
              >
                Leave Anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DESKTOP SIDEBAR ─────────────────────────────── */}
      <div className="hidden lg:flex flex-col w-64 min-w-[16rem] shrink-0 border-r border-white/[0.06] bg-slate-900 glass h-screen sticky top-0 overflow-y-auto overflow-x-hidden">
        {/* Logo */}
        <div className="p-5 flex items-center gap-3 border-b border-white/[0.06]">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shadow-[0_0_15px_rgba(37,99,235,0.5)] shrink-0">
            <Trophy className="w-5 h-5 text-white" />
          </div>
          <span className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500 truncate">
            EventX
          </span>
        </div>

        {/* Live event indicator in sidebar */}
        {isLiveActive && (
          <div className="mx-3 mt-3 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/25 flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
            <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest truncate">
              Live Event Active
            </span>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 px-3">Menu</p>
          {navItems.map((item) => <NavLink key={item.path} item={item} />)}

          {/* Admin Section */}
          {isAdmin && (
            <>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-6 mb-3 px-3">Admin Gateway</p>
              {adminItems.map((item) => <AdminNavLink key={item.path} item={item} />)}
            </>
          )}
        </nav>

        {/* User Footer */}
        <div className="p-3 border-t border-white/[0.05]">
          {user ? (
            <div className="space-y-2">
              <div className="px-3 py-2 flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 uppercase text-sm font-bold">
                  {user.name?.charAt(0) || user.email?.charAt(0)}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-medium text-slate-200 truncate">{user.name || 'User'}</span>
                  <span className="text-xs text-slate-500 truncate">{user.college || user.role}</span>
                </div>
              </div>
              <button 
                onClick={handleSignOut}
                className="flex w-full items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:bg-red-500/10 hover:text-red-400 transition-colors"
              >
                <LogOut className="w-5 h-5 shrink-0" />
                Sign Out
              </button>
            </div>
          ) : (
            <Link to="/login" className="flex w-full items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors shadow-lg shadow-blue-500/20">
              Sign In
            </Link>
          )}
        </div>
      </div>

      {/* ── MOBILE: Topbar hamburger ─────────────────────── */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Toggle menu"
        className="lg:hidden fixed top-3 left-3 z-[60] p-2.5 rounded-xl bg-slate-900/90 border border-white/10 text-slate-300 hover:text-white backdrop-blur-md shadow-lg"
      >
        {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* ── MOBILE: Slide-over drawer ────────────────────── */}
      {isOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[50]"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Drawer panel */}
      <div className={cn(
        "lg:hidden fixed inset-y-0 left-0 z-[55] w-72 max-w-[85vw] bg-slate-900 border-r border-white/[0.06] flex flex-col transition-transform duration-300 ease-in-out overflow-y-auto overflow-x-hidden",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Logo */}
        <div className="p-5 flex items-center gap-3 border-b border-white/[0.06] pt-16">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shadow-[0_0_15px_rgba(37,99,235,0.5)] shrink-0">
            <Trophy className="w-5 h-5 text-white" />
          </div>
          <span className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
            EventX
          </span>
        </div>

        {isLiveActive && (
          <div className="mx-3 mt-3 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/25 flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
            <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">
              Live Event Active
            </span>
          </div>
        )}

        <nav className="flex-1 px-3 py-4 space-y-1">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 px-3">Menu</p>
          {navItems.map((item) => <NavLink key={item.path} item={item} mobile />)}

          {isAdmin && (
            <>
              {/* Collapsible admin section on mobile */}
              <button
                onClick={() => setAdminOpen(o => !o)}
                className="flex w-full items-center justify-between px-4 py-3 rounded-xl text-sm font-bold text-purple-400 hover:bg-purple-600/10 transition-colors mt-4"
              >
                <span className="uppercase tracking-widest text-[10px]">Admin Gateway</span>
                {adminOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {adminOpen && adminItems.map((item) => (
                <AdminNavLink key={item.path} item={item} mobile />
              ))}
            </>
          )}
        </nav>

        {/* User footer in drawer */}
        <div className="p-4 border-t border-white/[0.05]" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
          {user ? (
            <div className="space-y-3">
              <div className="px-2 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 uppercase font-bold">
                  {user.name?.charAt(0) || user.email?.charAt(0)}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-semibold text-slate-200 truncate">{user.name || 'User'}</span>
                  <span className="text-xs text-slate-500 truncate">{user.email}</span>
                </div>
              </div>
              <button 
                onClick={handleSignOut}
                className="flex w-full items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-slate-300 hover:bg-red-500/10 hover:text-red-400 transition-colors"
              >
                <LogOut className="w-5 h-5 shrink-0" />
                Sign Out
              </button>
            </div>
          ) : (
            <Link to="/login" onClick={() => setIsOpen(false)} className="flex w-full items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white transition-colors shadow-lg shadow-blue-500/20">
              Sign In
            </Link>
          )}
        </div>
      </div>

      {/* ── MOBILE: Bottom Navigation Bar ───────────────── */}
      <nav className="bottom-nav" aria-label="Mobile navigation">
        {bottomNavItems.map((item) => {
          const isActive = location.pathname === item.path || 
            (item.path === '/admin' && location.pathname.startsWith('/admin'));
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={(e) => handleNavClick(e, item.path)}
              className={cn(
                'flex flex-col items-center justify-center gap-1 px-2 pt-2 min-w-0 flex-1 text-center transition-colors',
                isActive ? 'text-blue-400' : 'text-slate-500 hover:text-slate-300'
              )}
            >
              <item.icon className="w-5 h-5 shrink-0" />
              <span className="text-[10px] font-bold tracking-wide truncate w-full text-center">{item.name}</span>
            </Link>
          );
        })}
        {/* Sign in shortcut when logged out */}
        {!user && (
          <Link
            to="/login"
            className="flex flex-col items-center justify-center gap-1 px-2 pt-2 min-w-0 flex-1 text-center text-blue-400"
          >
            <LogOut className="w-5 h-5 shrink-0" />
            <span className="text-[10px] font-bold tracking-wide">Sign In</span>
          </Link>
        )}
      </nav>
    </>
  );
}
