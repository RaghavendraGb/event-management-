import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';

export function AppLayout() {
  return (
    <div className="flex h-dvh bg-slate-950 overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto overflow-x-hidden relative">
        {/* Ambient light blobs — decorative only */}
        <div className="fixed top-[-10%] left-[10%] lg:left-[calc(16rem-10%)] w-[40%] h-[40%] rounded-full bg-blue-600/10 blur-[120px] pointer-events-none" />
        <div className="fixed bottom-[-10%] right-[-5%] w-[40%] h-[40%] rounded-full bg-purple-600/10 blur-[120px] pointer-events-none" />

        {/* Page content */}
        <div className="relative z-10 p-4 sm:p-6 md:p-8 pt-16 lg:pt-8 main-content-area min-h-full">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
