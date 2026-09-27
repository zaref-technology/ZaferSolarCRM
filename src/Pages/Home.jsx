import { Users, TrendingUp, UserPlus, Briefcase, FileSignature, ArrowRight, Activity, Clock, IndianRupee, Wrench, BarChart2, Sun } from "lucide-react";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { collection, query, where, orderBy, limit, getDocs, getCountFromServer, collectionGroup } from "firebase/firestore";
import { db } from "../../firebase";
import { Link } from "react-router-dom";
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer
} from "recharts";

const statusStyle = {
    New: "bg-orange-500 text-white",
    "Follow-up": "bg-orange-500 text-white",
    Negotiation: "bg-amber-500 text-white",
    Converted: "bg-emerald-500 text-white",
    Lost: "bg-red-500 text-white",
};

// Skeleton component
function Skeleton({ className }) {
    return <div className={`animate-pulse bg-slate-200 rounded-lg ${className}`} />;
}

// KPI Card
function KpiCard({ title, value, icon: Icon, color, bg, loading, suffix, to, delay = 0 }) {
    const content = (
        <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay }}
            className={`flex items-center gap-3 bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 transition-all ${to ? "hover:border-orange-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-200/80 cursor-pointer" : "hover:border-orange-200 hover:shadow-md"}`}
        >
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${bg}`} style={{ color }}>
                <Icon size={20} />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider truncate">{title}</p>
                {loading ? (
                    <Skeleton className="h-7 w-16 mt-1" />
                ) : (
                    <h2 className="text-xl sm:text-2xl font-bold text-slate-800 mt-0.5 leading-none">
                        {value}{suffix && <span className="text-xs font-semibold text-slate-500 ml-1">{suffix}</span>}
                    </h2>
                )}
            </div>
            {to && <ArrowRight size={15} className="text-slate-300 shrink-0" />}
        </motion.div>
    );
    return to ? <Link to={to} className="no-underline block">{content}</Link> : content;
}

// Custom Tooltip for Recharts
function CustomTooltip({ active, payload, label }) {
    if (active && payload && payload.length) {
        return (
            <div className="bg-slate-900 text-white px-3 py-2 rounded-xl shadow-xl text-xs">
                <p className="font-semibold text-slate-300 mb-0.5">{label}</p>
                <p className="text-white font-bold text-sm">₹{payload[0].value.toLocaleString("en-IN")}</p>
            </div>
        );
    }
    return null;
}

// Revenue Area Chart using Recharts
function RevenueChart({ data, loading }) {
    if (loading) {
        return (
            <div className="flex items-end gap-2 h-32 mt-4">
                {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="flex-1 rounded-md" style={{ height: `${40 + i * 10}px` }} />
                ))}
            </div>
        );
    }

    return (
        <ResponsiveContainer width="100%" height={140}>
            <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <defs>
                    <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f97316" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                    </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                    dataKey="month"
                    tick={{ fontSize: 10, fill: "#94a3b8", fontWeight: 600 }}
                    axisLine={false}
                    tickLine={false}
                />
                <YAxis
                    tick={{ fontSize: 9, fill: "#94a3b8" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={v => v >= 1000 ? `₹${(v / 1000).toFixed(0)}k` : `₹${v}`}
                    width={44}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: "#f97316", strokeWidth: 1, strokeDasharray: "4 4" }} />
                <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#f97316"
                    strokeWidth={2.5}
                    fill="url(#revenueGrad)"
                    dot={{ r: 3.5, fill: "#f97316", strokeWidth: 2, stroke: "#fff" }}
                    activeDot={{ r: 5, fill: "#f97316", stroke: "#fff", strokeWidth: 2 }}
                />
            </AreaChart>
        </ResponsiveContainer>
    );
}

export default function DashboardHome() {
    const [kpis, setKpis] = useState({
        totalLeads: "-",
        converted: "-",
        followUps: "-",
        installationsPending: "-",
        pendingPayments: 0,
        monthlyRevenue: 0,
    });
    const [revenueChart, setRevenueChart] = useState([]);
    const [recentLeads, setRecentLeads] = useState([]);
    const [loading, setLoading] = useState(true);
    const [chartLoading, setChartLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;

        async function fetchDashboardData() {
            try {
                const leadsRef = collection(db, "leads");
                const clientsRef = collection(db, "clients");

                const [totalLeadsSnap, convertedSnap, followUpSnap, installPendingSnap] = await Promise.all([
                    getCountFromServer(leadsRef),
                    getCountFromServer(query(leadsRef, where("status", "==", "Converted"))),
                    getCountFromServer(query(leadsRef, where("status", "==", "Follow-up"))),
                    getCountFromServer(query(clientsRef, where("status", "==", "In Progress"))),
                ]);

                const recentSnap = await getDocs(query(leadsRef, orderBy("createdAt", "desc"), limit(5)));

                if (!isMounted) return;

                setKpis(prev => ({
                    ...prev,
                    totalLeads: totalLeadsSnap.data().count,
                    converted: convertedSnap.data().count,
                    followUps: followUpSnap.data().count,
                    installationsPending: installPendingSnap.data().count,
                }));
                setRecentLeads(recentSnap.docs.map(d => ({ id: d.id, ...d.data() })));
                setLoading(false);

                const allClientsSnap = await getDocs(clientsRef);
                let totalPendingPayments = 0;
                allClientsSnap.docs.forEach(doc => {
                    const data = doc.data();
                    if (data.status !== "Completed" && data.status !== "Lost") {
                        const paid = Number(data.advanceReceived) || 0;
                        const price = Number(data.projectPrice) || 0;
                        const pending = price - paid;
                        if (pending > 0) totalPendingPayments += pending;
                    }
                });

                const sixMonthsAgo = new Date();
                sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
                sixMonthsAgo.setDate(1);
                sixMonthsAgo.setHours(0, 0, 0, 0);

                const months = [];
                for (let i = 5; i >= 0; i--) {
                    const d = new Date();
                    d.setMonth(d.getMonth() - i);
                    months.push({
                        month: d.toLocaleString("en-IN", { month: "short" }),
                        year: d.getFullYear(),
                        monthNum: d.getMonth(),
                        revenue: 0,
                    });
                }

                let currentMonthRevenue = 0;
                const now = new Date();
                const paymentsSnap = await getDocs(collectionGroup(db, "payments"));

                paymentsSnap.docs.forEach(doc => {
                    const data = doc.data();
                    if (!data.date) return;
                    const created = data.date?.toDate ? data.date.toDate() : new Date(data.date?.seconds * 1000);
                    if (created >= sixMonthsAgo) {
                        const paid = Number(data.amount) || 0;
                        const bucket = months.find(m => m.monthNum === created.getMonth() && m.year === created.getFullYear());
                        if (bucket) bucket.revenue += paid;
                        if (created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear()) {
                            currentMonthRevenue += paid;
                        }
                    }
                });

                if (!isMounted) return;
                setKpis(prev => ({
                    ...prev,
                    pendingPayments: totalPendingPayments,
                    monthlyRevenue: currentMonthRevenue,
                }));
                setRevenueChart(months);
                setChartLoading(false);

            } catch (error) {
                console.error("Failed to fetch dashboard data:", error);
                if (isMounted) { setLoading(false); setChartLoading(false); }
            }
        }

        fetchDashboardData();
        return () => { isMounted = false; };
    }, []);

    const greeting = (() => {
        const h = new Date().getHours();
        if (h < 12) return "Good Morning";
        if (h < 17) return "Good Afternoon";
        return "Good Evening";
    })();

    return (
        <div className="w-full max-w-5xl mx-auto px-0 sm:px-2">

            {/* ── Hero Header ── */}
            <motion.div
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative overflow-hidden bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 rounded-2xl p-5 sm:p-7 mb-6 shadow-lg shadow-orange-500/20"
            >
                {/* decorative sun */}
                <div className="absolute -right-6 -top-6 w-32 h-32 rounded-full bg-white/10" />
                <div className="absolute right-8 top-4 opacity-20">
                    <Sun size={64} className="text-white" />
                </div>

                <div className="relative flex items-start justify-between gap-4">
                    <div>
                        <p className="text-orange-100 text-sm font-medium">{greeting} 👋</p>
                        <h1 className="text-white text-xl sm:text-2xl font-bold mt-1 leading-tight">
                            Zaref Solar CRM
                        </h1>
                        <p className="text-orange-100 text-xs sm:text-sm mt-1">
                            Here's what's happening with your business today.
                        </p>
                    </div>
                    <Link to="/leads">
                        <button className="shrink-0 px-4 py-2 rounded-xl bg-white text-orange-600 text-xs sm:text-sm font-bold border-none cursor-pointer shadow-md hover:-translate-y-0.5 hover:shadow-lg transition-all whitespace-nowrap">
                            + New Lead
                        </button>
                    </Link>
                </div>
            </motion.div>

            {/* ── KPI Grid — 2 cols mobile / 4 cols desktop ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
                <KpiCard title="Total Leads" value={kpis.totalLeads} icon={Users} color="#f97316" bg="bg-orange-50" loading={loading} delay={0} to="/leads" />
                <KpiCard title="Converted" value={kpis.converted} icon={TrendingUp} color="#10b981" bg="bg-emerald-50" loading={loading} delay={0.05} />
                <KpiCard title="Follow-ups" value={kpis.followUps} icon={Clock} color="#f97316" bg="bg-amber-50" loading={loading} delay={0.1} to="/leads?status=Follow-up" />
                <KpiCard title="Installations" value={kpis.installationsPending} icon={Wrench} color="#8b5cf6" bg="bg-purple-50" loading={loading} delay={0.15} to="/clients?status=In+Progress" />
            </div>

            {/* ── Revenue Row ── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                {/* Monthly Revenue Card */}
                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col justify-between hover:shadow-md transition-all"
                >
                    <div className="flex items-center gap-2 mb-3">
                        <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                            <IndianRupee size={16} className="text-emerald-600" />
                        </div>
                        <p className="text-xs font-semibold text-slate-500">This Month's Revenue</p>
                    </div>
                    {chartLoading ? (
                        <Skeleton className="h-8 w-32 mt-1" />
                    ) : (
                        <h2 className="text-2xl sm:text-3xl font-bold text-slate-800">
                            ₹{kpis.monthlyRevenue.toLocaleString()}
                        </h2>
                    )}
                    <p className="text-[11px] text-slate-400 mt-2">Based on advance payments received</p>
                </motion.div>

                {/* Pending Payments */}
                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.25 }}
                    className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col justify-between hover:shadow-md transition-all"
                >
                    <div className="flex items-center gap-2 mb-3">
                        <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
                            <IndianRupee size={16} className="text-red-500" />
                        </div>
                        <p className="text-xs font-semibold text-slate-500">Pending Payments</p>
                    </div>
                    {loading ? (
                        <Skeleton className="h-8 w-32 mt-1" />
                    ) : (
                        <h2 className="text-2xl sm:text-3xl font-bold text-red-500">
                            ₹{kpis.pendingPayments.toLocaleString()}
                        </h2>
                    )}
                    <Link to="/clients" className="text-[11px] text-orange-500 font-semibold mt-2 hover:underline">
                        View all clients →
                    </Link>
                </motion.div>

                {/* Revenue Chart */}
                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="sm:col-span-1 col-span-1 bg-white border border-slate-200 rounded-2xl p-5 hover:shadow-md transition-all"
                >
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center">
                                <BarChart2 size={16} className="text-orange-500" />
                            </div>
                            <p className="text-xs font-semibold text-slate-500">6-Month Revenue</p>
                        </div>
                    </div>
                    <RevenueChart data={revenueChart} loading={chartLoading} />
                </motion.div>
            </div>

            {/* ── Quick Actions ── */}
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">Quick Actions</p>
            <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-6">
                <Link to="/leads" className="group flex flex-col sm:flex-row items-center sm:gap-4 gap-2 p-3 sm:p-4 border border-slate-200 rounded-2xl bg-white hover:bg-orange-50 hover:border-orange-200 hover:shadow-md transition-all cursor-pointer text-center sm:text-left">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-orange-50 text-orange-500 flex items-center justify-center shrink-0 group-hover:bg-orange-500 group-hover:text-white transition-all duration-300">
                        <UserPlus size={20} />
                    </div>
                    <div>
                        <h3 className="text-xs sm:text-sm font-bold text-slate-800">Add Lead</h3>
                        <p className="text-[10px] sm:text-xs text-slate-400 mt-0.5 hidden sm:block">Create a new prospect</p>
                    </div>
                </Link>
                <Link to="/clients" className="group flex flex-col sm:flex-row items-center sm:gap-4 gap-2 p-3 sm:p-4 border border-slate-200 rounded-2xl bg-white hover:bg-purple-50 hover:border-purple-200 hover:shadow-md transition-all cursor-pointer text-center sm:text-left">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-purple-50 text-purple-500 flex items-center justify-center shrink-0 group-hover:bg-purple-500 group-hover:text-white transition-all duration-300">
                        <Briefcase size={20} />
                    </div>
                    <div>
                        <h3 className="text-xs sm:text-sm font-bold text-slate-800">Clients</h3>
                        <p className="text-[10px] sm:text-xs text-slate-400 mt-0.5 hidden sm:block">View existing projects</p>
                    </div>
                </Link>
                <Link to="/templates" className="group flex flex-col sm:flex-row items-center sm:gap-4 gap-2 p-3 sm:p-4 border border-slate-200 rounded-2xl bg-white hover:bg-amber-50 hover:border-amber-200 hover:shadow-md transition-all cursor-pointer text-center sm:text-left">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-amber-50 text-amber-500 flex items-center justify-center shrink-0 group-hover:bg-amber-500 group-hover:text-white transition-all duration-300">
                        <FileSignature size={20} />
                    </div>
                    <div>
                        <h3 className="text-xs sm:text-sm font-bold text-slate-800">Quotations</h3>
                        <p className="text-[10px] sm:text-xs text-slate-400 mt-0.5 hidden sm:block">Send a new proposal</p>
                    </div>
                </Link>
            </div>

            {/* ── Recent Leads ── */}
            <motion.div
                className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden mb-4"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
            >
                <div className="px-4 sm:px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center">
                            <Activity size={16} />
                        </div>
                        <h2 className="text-sm font-bold text-slate-800">Recent Leads</h2>
                    </div>
                    <Link to="/leads" className="text-xs font-bold text-orange-500 hover:text-orange-600 flex items-center gap-1 transition-colors">
                        View All <ArrowRight size={14} />
                    </Link>
                </div>

                {/* Desktop table */}
                <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full border-collapse text-left">
                        <thead>
                            <tr className="bg-slate-50/70">
                                <th className="text-[10px] font-bold uppercase tracking-wider text-slate-400 py-3 px-6 border-b border-slate-100">Name</th>
                                <th className="text-[10px] font-bold uppercase tracking-wider text-slate-400 py-3 px-6 border-b border-slate-100">Contact</th>
                                <th className="text-[10px] font-bold uppercase tracking-wider text-slate-400 py-3 px-6 border-b border-slate-100">Status</th>
                                <th className="text-[10px] font-bold uppercase tracking-wider text-slate-400 py-3 px-6 border-b border-slate-100 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                Array.from({ length: 4 }).map((_, i) => (
                                    <tr key={i}>
                                        <td className="py-3.5 px-6 border-b border-slate-50"><Skeleton className="h-4 w-28" /></td>
                                        <td className="py-3.5 px-6 border-b border-slate-50"><Skeleton className="h-4 w-24" /></td>
                                        <td className="py-3.5 px-6 border-b border-slate-50"><Skeleton className="h-5 w-20 rounded-full" /></td>
                                        <td className="py-3.5 px-6 border-b border-slate-50 text-right"><Skeleton className="h-7 w-14 ml-auto rounded-lg" /></td>
                                    </tr>
                                ))
                            ) : recentLeads.length > 0 ? (
                                recentLeads.map((lead, i) => (
                                    <tr key={lead.id || i} className="hover:bg-slate-50/80 transition-colors">
                                        <td className="py-3.5 px-6 text-sm font-semibold text-slate-800 border-b border-slate-50">{lead.name}</td>
                                        <td className="py-3.5 px-6 text-sm text-slate-500 border-b border-slate-50">{lead.phone}</td>
                                        <td className="py-3.5 px-6 border-b border-slate-50">
                                            <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${statusStyle[lead.status] || "bg-slate-100 text-slate-600"}`}>
                                                {lead.status || "New"}
                                            </span>
                                        </td>
                                        <td className="py-3.5 px-6 border-b border-slate-50 text-right">
                                            <Link to={`/leads?lead=${lead.id}`} className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 text-xs font-bold hover:bg-orange-50 hover:text-orange-600 hover:border-orange-200 transition-all shadow-sm">
                                                Open
                                            </Link>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="4" className="py-8 text-center text-slate-400 text-sm">No recent leads found.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Mobile card list */}
                <div className="sm:hidden divide-y divide-slate-100">
                    {loading ? (
                        Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="flex items-center gap-3 p-4">
                                <Skeleton className="w-9 h-9 rounded-full shrink-0" />
                                <div className="flex-1">
                                    <Skeleton className="h-3.5 w-24 mb-1.5" />
                                    <Skeleton className="h-3 w-20" />
                                </div>
                                <Skeleton className="h-5 w-16 rounded-full" />
                            </div>
                        ))
                    ) : recentLeads.length > 0 ? (
                        recentLeads.map((lead, i) => (
                            <Link key={lead.id || i} to={`/leads?lead=${lead.id}`} className="flex items-center gap-3 p-4 hover:bg-slate-50 transition-colors">
                                <div className="w-9 h-9 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold text-sm shrink-0">
                                    {lead.name?.charAt(0)?.toUpperCase() || "?"}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-slate-800 truncate">{lead.name}</p>
                                    <p className="text-xs text-slate-400">{lead.phone}</p>
                                </div>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${statusStyle[lead.status] || "bg-slate-100 text-slate-600"}`}>
                                    {lead.status || "New"}
                                </span>
                            </Link>
                        ))
                    ) : (
                        <p className="py-8 text-center text-slate-400 text-sm">No recent leads found.</p>
                    )}
                </div>
            </motion.div>
        </div>
    );
}