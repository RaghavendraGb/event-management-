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
  AlertTriangle,
  Cpu,
  Image,
  Bell,
  MessageSquare,
  CircleHelp,
  Building2,
  BookOpen,
  Quote,
  CodeXml,
  MonitorPlay,
  Zap,
} from 'lucide-react';
import { useState } from 'react';
import { useStore } from '../../store';
import { supabase } from '../../lib/supabase';

const navItems = [
  { name: 'Home',        path: '/',                   icon: Home },
  { name: 'Dashboard',   path: '/dashboard',          icon: LayoutDashboard },
  { name: 'Events',      path: '/events',             icon: CalendarDays },
  { name: 'Leaderboard', path: '/leaderboard/public', icon: Trophy },
];

const adminItems = [
  { name: 'Admin',            path: '/admin',                  icon: Settings },
  { name: 'Events',           path: '/admin/events',           icon: CalendarDays },
  { name: 'Coding Problems',  path: '/admin/coding-problems',  icon: CodeXml },
  { name: 'Questions',        path: '/admin/questions',        icon: Trophy },
  { name: 'Simulations',      path: '/admin/simulations',      icon: MonitorPlay },
  { name: 'Participants',     path: '/admin/participants',      icon: Users },
  { name: 'Users',            path: '/admin/users',            icon: UserCog },
];

const eceItems = [
  { name: 'ECE Home',       path: '/ece',               icon: Cpu },
  { name: 'Gallery',        path: '/ece/gallery',       icon: Image },
  { name: 'Notices',        path: '/ece/notices',       icon: Bell },
  { name: 'Community Chat', path: '/ece/chat',          icon: MessageSquare },
  { name: 'Doubts',         path: '/ece/doubts',        icon: CircleHelp },
  { name: 'Organisation',   path: '/ece/organisation',  icon: Building2 },
];

const eceAdminItems = [
  { name: 'ECE Dashboard',  path: '/admin/ece',               icon: LayoutDashboard },
  { name: 'Topics',         path: '/admin/ece/topics',        icon: Cpu },
  { name: 'Resources',      path: '/admin/ece/resources',     icon: BookOpen },
  { name: 'Gallery',        path: '/admin/ece/gallery',       icon: Image },
  { name: 'Notices',        path: '/admin/ece/notices',       icon: Bell },
  { name: 'Doubts',         path: '/admin/ece/doubts',        icon: CircleHelp },
  { name: 'Chat Monitor',   path: '/admin/ece/chat',          icon: MessageSquare },
  { name: 'Quotes',         path: '/admin/ece/quotes',        icon: Quote },
  { name: 'Organisation',   path: '/admin/ece/organisation',  icon: Building2 },
];

// Mobile bottom tab items (max 5)
const mobileTabItems = [
  { name: 'Home',      path: '/',          icon: Home },
  { name: 'Events',    path: '/events',    icon: CalendarDays },
  { name: 'Live',      path: '/dashboard', icon: Zap },
  { name: 'Board',     path: '/leaderboard/public', icon: Trophy },
  { name: 'Menu',      path: null,         icon: Menu },
];

function NavLink({ item, onClick }) {
  const location = useLocation();
  const isActive = location.pathname === item.path ||
    (item.path !== '/' && location.pathname.startsWith(item.path));

  return (
    <Link
      to={item.path}
      onClick={onClick}
      className={`nav-item${isActive ? ' active' : ''}`}
    >
      <item.icon size={15} />
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
    </Link>
  );
}

function SectionLabel({ children }) {
  return (
    <p style={{
      fontSize: 10,
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
      color: 'var(--text-muted)',
      padding: '0 12px',
      marginTop: 20,
      marginBottom: 4,
    }}>
      {children}
    </p>
  );
}

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useStore((state) => state.user);
  const liveEventRuntime = useStore((state) => state.liveEventRuntime);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);

  // Live nav warning
  const [liveNavWarning, setLiveNavWarning] = useState(null);

  const isAdmin = user?.role === 'admin';
  const isLiveActive = !!liveEventRuntime?.eventId;
  const isAdminRoute = location.pathname.startsWith('/admin');

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setDrawerOpen(false);
    navigate('/login');
  };

  const handleNavClick = (e, path) => {
    if (isLiveActive && !path?.startsWith('/live/') && !path?.startsWith('/live-coding/')) {
      e.preventDefault();
      setLiveNavWarning(path);
    }
  };

  const confirmLeave = () => {
    const target = liveNavWarning;
    setLiveNavWarning(null);
    setDrawerOpen(false);
    navigate(target);
  };

  const userInitial = user?.name?.charAt(0) || user?.email?.charAt(0) || '?';

  // Sidebar nav content (reused in drawer)
  const SidebarNav = ({ onItemClick }) => (
    <nav style={{ flex: 1, padding: '12px 8px', overflowY: 'auto' }} className="custom-scrollbar">
      <SectionLabel>Menu</SectionLabel>
      {navItems.map((item) => (
        <NavLink key={item.path} item={item} onClick={(e) => { handleNavClick(e, item.path); onItemClick?.(); }} />
      ))}

      {isAdmin && (
        <>
          <SectionLabel>Admin</SectionLabel>
          {adminItems.map((item) => (
            <NavLink key={item.path} item={item} onClick={() => onItemClick?.()} />
          ))}
        </>
      )}

      <SectionLabel>ECE Hub</SectionLabel>
      {eceItems.map((item) => (
        <NavLink key={item.path} item={item} onClick={() => onItemClick?.()} />
      ))}

      {isAdmin && (
        <>
          <SectionLabel>ECE Admin</SectionLabel>
          {eceAdminItems.map((item) => (
            <NavLink key={item.path} item={item} onClick={() => onItemClick?.()} />
          ))}
        </>
      )}
    </nav>
  );

  return (
    <>
      {/* ── Live Nav Warning Modal ──────────── */}
      {liveNavWarning && (
        <div className="modal-overlay" style={{ zIndex: 600 }}>
          <div className="modal-card" style={{ maxWidth: 360 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 8,
                background: 'rgba(245,158,11,0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
              }}>
                <AlertTriangle size={18} style={{ color: 'var(--amber)' }} />
              </div>
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>You're in a Live Event</p>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Leaving will count as a tab violation</p>
              </div>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.6 }}>
              Navigating away triggers an anti-cheat strike. Three strikes auto-submit your session.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setLiveNavWarning(null)} className="btn-ghost" style={{ flex: 1 }}>
                Stay in Event
              </button>
              <button onClick={confirmLeave} className="btn-primary" style={{ flex: 1, background: 'var(--amber)' }}>
                Leave Anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DESKTOP SIDEBAR (≥1024px) ─────── */}
      <div className="sidebar" style={{ display: 'none' }} id="desktop-sidebar">
        {/* Wordmark */}
        <span className="sidebar-wordmark" style={{ lineHeight: 1 }}>
          Zentrix
          <span style={{
            display: 'block',
            fontSize: 10,
            fontWeight: 500,
            color: 'var(--text-muted)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            marginTop: 3,
          }}>
            Dept. ECE
          </span>
        </span>

        {/* Live event indicator */}
        {isLiveActive && (
          <div style={{
            margin: '8px 8px 0',
            padding: '8px 12px',
            background: 'rgba(16,185,129,0.08)',
            border: '1px solid rgba(16,185,129,0.2)',
            borderRadius: 6,
            display: 'flex', alignItems: 'center', gap: 8
          }}>
            <span className="live-dot" />
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Live Event Active
            </span>
          </div>
        )}

        <SidebarNav />

        {/* User footer */}
        <div style={{ padding: '12px 8px', borderTop: '1px solid var(--border)' }}>
          {user ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', marginBottom: 4 }}>
                <div className="avatar-circle">{userInitial}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {user.name || 'User'}
                  </p>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {user.email}
                  </p>
                </div>
              </div>
              <button
                onClick={handleSignOut}
                className="nav-item"
                style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', justifyContent: 'flex-start' }}
              >
                <LogOut size={15} />
                <span>Sign Out</span>
              </button>
            </>
          ) : (
            <Link to="/login" className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
              Sign In
            </Link>
          )}
        </div>
      </div>

      {/* ── Responsive sidebar via CSS ────── */}
      <style>{`
        /* Tablet (768-1023): icon rail */
        @media (min-width: 768px) {
          #desktop-sidebar { display: flex !important; }
        }
        /* Laptop (1024+): full sidebar */
        @media (min-width: 1024px) {
          #desktop-sidebar { width: 220px !important; min-width: 220px !important; }
          #desktop-sidebar .nav-item span { display: block !important; }
          #desktop-sidebar .sidebar-wordmark { display: block !important; }
          #desktop-sidebar .sidebar-section-label-text { display: block !important; }
          #desktop-sidebar #sidebar-section-labels { display: block !important; }
        }
        /* Tablet icon-only rail */
        @media (min-width: 768px) and (max-width: 1023px) {
          #desktop-sidebar {
            width: 56px !important;
            min-width: 56px !important;
          }
          #desktop-sidebar .nav-item { justify-content: center; padding: 10px; }
          #desktop-sidebar .nav-item span { display: none !important; }
          #desktop-sidebar .sidebar-wordmark { 
            font-size: 13px; padding: 18px 8px; text-align: center;
          }
          #desktop-sidebar .sidebar-section-label { display: none; }
        }
        /* Mobile: no desktop sidebar */
        @media (max-width: 767px) {
          #desktop-sidebar { display: none !important; }
        }
      `}</style>

      {/* ── MOBILE TOPBAR (hamburger) ──────── */}
      {!isLiveActive && (
        <button
          onClick={() => setDrawerOpen(true)}
          aria-label="Open menu"
          style={{
            position: 'fixed', top: 10, left: 12, zIndex: 60,
            display: 'none',
            padding: 8, borderRadius: 6,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
          }}
          id="mobile-menu-btn"
        >
          <Menu size={18} />
        </button>
      )}
      <style>{`
        @media (max-width: 767px) {
          #mobile-menu-btn { display: flex !important; align-items: center; justify-content: center; }
        }
      `}</style>

      {/* ── MOBILE DRAWER ──────────────────── */}
      {drawerOpen && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
            zIndex: 55, display: 'flex',
          }}
          onClick={() => setDrawerOpen(false)}
        >
          <div
            style={{
              width: 280, maxWidth: '85vw',
              background: 'var(--surface)',
              borderRight: '1px solid var(--border)',
              display: 'flex', flexDirection: 'column',
              overflowY: 'auto', overflowX: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '16px',
              borderBottom: '1px solid var(--border)',
            }}>
              <div>
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1, display: 'block' }}>
                  Zentrix
                </span>
                <span style={{
                  fontSize: 10,
                  fontWeight: 500,
                  color: 'var(--text-muted)',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  marginTop: 2,
                  display: 'block',
                }}>
                  Dept. ECE
                </span>
              </div>
              <button
                onClick={() => setDrawerOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}
              >
                <X size={18} />
              </button>
            </div>

            {isLiveActive && (
              <div style={{
                margin: '8px',
                padding: '8px 12px',
                background: 'rgba(16,185,129,0.08)',
                border: '1px solid rgba(16,185,129,0.2)',
                borderRadius: 6,
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <span className="live-dot" />
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Live Event Active
                </span>
              </div>
            )}

            {/* Admin collapse */}
            <nav style={{ flex: 1, padding: '12px 8px', overflowY: 'auto' }}>
              <SectionLabel>Menu</SectionLabel>
              {navItems.map((item) => (
                <NavLink key={item.path} item={item} onClick={(e) => { handleNavClick(e, item.path); setDrawerOpen(false); }} />
              ))}

              {isAdmin && (
                <>
                  <button
                    onClick={() => setAdminOpen(o => !o)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      width: '100%', padding: '8px 12px', marginTop: 8,
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--text-muted)', fontSize: 10, fontWeight: 600,
                      textTransform: 'uppercase', letterSpacing: '0.08em',
                    }}
                  >
                    Admin
                    {adminOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </button>
                  {adminOpen && adminItems.map((item) => (
                    <NavLink key={item.path} item={item} onClick={() => setDrawerOpen(false)} />
                  ))}
                </>
              )}

              <SectionLabel>ECE Hub</SectionLabel>
              {eceItems.map((item) => (
                <NavLink key={item.path} item={item} onClick={() => setDrawerOpen(false)} />
              ))}

              {isAdmin && (
                <>
                  <SectionLabel>ECE Admin</SectionLabel>
                  {eceAdminItems.map((item) => (
                    <NavLink key={item.path} item={item} onClick={() => setDrawerOpen(false)} />
                  ))}
                </>
              )}
            </nav>

            {/* Drawer user footer */}
            <div style={{ padding: 12, borderTop: '1px solid var(--border)', paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
              {user ? (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, padding: '4px 4px' }}>
                    <div className="avatar-circle avatar-circle--lg">{userInitial}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {user.name || 'User'}
                      </p>
                      <p style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {user.email}
                      </p>
                    </div>
                  </div>
                  <button onClick={handleSignOut} className="nav-item" style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer' }}>
                    <LogOut size={15} />
                    <span>Sign Out</span>
                  </button>
                </div>
              ) : (
                <Link to="/login" onClick={() => setDrawerOpen(false)} className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                  Sign In
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── MOBILE BOTTOM NAV (≤767px) ────── */}
      {!isAdminRoute && (
      <nav className="bottom-nav" aria-label="Mobile navigation">
        {mobileTabItems.map((item) => {
          if (item.path === null) {
            // "More" button opens drawer
            return (
              <button
                key="more"
                onClick={() => setDrawerOpen(true)}
                className="bottom-nav-item"
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
              >
                <item.icon size={20} />
                <span>{item.name}</span>
              </button>
            );
          }
          const isActive = location.pathname === item.path ||
            (item.path !== '/' && location.pathname.startsWith(item.path));
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={(e) => handleNavClick(e, item.path)}
              className={`bottom-nav-item${isActive ? ' active' : ''}`}
            >
              <item.icon size={20} />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>
      )}
    </>
  );
}
