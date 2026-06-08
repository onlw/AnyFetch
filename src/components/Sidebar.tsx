import { Download, History, Settings, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

export type ViewType = "downloads" | "history" | "settings";

interface SidebarProps {
  activeView: ViewType;
  onViewChange: (view: ViewType) => void;
  activeCount: number;
}

const navItems = [
  { id: "downloads" as ViewType, icon: Download, label: "下载" },
  { id: "history" as ViewType, icon: History, label: "历史" },
  { id: "settings" as ViewType, icon: Settings, label: "设置" },
];

export function Sidebar({ activeView, onViewChange, activeCount }: SidebarProps) {
  return (
    <aside className="flex flex-col w-16 border-r border-surface-border bg-surface-raised shrink-0 py-3 items-center gap-1">
      {/* Logo */}
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center mb-4 shadow-lg shadow-brand-500/20">
        <Zap className="w-5 h-5 text-white" strokeWidth={2.5} />
      </div>
 
      {/* Nav items */}
      <nav className="flex flex-col gap-1 w-full px-2">
        {navItems.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => onViewChange(id)}
            className={cn(
              "relative flex flex-col items-center justify-center gap-1 w-full rounded-xl py-2.5 px-1",
              "transition-all duration-150 cursor-default select-none",
              activeView === id
                ? "bg-brand-500/10 text-brand-600"
                : "text-slate-400 hover:text-slate-700 hover:bg-slate-200/50"
            )}
            title={label}
          >
            <div className="relative">
              <Icon className="w-5 h-5" />
              {id === "downloads" && activeCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-brand-500 text-white text-[9px] font-bold flex items-center justify-center leading-none">
                  {activeCount > 9 ? "9+" : activeCount}
                </span>
              )}
            </div>
            <span className="text-[10px] font-medium leading-none">{label}</span>

            {/* Active indicator */}
            {activeView === id && (
              <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-brand-500 rounded-r-full" />
            )}
          </button>
        ))}
      </nav>
    </aside>
  );
}
