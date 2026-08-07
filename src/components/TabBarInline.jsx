import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  X, LayoutDashboard, Kanban, Ticket, Users, BookOpen,
  BarChart3, Settings, Calendar, FileText, User,
  PanelLeftClose, MoreHorizontal
} from "lucide-react";
import { useTabs, closeTab } from "@/hooks/useTabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const PAGE_ICONS = {
  "/": LayoutDashboard,
  "/Dashboard": LayoutDashboard,
  "/Tickets": Kanban,
  "/Suporte": Ticket,
  "/Clients": Users,
  "/clients": Users,
  "/KnowledgeBase": BookOpen,
  "/ResponseTemplates": FileText,
  "/Reports": BarChart3,
  "/Settings": Settings,
  "/Agenda": Calendar,
  "/Users": Users,
  "/perfil": User,
  "/implantacao": Kanban,
};

const MAX_VISIBLE_TABS = 7;

function getIcon(path) {
  const direct = PAGE_ICONS[path];
  if (direct) return direct;
  const matched = Object.keys(PAGE_ICONS).find(k => k !== "/" && path.startsWith(k + "/"));
  return matched ? PAGE_ICONS[matched] : LayoutDashboard;
}

function isTabActive(tab, pathname) {
  if (tab.path === "/") return pathname === "/";
  return pathname === tab.path || pathname.startsWith(tab.path + "/");
}

export default function TabBarInline() {
  const { tabs } = useTabs();
  const location = useLocation();
  const navigate = useNavigate();
  const [overflowOpen, setOverflowOpen] = useState(false);

  const allTabs = tabs;
  const activeIdx = allTabs.findIndex(t => isTabActive(t, location.pathname));
  let visibleTabs = allTabs;
  let hiddenTabs = [];

  if (allTabs.length > MAX_VISIBLE_TABS) {
    visibleTabs = allTabs.slice(0, MAX_VISIBLE_TABS);
    hiddenTabs = allTabs.slice(MAX_VISIBLE_TABS);
    if (activeIdx >= MAX_VISIBLE_TABS) {
      const activeTab = allTabs[activeIdx];
      const displaced = visibleTabs[MAX_VISIBLE_TABS - 1];
      visibleTabs = [...allTabs.slice(0, MAX_VISIBLE_TABS - 1), activeTab];
      hiddenTabs = hiddenTabs.filter(t => t.id !== activeTab.id).concat(displaced);
    }
  }

  function handleClose(e, tab) {
    e.preventDefault();
    e.stopPropagation();
    closeTab(tab.id);
    if (isTabActive(tab, location.pathname)) {
      const idx = allTabs.findIndex(t => t.id === tab.id);
      const fallback = allTabs[idx - 1] || allTabs[idx + 1];
      if (fallback) navigate(fallback.path);
    }
  }

  function handleCloseAll(e) {
    e.preventDefault();
    e.stopPropagation();
    allTabs.forEach(tab => closeTab(tab.id));
    navigate("/");
  }

  return (
    <div className="flex items-center h-full overflow-x-auto pl-2 gap-0.5">
      {allTabs.length > 0 && (
        <button
          onClick={handleCloseAll}
          className="flex items-center h-[30px] px-2 rounded-md mr-1 transition-all flex-shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          title="Fechar todas as abas"
        >
          <PanelLeftClose className="w-3.5 h-3.5" />
        </button>
      )}

      {visibleTabs.map((tab) => {
        const active = isTabActive(tab, location.pathname);
        const Icon = tab.icon || getIcon(tab.path);
        return (
          <div
            key={tab.id}
            className="flex items-center h-[30px] group relative flex-shrink-0 rounded-md"
            style={{
              background: active ? "hsl(var(--tab-active-bg))" : "transparent",
              border: active ? "1px solid hsl(var(--border))" : "1px solid transparent",
              minWidth: "90px",
              maxWidth: "180px",
              transition: "all 0.12s",
            }}
            onMouseEnter={e => { if (!active) e.currentTarget.style.background = "hsl(var(--muted))"; }}
            onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}
          >
            {/* Bottom accent for active tab */}
            {active && (
              <div
                className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full"
                style={{ background: "hsl(var(--tab-active-border))" }}
              />
            )}

            <Link
              to={tab.path}
              className="flex items-center gap-1.5 h-full pl-3 pr-1 select-none flex-1 min-w-0"
              style={{ color: active ? "hsl(var(--tab-text-active))" : "hsl(var(--tab-text))" }}
            >
              <Icon className="w-3 h-3 flex-shrink-0" />
              <span className="truncate" style={{ fontSize: "12px", fontWeight: active ? 600 : 400 }}>
                {tab.label}
              </span>
            </Link>

            <button
              onClick={(e) => handleClose(e, tab)}
              className="flex-shrink-0 w-4 h-4 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 mr-1.5 transition-all text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              title="Fechar aba"
            >
              <X className="w-2.5 h-2.5" />
            </button>
          </div>
        );
      })}

      {hiddenTabs.length > 0 && (
        <Popover open={overflowOpen} onOpenChange={setOverflowOpen}>
          <PopoverTrigger asChild>
            <button
              className="flex items-center gap-1 h-[30px] px-2.5 ml-1 text-[11px] font-semibold rounded-md transition-all flex-shrink-0 text-muted-foreground hover:text-foreground hover:bg-muted"
              title={`${hiddenTabs.length} aba(s) oculta(s)`}
            >
              <MoreHorizontal className="w-3.5 h-3.5" />
              <span>+{hiddenTabs.length}</span>
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-60 p-1 bg-popover border-border">
            <p className="text-[10px] font-semibold uppercase tracking-wider px-2 py-1.5 text-muted-foreground">
              Mais abas ({hiddenTabs.length})
            </p>
            <div className="max-h-72 overflow-y-auto">
              {hiddenTabs.map(tab => {
                const Icon = tab.icon || getIcon(tab.path);
                return (
                  <div
                    key={tab.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted group cursor-pointer"
                    onClick={() => { navigate(tab.path); setOverflowOpen(false); }}
                  >
                    <Icon className="w-3.5 h-3.5 flex-shrink-0 text-muted-foreground" />
                    <span className="flex-1 text-[12px] truncate text-foreground">{tab.label}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
                      className="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded transition-all text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      title="Fechar aba"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}