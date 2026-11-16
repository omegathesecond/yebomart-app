import { NavLink } from "react-router-dom";
import {
  Squares2X2Icon,
  ArrowRightOnRectangleIcon,
} from "@heroicons/react/24/outline";
import { useAuthStore } from "@/stores/authStore";
import { YeboLogo } from "@/components/ui/YeboLogo";
import { useWorkspace } from "@/restaurant/shared";
export function Sidebar() {
  const { shop, user, logout } = useAuthStore();
  const w = useWorkspace();
  return (
    <aside className="on-ink fixed left-0 top-0 z-50 hidden h-screen w-64 flex-col bg-ink md:flex">
      <div className="border-b border-line-ink px-5 py-4">
        <YeboLogo onDark size="md" />
        <p className="m mt-2 truncate text-[10px] uppercase tracking-widest text-mist">
          {shop?.name}
        </p>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        {[...new Set(w.data?.navigation.map((n) => n.group))].map((group) => (
          <div key={group}>
            <p className="eyebrow px-3 pb-2 pt-5">{group}</p>
            {w.data?.navigation
              .filter((n) => n.group === group)
              .map((n) => (
                <NavLink
                  key={n.href}
                  to={n.href}
                  end={n.href === "/"}
                  className={({ isActive }) =>
                    "flex items-center gap-3 border-l-2 px-3 py-2.5 text-[13.5px] transition-colors " +
                    (isActive
                      ? "border-brand bg-ink-2 font-medium text-cream"
                      : "border-transparent text-mist hover:bg-ink-2 hover:text-cream")
                  }
                >
                  <Squares2X2Icon className="h-4 w-4 shrink-0" />
                  <span>{n.name}</span>
                </NavLink>
              ))}
          </div>
        ))}
      </nav>
      <div className="flex items-center gap-3 border-t border-line-ink px-5 py-4">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm">{user?.name}</p>
          <p className="m text-[10px] uppercase text-mist">
            {w.data?.kitchen ? "Kitchen" : user?.role}
          </p>
        </div>
        <button
          aria-label="Sign out"
          className="p-2 hover:text-brand"
          onClick={logout}
        >
          <ArrowRightOnRectangleIcon className="h-5 w-5" />
        </button>
      </div>
    </aside>
  );
}
