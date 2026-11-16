import { useWorkspace } from "@/restaurant/shared";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { BottomNav } from "./BottomNav";
import { OfflineIndicator } from "./OfflineIndicator";
import { LowBalanceBanner } from "./LowBalanceBanner";
import { AIFloatingButton } from "../ai/AIFloatingButton";

export function Layout() {
  const w = useWorkspace();
  return (
    <div className="min-h-screen bg-cream">
      {/* Desktop Sidebar */}
      <Sidebar />

      {/* Main content */}
      <div className="md:ml-64">
        <TopBar />
        <OfflineIndicator />
        {w.data?.role !== "CASHIER" && <LowBalanceBanner />}

        <main className="p-4 pb-24 md:pb-6">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <BottomNav />

      {/* Floating AI button */}
      {w.data?.navigation.some((n) => n.href === "/assistant") && (
        <AIFloatingButton />
      )}
    </div>
  );
}
