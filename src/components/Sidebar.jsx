import { NavLink } from "react-router-dom";
import {
    LayoutDashboard,
    Users,
    FileText,
    Settings,
    ChevronLeft,
    ChevronRight,
    Briefcase,
    ClipboardList,
    MessageCircle,
    X,
} from "lucide-react";

const navItems = [
    { label: "Dashboard", icon: LayoutDashboard, path: "/" },
    { label: "Today Task", icon: ClipboardList, path: "/todaytask" },
    { label: "Leads", icon: Users, path: "/leads" },
    { label: "Clients & Projects", icon: Briefcase, path: "/clients" },
    { label: "Quotations", icon: FileText, path: "/templates" },
    { label: "WA Templates", icon: MessageCircle, path: "/whatsapp-templates" },
    { label: "Settings", icon: Settings, path: "/settings" },
];

export default function Sidebar({ collapsed, setCollapsed }) {
    return (
        <aside
            className={[
                "h-screen bg-white border-r border-slate-200 flex flex-col",
                "transition-all duration-300 ease-in-out overflow-hidden z-50 shadow-sm",
                // Desktop: inline, collapsible to icon rail
                "md:relative md:translate-x-0",
                collapsed ? "md:w-[72px] md:min-w-[72px]" : "md:w-[260px] md:min-w-[260px]",
                // Mobile: fixed overlay, slides in/out
                "max-md:fixed max-md:top-0 max-md:left-0 max-md:h-screen max-md:w-[280px] max-md:min-w-[280px]",
                collapsed ? "max-md:-translate-x-full" : "max-md:translate-x-0",
            ].join(" ")}
        >
            {/* Logo area */}
            <div className="flex items-center justify-between px-4 py-5 border-b border-slate-200 min-h-[64px]">
                <div className="flex items-center gap-3 overflow-hidden">
                    <img src="/logo.png" alt="Zaref Solar CRM" className="w-9 h-9 rounded-lg object-contain shrink-0" />
                    {/* On mobile always show name; on desktop hide when collapsed */}
                    <span className={`text-base font-bold bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent whitespace-nowrap ${collapsed ? "hidden md:hidden" : ""}`}>
                        Zaref Solar CRM
                    </span>
                </div>

                {/* Desktop: collapse toggle button */}
                <button
                    className="hidden md:flex items-center justify-center w-7 h-7 rounded-md border-none bg-transparent text-slate-400 cursor-pointer hover:bg-slate-100 hover:text-slate-700 transition-all shrink-0"
                    onClick={() => setCollapsed(!collapsed)}
                    aria-label="Toggle sidebar"
                >
                    {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
                </button>

                {/* Mobile: close button */}
                <button
                    className="flex md:hidden items-center justify-center w-8 h-8 rounded-lg border-none bg-slate-100 text-slate-600 cursor-pointer hover:bg-slate-200 transition-all shrink-0"
                    onClick={() => setCollapsed(true)}
                    aria-label="Close sidebar"
                >
                    <X size={18} />
                </button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 flex flex-col gap-1 p-3 overflow-y-auto">
                {navItems.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        end={item.path === "/"}
                        onClick={() => {
                            if (window.innerWidth < 768) setCollapsed(true);
                        }}
                        className={({ isActive }) =>
                            `flex items-center gap-3 px-3 py-3 rounded-lg no-underline text-sm font-medium whitespace-nowrap relative transition-all
                            ${isActive
                                ? "bg-amber-50 text-amber-600 sidebar-active-indicator"
                                : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                            }`
                        }
                        title={collapsed ? item.label : undefined}
                    >
                        <item.icon size={20} className="shrink-0" />
                        {/* Show label always on mobile; on desktop respect collapse */}
                        <span className={`overflow-hidden text-ellipsis ${collapsed ? "md:hidden" : ""}`}>
                            {item.label}
                        </span>
                    </NavLink>
                ))}
            </nav>

            {/* Bottom branding */}
            <div className={`px-4 py-4 border-t border-slate-200 ${collapsed ? "md:hidden" : ""}`}>
                <p className="text-xs text-slate-400 text-center">© {new Date().getFullYear()} Zaref Solar CRM</p>
            </div>
        </aside>
    );
}
