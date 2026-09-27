import { Users, TrendingUp, UserPlus, Briefcase, FileSignature, ArrowRight, Activity, Clock, IndianRupee, Wrench, BarChart2 } from "lucide-react";
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
function KpiCard({ title, value, icon: Icon, color, bg, loading, suffix, to }) {
    const content = (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex items-center gap-4 bg-white border border-slate-200 rounded-xl p-5 transition-all cursor-default ${to ? "hover:border-orange-300 hover:-translate-y-0.5 hover:shadow-md cursor-pointer" : "hover:border-orange-300 hover:-translate-y-0.5 hover:shadow-md"
                }`}
        >
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${bg}`} style={{ color }}>
                <Icon size={22} />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-500 font-medium">{title}</p>
                {loading ? (
                    <Skeleton className="h-7 w-16 mt-1" />
                ) : (
                    <h2 className="text-2xl font-bold text-slate-800">{value}{suffix && <span className="text-sm font-semibold text-slate-500 ml-1">{suffix}</span>}</h2>
                )}
            </div>
            {to && <ArrowRight size={16} className="text-slate-300 shrink-0" />}
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
            <div className="flex items-end gap-2 h-36 mt-4">
                {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="flex-1 rounded-md" style={{ height: `${40 + i * 10}px` }} />
                ))}
            </div>
        );
    }

    return (
        <ResponsiveContainer width="100%" height={150}>
            <AreaChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                    <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11, fill: "#94a3b8", fontWeight: 600 }}
                    axisLine={false}
                    tickLine={false}
                />
                <YAxis
                    tick={{ fontSize: 10, fill: "#94a3b8" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={v => v >= 1000 ? `₹${(v / 1000).toFixed(0)}k` : `₹${v}`}
                    width={48}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: "#3b82f6", strokeWidth: 1, strokeDasharray: "4 4" }} />
                <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#3b82f6"
                    strokeWidth={2.5}
                    fill="url(#revenueGrad)"
                    dot={{ r: 4, fill: "#3b82f6", strokeWidth: 2, stroke: "#fff" }}
                    activeDot={{ r: 6, fill: "#3b82f6", stroke: "#fff", strokeWidth: 2 }}
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

                // --- Efficient count queries (1 read per query regardless of doc count) ---
                const [totalLeadsSnap, convertedSnap, followUpSnap, installPendingSnap] = await Promise.all([
                    getCountFromServer(leadsRef),
                    getCountFromServer(query(leadsRef, where("status", "==", "Converted"))),
                    getCountFromServer(query(leadsRef, where("status", "==", "Follow-up"))),
                    getCountFromServer(query(clientsRef, where("status", "==", "In Progress"))),
                ]);

                // --- Recent leads (5 reads) ---
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

                // --- Calculate Pending Payments ---
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

                // --- Calculate Monthly Revenue ---
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

    return (
        <div className="max-w-6xl">
            {/* Header */}
            <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
                <div>
                    <h1 className="text-xl font-bold text-slate-800">Dashboard</h1>
                    <p className="text-xs text-slate-500 mt-0.5">Welcome back! Here's your CRM overview.</p>
                </div>
                <Link to="/leads">
                    <button className="px-4 py-2 rounded-lg bg-gradient-to-r from-orange-500 to-purple-500 text-white text-sm font-semibold border-none cursor-pointer shadow-md shadow-orange-500/20 hover:-translate-y-0.5 hover:shadow-lg transition-all">
                        View Leads
                    </button>
                </Link>
            </div>

            {/* KPI Cards Row 1 — Lead Counts */}
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Lead Overview</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4 mb-5">
                <KpiCard title="Total Leads" value={kpis.totalLeads} icon={Users} color="#3b82f6" bg="bg-blue-50" loading={loading} />
                <KpiCard title="Converted" value={kpis.converted} icon={TrendingUp} color="#10b981" bg="bg-emerald-50" loading={loading} />
            </div>

            {/* KPI Cards Row 2 — Action Required */}
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Action Required</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-7">
                <KpiCard
                    title="Pending Follow-ups"
                    value={kpis.followUps}
                    icon={Clock}
                    color="#f97316"
                    bg="bg-orange-50"
                    loading={loading}
                    to="/leads?status=Follow-up"
                />
                <KpiCard
                    title="Installations Pending"
                    value={kpis.installationsPending}
                    icon={Wrench}
                    color="#8b5cf6"
                    bg="bg-purple-50"
                    loading={loading}
                    to="/clients?status=In+Progress"
                />
                <KpiCard
                    title="Pending Payments"
                    value={loading ? "-" : `₹${kpis.pendingPayments.toLocaleString()}`}
                    icon={IndianRupee}
                    color="#ef4444"
                    bg="bg-red-50"
                    loading={loading}
                    to="/clients"
                />
            </div>

            {/* Revenue Chart + Monthly Revenue */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-7">
                {/* Monthly Revenue Card */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white border border-slate-200 rounded-xl p-5 hover:shadow-md transition-all"
                >
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center">
                            <IndianRupee size={18} className="text-emerald-600" />
                        </div>
                        <p className="text-sm font-semibold text-slate-600">This Month's Revenue</p>
                    </div>
                    {chartLoading ? (
                        <Skeleton className="h-8 w-32 mt-2" />
                    ) : (
                        <h2 className="text-3xl font-bold text-slate-800 mt-1">
                            ₹{kpis.monthlyRevenue.toLocaleString()}
                        </h2>
                    )}
                    <p className="text-xs text-slate-400 mt-1">Based on advance payments received</p>
                </motion.div>

                {/* Revenue Bar Chart */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5 hover:shadow-md transition-all"
                >
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
                                <BarChart2 size={18} className="text-orange-600" />
                            </div>
                            <p className="text-sm font-semibold text-slate-700">Revenue — Last 6 Months</p>
                        </div>
                        <p className="text-xs text-slate-400">Advance received</p>
                    </div>
                    <RevenueChart data={revenueChart} loading={chartLoading} />
                </motion.div>
            </div>

            {/* Quick Actions */}
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Quick Actions</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                <Link to="/leads" className="group flex items-center p-4 border border-slate-200 rounded-2xl bg-white hover:bg-slate-50 hover:border-orange-300 hover:shadow-lg hover:shadow-orange-500/10 transition-all cursor-pointer">
                    <div className="w-12 h-12 rounded-xl bg-blue-50 text-orange-600 flex items-center justify-center shrink-0 group-hover:scale-110 group-hover:bg-orange-600 group-hover:text-white transition-all duration-300">
                        <UserPlus size={24} />
                    </div>
                    <div className="ml-4">
                        <h3 className="text-sm font-bold text-slate-800">Add New Lead</h3>
                        <p className="text-xs text-slate-500 mt-0.5">Create a new prospect</p>
                    </div>
                </Link>
                <Link to="/clients" className="group flex items-center p-4 border border-slate-200 rounded-2xl bg-white hover:bg-slate-50 hover:border-purple-300 hover:shadow-lg hover:shadow-purple-500/10 transition-all cursor-pointer">
                    <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 group-hover:scale-110 group-hover:bg-purple-600 group-hover:text-white transition-all duration-300">
                        <Briefcase size={24} />
                    </div>
                    <div className="ml-4">
                        <h3 className="text-sm font-bold text-slate-800">Manage Clients</h3>
                        <p className="text-xs text-slate-500 mt-0.5">View existing projects</p>
                    </div>
                </Link>
                <Link to="/templates" className="group flex items-center p-4 border border-slate-200 rounded-2xl bg-white hover:bg-slate-50 hover:border-amber-300 hover:shadow-lg hover:shadow-amber-500/10 transition-all cursor-pointer">
                    <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 group-hover:scale-110 group-hover:bg-amber-500 group-hover:text-white transition-all duration-300">
                        <FileSignature size={24} />
                    </div>
                    <div className="ml-4">
                        <h3 className="text-sm font-bold text-slate-800">Quotations</h3>
                        <p className="text-xs text-slate-500 mt-0.5">Send a new proposal</p>
                    </div>
                </Link>
            </div>

            {/* Recent Leads Table */}
            <motion.div
                className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
            >
                <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center">
                            <Activity size={18} />
                        </div>
                        <h2 className="text-lg font-bold text-slate-800">Recent Leads Activity</h2>
                    </div>
                    <Link to="/leads" className="text-sm font-semibold text-orange-600 hover:text-orange-700 flex items-center gap-1 transition-colors">
                        View All <ArrowRight size={16} />
                    </Link>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left">
                        <thead>
                            <tr className="bg-white">
                                <th className="text-xs font-bold uppercase tracking-wider text-slate-400 py-4 px-6 border-b border-slate-100">Name</th>
                                <th className="text-xs font-bold uppercase tracking-wider text-slate-400 py-4 px-6 border-b border-slate-100">Contact</th>
                                <th className="text-xs font-bold uppercase tracking-wider text-slate-400 py-4 px-6 border-b border-slate-100">Status</th>
                                <th className="text-xs font-bold uppercase tracking-wider text-slate-400 py-4 px-6 border-b border-slate-100 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                Array.from({ length: 4 }).map((_, i) => (
                                    <tr key={i}>
                                        <td className="py-4 px-6 border-b border-slate-50"><Skeleton className="h-4 w-28" /></td>
                                        <td className="py-4 px-6 border-b border-slate-50"><Skeleton className="h-4 w-24" /></td>
                                        <td className="py-4 px-6 border-b border-slate-50"><Skeleton className="h-6 w-20 rounded-full" /></td>
                                        <td className="py-4 px-6 border-b border-slate-50 text-right"><Skeleton className="h-8 w-16 ml-auto rounded-lg" /></td>
                                    </tr>
                                ))
                            ) : recentLeads.length > 0 ? (
                                recentLeads.map((lead, i) => (
                                    <tr key={lead.id || i} className="hover:bg-slate-50/80 transition-colors group">
                                        <td className="py-4 px-6 text-sm font-semibold text-slate-800 border-b border-slate-50">{lead.name}</td>
                                        <td className="py-4 px-6 text-sm text-slate-500 border-b border-slate-50 font-medium">{lead.phone}</td>
                                        <td className="py-4 px-6 border-b border-slate-50">
                                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${statusStyle[lead.status] || "bg-slate-100 text-slate-600"}`}>
                                                {lead.status || "New"}
                                            </span>
                                        </td>
                                        <td className="py-4 px-6 border-b border-slate-50 text-right">
                                            <Link to={`/leads?lead=${lead.id}`} className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-white border border-slate-200 text-slate-600 text-xs font-bold hover:bg-blue-50 hover:text-orange-600 hover:border-orange-200 transition-all shadow-sm">
                                                Open
                                            </Link>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="4" className="py-8 text-center text-slate-500 text-sm">No recent leads found.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </motion.div>
        </div>
    );
}