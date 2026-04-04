import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { LiveBanner } from './LiveBanner';
import { useStore } from '../../store';
import { WifiOff, Wifi, Signal } from 'lucide-react';
import { useEffect, useState } from 'react';

export function AppLayout() {
  const networkStatus = useStore((state) => state.networkStatus);
  const [showRecovery, setShowRecovery] = useState(false);

  // Show recovery banner briefly then fade it
  useEffect(() => {
    if (networkStatus === 'recovery') {
      setShowRecovery(true);
    } else {
      setShowRecovery(false);
    }
  }, [networkStatus]);

  const getNetworkBanner = () => {
    if (networkStatus === 'offline') {
      return (
        <div className="network-banner network-banner--offline">
          <WifiOff className="w-3.5 h-3.5" />
          Offline — answers saved locally, don't panic
        </div>
      );
    }
    if (networkStatus === 'slow') {
      return (
        <div className="network-banner network-banner--slow">
          <Signal className="w-3.5 h-3.5" />
          Slow network detected — switching to recovery mode
        </div>
      );
    }
    if (showRecovery) {
      return (
        <div className="network-banner network-banner--recovery">
          <Wifi className="w-3.5 h-3.5" />
          Reconnected — syncing answers
        </div>
      );
    }
    return null;
  };

  return (
    <div className="flex h-dvh bg-slate-950 overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto overflow-x-hidden relative flex flex-col">
        {/* Ambient light blobs — decorative only */}
        <div className="fixed top-[-10%] left-[10%] lg:left-[calc(16rem-10%)] w-[40%] h-[40%] rounded-full bg-blue-600/10 blur-[120px] pointer-events-none" />
        <div className="fixed bottom-[-10%] right-[-5%] w-[40%] h-[40%] rounded-full bg-purple-600/10 blur-[120px] pointer-events-none" />

        {/* Global Live Event Banner (Feature 1) */}
        <LiveBanner />

        {/* Network Status Banner (Feature 5) */}
        {getNetworkBanner()}

        {/* Page content */}
        <div className="relative z-10 p-4 sm:p-6 md:p-8 pt-16 lg:pt-8 main-content-area min-h-full flex-1">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
