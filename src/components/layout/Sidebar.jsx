import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  Home, 
  CalendarDays, 
  LayoutDashboard, 
  Settings, 
  LogOut,
  Trophy,
  Users
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useStore } from '../../store';
import { supabase } from '../../lib/supabase';

const navItems = [
  { name: 'Home', path: '/', icon: Home },
  { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { name: 'Events', path: '/events', icon: CalendarDays },
  { name: 'Leaderboard', path: '/leaderboard/public', icon: Trophy },
];

const adminItems = [
  { name: 'Admin Dashboard', path: '/admin', icon: Settings },
  { name: 'Manage Events', path: '/admin/events', icon: CalendarDays },
  { name: 'Questions', path: '/admin/questions', icon: Trophy },
  { name: 'Participants', path: '/admin/participants', icon: Users },
];

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useStore((state) => state.user);
  
  // Real PostgreSQL role check
  const isAdmin = user?.role === 'admin';

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  return (
    <div className="w-64 h-screen border-r border-[rgba(255,255,255,0.08)] bg-slate-900 flex flex-col glass z-50">
      <div className="p-6 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shadow-[0_0_15px_rgba(37,99,235,0.5)]">
          <Trophy className="w-5 h-5 text-white" />
        </div>
        <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
          EventX
        </span>
      </div>

      <nav className="flex-1 px-4 space-y-2 overflow-y-auto w-full mb-4">
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4 mt-4 px-2">
          Menu
        </div>
        
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                isActive 
                  ? 'bg-blue-600/10 text-blue-400' 
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              )}
            >
              <item.icon className="w-5 h-5" />
              {item.name}
            </Link>
          );
        })}

        {isAdmin && (
          <>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4 mt-8 px-2">
              Admin Gateway
            </div>
            {adminItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                    isActive 
                      ? 'bg-purple-600/10 text-purple-400' 
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  )}
                >
                  <item.icon className="w-5 h-5" />
                  {item.name}
                </Link>
              );
            })}
          </>
        )}
      </nav>

      <div className="p-4 w-full border-t border-[rgba(255,255,255,0.05)] pt-4">
        {user ? (
          <div className="space-y-4">
            <div className="px-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 uppercase">
                {user.name?.charAt(0) || user.email?.charAt(0)}
              </div>
              <div className="flex flex-col truncate">
                <span className="text-sm font-medium text-slate-200 truncate">{user.name || 'User'}</span>
                <span className="text-xs text-slate-500 truncate">{user.college || user.role}</span>
              </div>
            </div>
            <button 
              onClick={handleSignOut}
              className="flex w-full items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:bg-red-500/10 hover:text-red-400 transition-colors"
            >
              <LogOut className="w-5 h-5" />
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
  );
}
