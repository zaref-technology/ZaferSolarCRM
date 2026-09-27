import { useState, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import Navbar from "./Navbar";

export default function Layout() {
    const [collapsed, setCollapsed] = useState(true); // collapsed by default on mobile
    const location = useLocation();

    // Auto-close sidebar on mobile when navigating
    useEffect(() => {
        const isMobile = window.innerWidth < 768;
        if (isMobile) setCollapsed(true);
    }, [location.pathname]);

    const isMobileOpen = !collapsed;

    return (
        <div className="flex h-screen w-screen overflow-hidden bg-slate-50">
            {/* Mobile backdrop */}
            {isMobileOpen && (
                <div
                    className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm md:hidden"
                    onClick={() => setCollapsed(true)}
                />
            )}
            <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
            <div className="flex-1 flex flex-col min-w-0">
                <Navbar onMenuClick={() => setCollapsed(!collapsed)} />
                <main className="flex-1 overflow-y-auto p-6 max-md:p-3 bg-slate-50">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
