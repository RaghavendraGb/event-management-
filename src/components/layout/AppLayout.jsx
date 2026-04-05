import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { LiveBanner } from './LiveBanner';
import { useStore } from '../../store';
import { WifiOff, Wifi, Signal } from 'lucide-react';
import { useEffect, useState } from 'react';

export function AppLayout() {
  const networkStatus = useStore((state) => state.networkStatus);
  const [showRecovery, setShowRecovery] = useState(false);

  useEffect(() => {
    if (networkStatus === 'recovery') {
      setShowRecovery(true);
      const t = setTimeout(() => setShowRecovery(false), 4000);
      return () => clearTimeout(t);
    } else {
      setShowRecovery(false);
    }
  }, [networkStatus]);

  const getNetworkBanner = () => {
    if (networkStatus === 'offline') {
      return (
        <div className="network-banner network-banner--offline">
          <WifiOff style={{ width: 14, height: 14, flexShrink: 0 }} />
          Offline — answers saved locally
        </div>
      );
    }
    if (networkStatus === 'slow') {
      return (
        <div className="network-banner network-banner--slow">
          <Signal style={{ width: 14, height: 14, flexShrink: 0 }} />
          Slow network — switching to recovery mode
        </div>
      );
    }
    if (showRecovery) {
      return (
        <div className="network-banner network-banner--recovery">
          <Wifi style={{ width: 14, height: 14, flexShrink: 0 }} />
          Reconnected — syncing
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{ display: 'flex', height: '100dvh', background: 'var(--bg)', overflow: 'hidden' }}>
      <Sidebar />
      <main style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative' }}>
        {/* Global Live Event Banner */}
        <LiveBanner />

        {/* Network Status Banner */}
        {getNetworkBanner()}

        {/* Page content */}
        <div className="main-content-area" style={{ flex: 1, padding: '1rem', position: 'relative' }}>
          {/* Desktop: more padding */}
          <style>{`
            @media (min-width: 768px) {
              .app-main-content { padding: 20px 24px; }
            }
            @media (min-width: 1024px) {
              .app-main-content { padding: 28px 32px; max-width: 1100px; margin: 0 auto; }
            }
          `}</style>
          <div className="app-main-content" style={{ padding: '16px' }}>
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}
