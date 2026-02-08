import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { BottomNav } from './BottomNav';
import { OfflineIndicator } from './OfflineIndicator';
import { AIFloatingButton } from '../ai/AIFloatingButton';

export function Layout() {
  return (
    <div className="min-h-screen bg-slate-900">
      {/* Desktop Sidebar */}
      <Sidebar />
      
      {/* Main content */}
      <div className="md:ml-64">
        <TopBar />
        <OfflineIndicator />
        
        <main className="p-4 pb-24 md:pb-6">
          <Outlet />
        </main>
      </div>
      
      {/* Mobile bottom navigation */}
      <BottomNav />
      
      {/* Floating AI button */}
      <AIFloatingButton />
    </div>
  );
}
