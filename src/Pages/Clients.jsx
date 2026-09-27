import { useState, useEffect, useCallback } from "react";
import { collection, query, orderBy, getDocs, updateDoc, doc, serverTimestamp, addDoc, getCountFromServer, getDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { motion } from "framer-motion";
import { Loader2, Search, Eye, IndianRupee, Plus, Briefcase, ChevronLeft, ChevronRight } from "lucide-react";
import toast from "react-hot-toast";
import ViewClientModal from "../components/ViewClientModal";
import PaymentModal from "../components/PaymentModal";
import AddClientModal from "../components/AddClientModal";
import { useSearchParams } from "react-router-dom";

const PAGE_SIZE = 25;

const projectStatusStyle = {
    "In Progress": { badge: "bg-orange-500 text-white", select: "bg-blue-50 text-orange-600 border-orange-200" },
    "Completed": { badge: "bg-emerald-500 text-white", select: "bg-emerald-50 text-emerald-600 border-emerald-200" },
    "On Hold": { badge: "bg-orange-500 text-white", select: "bg-orange-50 text-orange-600 border-orange-200" },
};

function getDateRange(filter) {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (filter === "today") return { start, end: new Date(start.getTime() + 86400000) };
    if (filter === "this_week") {
        const day = start.getDay();
        const monday = new Date(start);
        monday.setDate(start.getDate() - (day === 0 ? 6 : day - 1));
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 7);
        return { start: monday, end: sunday };
    }
    if (filter === "this_month") {
        return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: new Date(now.getFullYear(), now.getMonth() + 1, 1) };
    }
    return null;
}

export default function Clients() {
    const [clients, setClients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchParams, setSearchParams] = useSearchParams();
    const [search, setSearch] = useState("");
    const [filterStatus, setFilterStatus] = useState(() => searchParams.get("status") || "All");
    const [dateFilter, setDateFilter] = useState(() => searchParams.get("date") || "all");
    const [totalCount, setTotalCount] = useState(0);
    const [page, setPage] = useState(1);

    // Modals
    const [viewOpen, setViewOpen] = useState(false);
    const [viewClient, setViewClient] = useState(null);
    const [paymentOpen, setPaymentOpen] = useState(false);
    const [paymentClient, setPaymentClient] = useState(null);
    const [addOpen, setAddOpen] = useState(false);
    const [addClientPrefill, setAddClientPrefill] = useState(null);

    // Fetch total count
    useEffect(() => {
        getCountFromServer(collection(db, "clients"))
            .then(snap => setTotalCount(snap.data().count))
            .catch(() => { });
    }, [clients]);

    const fetchAllData = useCallback(async () => {
        setLoading(true);
        try {
            const q = query(collection(db, "clients"), orderBy("createdAt", "desc"));
            const snap = await getDocs(q);
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setClients(data);
        } catch (err) {
            console.error("Failed to fetch clients:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchAllData(); }, [fetchAllData]);

    function refresh() {
        setPage(1);
        fetchAllData();
    }

    function handleNextPage() {
        setPage(p => p + 1);
    }

    function handlePrevPage() {
        setPage(p => Math.max(1, p - 1));
    }

    const clientId = searchParams.get("client");
    useEffect(() => {
        if (!clientId) { setViewOpen(false); setViewClient(null); return; }
        const existing = clients.find(c => c.id === clientId);
        if (existing) { setViewClient(existing); setViewOpen(true); }
        else {
            const fetch = async () => {
                try {
                    const snap = await getDoc(doc(db, "clients", clientId));
                    if (snap.exists()) { setViewClient({ id: snap.id, ...snap.data() }); setViewOpen(true); }
                    else setSearchParams(prev => { prev.delete("client"); return prev; }, { replace: true });
                } catch (e) { console.error(e); }
            };
            fetch();
        }
    }, [clientId, clients, setSearchParams]);

    // Sync filters to URL
    function setFilterStatusAndUrl(val) {
        setFilterStatus(val);
        setSearchParams(prev => {
            if (val === "All") prev.delete("status");
            else prev.set("status", val);
            return prev;
        }, { replace: true });
    }
    function setDateFilterAndUrl(val) {
        setDateFilter(val);
        setSearchParams(prev => {
            if (val === "all") prev.delete("date");
            else prev.set("date", val);
            return prev;
        }, { replace: true });
    }

    async function handleStatusChange(id, newStatus, oldStatus, client) {
        if (newStatus === oldStatus) return;
        setClients(prev => prev.map(c => c.id === id ? { ...c, status: newStatus } : c));
        try {
            await updateDoc(doc(db, "clients", id), { status: newStatus, updatedAt: serverTimestamp() });
            const clientKey = client.phone || client.name;
            await addDoc(collection(db, "client_activity"), {
                clientKey,
                message: `Status of project "${client.projectName}" changed to ${newStatus}`,
                type: "status_change",
                timestamp: serverTimestamp()
            });
        } catch (error) {
            console.error("Failed to update status:", error);
            setClients(prev => prev.map(c => c.id === id ? { ...c, status: oldStatus } : c));
            toast.error("Failed to update status.");
        }
    }

    // Client-side filtering
    const filtered = clients.filter(c => {
        const matchSearch = !search || [c.name, c.projectName, c.phone, c.company].some(v => v?.toLowerCase().includes(search.toLowerCase()));
        const matchStatus = filterStatus === "All" || c.status === filterStatus;
        let matchDate = true;
        if (dateFilter !== "all" && c.createdAt) {
            const range = getDateRange(dateFilter);
            if (range) {
                const created = c.createdAt.toDate ? c.createdAt.toDate() : new Date(c.createdAt.seconds * 1000);
                matchDate = created >= range.start && created < range.end;
            }
        }
        return matchSearch && matchStatus && matchDate;
    });

    // Group by client key — keep only projects matching the current filters
    const groupedClients = filtered.reduce((acc, client) => {
        const key = client.phone || client.name;
        if (!acc[key]) {
            acc[key] = {
                clientInfo: { name: client.name, phone: client.phone, email: client.email, company: client.company },
                projects: []
            };
        }
        acc[key].projects.push(client);
        return acc;
    }, {});

    // Hide client groups that have no projects after filtering
    const allVisibleGroups = Object.values(groupedClients).filter(g => g.projects.length > 0);

    const totalPages = Math.ceil(allVisibleGroups.length / PAGE_SIZE);
    const visibleGroups = allVisibleGroups.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    return (
        <div className="max-w-6xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Clients & Projects</h1>
                    <p className="text-sm text-slate-500 mt-1">{totalCount} total clients</p>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={() => { setAddClientPrefill(null); setAddOpen(true); }} className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-orange-500 to-purple-500 text-white text-sm font-semibold border-none cursor-pointer shadow-md shadow-orange-500/20 hover:-translate-y-0.5 transition-all">
                        <Plus size={16} /> Add Client
                    </button>
                </div>
            </div>

            {/* Filters Row */}
            <div className="flex flex-col gap-2 mb-4">
                <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 flex-1 min-w-[160px] focus-within:border-orange-500 focus-within:ring-2 focus-within:ring-orange-500/15 transition-all">
                        <Search size={15} className="text-slate-400 shrink-0" />
                        <input type="text" placeholder="Search client, project..." value={search} onChange={e => setSearch(e.target.value)} className="border-none outline-none bg-transparent text-sm text-slate-700 w-full placeholder:text-slate-400" />
                    </div>
                    <select value={filterStatus} onChange={e => setFilterStatusAndUrl(e.target.value)} className="border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-600 outline-none bg-white cursor-pointer focus:border-orange-500 shrink-0">
                        <option value="All">All Statuses</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Completed">Completed</option>
                        <option value="On Hold">On Hold</option>
                    </select>
                </div>
                <div className="flex items-center bg-white border border-slate-200 rounded-xl overflow-x-auto overflow-hidden">
                    {[
                        { key: "all", label: "All Time" },
                        { key: "today", label: "Today" },
                        { key: "this_week", label: "This Week" },
                        { key: "this_month", label: "This Month" },
                    ].map(d => (
                        <button
                            key={d.key}
                            onClick={() => setDateFilterAndUrl(d.key)}
                            className={`px-3 py-2 text-xs font-medium border-none cursor-pointer transition-all whitespace-nowrap ${dateFilter === d.key ? "bg-orange-500 text-white" : "bg-transparent text-slate-500 hover:bg-slate-50"}`}
                        >
                            {d.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Table + Card View */}
            <motion.div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                {loading ? (
                    <div className="flex items-center justify-center py-16">
                        <Loader2 size={28} className="animate-spin text-orange-500" />
                    </div>
                ) : visibleGroups.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                        <p className="text-base font-medium">No clients found</p>
                        <p className="text-sm mt-1">Adjust your filters or add a new client</p>
                    </div>
                ) : (
                    <>
                        {/* Desktop Table (hidden on mobile) */}
                        <div className="hidden sm:block overflow-x-auto">
                            <table className="w-full border-collapse text-left">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200">
                                        <th className="text-xs font-semibold uppercase tracking-wider text-slate-500 py-3 px-6 w-1/3 border-r border-slate-200">Client Info</th>
                                        <th className="text-xs font-semibold uppercase tracking-wider text-slate-500 py-3 px-6">Projects</th>
                                    </tr>
                                </thead>
                                {visibleGroups.map((group, idx) => (
                                    <tbody key={idx} className="border-b border-slate-200 hover:bg-slate-50/30 transition-colors">
                                        <tr>
                                            <td className="py-5 px-6 align-top w-1/3 border-r border-slate-200 bg-slate-50/30">
                                                <div className="text-base font-bold text-slate-800">{group.clientInfo.name}</div>
                                                <div className="text-sm font-medium text-slate-500 mt-1">{group.clientInfo.phone || "No Phone"}</div>
                                                {group.clientInfo.email && <div className="text-xs text-slate-400 mt-1">{group.clientInfo.email}</div>}
                                                {group.clientInfo.company && <div className="text-xs text-slate-400 mt-1">{group.clientInfo.company}</div>}
                                                <div className="mt-4 flex flex-wrap gap-2">
                                                    <button onClick={() => { setAddClientPrefill(group.clientInfo); setAddOpen(true); }} className="flex items-center gap-1.5 text-xs font-bold text-orange-600 hover:text-orange-700 bg-orange-100/50 hover:bg-orange-100 px-3 py-1.5 rounded-lg transition-colors cursor-pointer border-none shadow-sm">
                                                        <Briefcase size={14} /> Add Project
                                                    </button>
                                                    <button onClick={() => {
                                                        setSearchParams(prev => { prev.set("client", group.projects[0].id); return prev; });
                                                    }} className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-700 bg-slate-200/50 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-colors cursor-pointer border-none shadow-sm" title="View Client Logs">
                                                        <Eye size={14} /> View Logs
                                                    </button>
                                                </div>
                                            </td>
                                            <td className="p-0 align-top">
                                                <table className="w-full">
                                                    <tbody>
                                                        {group.projects.map((client, pIdx) => {
                                                            const paid = client.advanceReceived || 0;
                                                            const pending = (client.projectPrice || 0) - paid;
                                                            return (
                                                                <tr key={client.id} className={`${pIdx !== group.projects.length - 1 ? 'border-b border-slate-100' : ''} hover:bg-white/80 transition-colors`}>
                                                                    <td className="py-4 px-6 w-1/3">
                                                                        <div className="text-sm font-semibold text-slate-800">{client.projectName}</div>
                                                                    </td>
                                                                    <td className="py-4 px-6">
                                                                        <div className="flex flex-col gap-1.5">
                                                                            <div className="text-xs text-slate-500 flex justify-between w-32">
                                                                                <span>Price:</span>
                                                                                <span className="font-semibold text-slate-700">₹{client.projectPrice?.toLocaleString() || 0}</span>
                                                                            </div>
                                                                            <div className="text-xs text-slate-500 flex justify-between w-32">
                                                                                <span>Paid:</span>
                                                                                <span className="font-semibold text-emerald-600">₹{paid.toLocaleString()}</span>
                                                                            </div>
                                                                            <div className="text-xs text-slate-500 flex justify-between w-32">
                                                                                <span>Pending:</span>
                                                                                <span className="font-semibold text-amber-600">₹{pending.toLocaleString()}</span>
                                                                            </div>
                                                                        </div>
                                                                    </td>
                                                                    <td className="py-4 px-6 w-36">
                                                                        <div className="flex flex-col gap-1.5">
                                                                            <span className={`inline-flex items-center justify-center px-2.5 py-1 rounded-full text-xs font-bold ${(projectStatusStyle[client.status] || {}).badge || "bg-slate-200 text-slate-600"}`}>
                                                                                {client.status}
                                                                            </span>
                                                                            {client.status !== "Completed" && (
                                                                                <select
                                                                                    value={client.status}
                                                                                    onChange={(e) => handleStatusChange(client.id, e.target.value, client.status, client)}
                                                                                    className={`w-full px-2 py-1 rounded-lg text-[10px] font-semibold outline-none border cursor-pointer ${(projectStatusStyle[client.status] || {}).select || "bg-slate-50 text-slate-600 border-slate-200"}`}
                                                                                >
                                                                                    <option value="In Progress">In Progress</option>
                                                                                    <option value="Completed">Completed</option>
                                                                                    <option value="On Hold">On Hold</option>
                                                                                </select>
                                                                            )}
                                                                        </div>
                                                                    </td>
                                                                    <td className="py-4 px-6 w-28 text-right">
                                                                        <div className="flex items-center justify-end gap-1.5">
                                                                            <button onClick={() => { setPaymentClient(client); setPaymentOpen(true); }} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 bg-slate-100 border-none cursor-pointer hover:bg-emerald-100 hover:text-emerald-600 transition-all shadow-sm" title="Manage Payments">
                                                                                <IndianRupee size={14} />
                                                                            </button>
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </td>
                                        </tr>
                                    </tbody>
                                ))}
                            </table>
                        </div>

                        {/* Mobile Card View (hidden on sm+) */}
                        <div className="sm:hidden divide-y divide-slate-100">
                            {visibleGroups.map((group, idx) => (
                                <div key={idx} className="p-4">
                                    {/* Client header */}
                                    <div className="flex items-start justify-between mb-3">
                                        <div>
                                            <p className="text-sm font-bold text-slate-800">{group.clientInfo.name}</p>
                                            <p className="text-xs text-slate-500 mt-0.5">{group.clientInfo.phone || "No Phone"}</p>
                                            {group.clientInfo.company && <p className="text-xs text-slate-400">{group.clientInfo.company}</p>}
                                        </div>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            <button onClick={() => { setAddClientPrefill(group.clientInfo); setAddOpen(true); }} className="flex items-center gap-1 text-[10px] font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded-lg border-none cursor-pointer">
                                                <Briefcase size={11} /> Add
                                            </button>
                                            <button onClick={() => setSearchParams(prev => { prev.set("client", group.projects[0].id); return prev; })} className="flex items-center gap-1 text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded-lg border-none cursor-pointer">
                                                <Eye size={11} /> Logs
                                            </button>
                                        </div>
                                    </div>
                                    {/* Projects */}
                                    <div className="space-y-2">
                                        {group.projects.map((client) => {
                                            const paid = client.advanceReceived || 0;
                                            const pending = (client.projectPrice || 0) - paid;
                                            return (
                                                <div key={client.id} className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                                                    <div className="flex items-start justify-between gap-2 mb-2">
                                                        <p className="text-xs font-semibold text-slate-800 flex-1">{client.projectName}</p>
                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${(projectStatusStyle[client.status] || {}).badge || "bg-slate-200 text-slate-600"}`}>
                                                            {client.status}
                                                        </span>
                                                    </div>
                                                    <div className="grid grid-cols-3 gap-2 mb-2">
                                                        <div className="text-center">
                                                            <p className="text-[9px] text-slate-400 uppercase font-semibold">Price</p>
                                                            <p className="text-xs font-bold text-slate-700">₹{(client.projectPrice || 0).toLocaleString()}</p>
                                                        </div>
                                                        <div className="text-center">
                                                            <p className="text-[9px] text-slate-400 uppercase font-semibold">Paid</p>
                                                            <p className="text-xs font-bold text-emerald-600">₹{paid.toLocaleString()}</p>
                                                        </div>
                                                        <div className="text-center">
                                                            <p className="text-[9px] text-slate-400 uppercase font-semibold">Due</p>
                                                            <p className="text-xs font-bold text-amber-600">₹{pending.toLocaleString()}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        {client.status !== "Completed" && (
                                                            <select
                                                                value={client.status}
                                                                onChange={(e) => handleStatusChange(client.id, e.target.value, client.status, client)}
                                                                className={`flex-1 px-2 py-1.5 rounded-lg text-[10px] font-semibold outline-none border cursor-pointer ${(projectStatusStyle[client.status] || {}).select || "bg-slate-50 text-slate-600 border-slate-200"}`}
                                                            >
                                                                <option value="In Progress">In Progress</option>
                                                                <option value="Completed">Completed</option>
                                                                <option value="On Hold">On Hold</option>
                                                            </select>
                                                        )}
                                                        <button onClick={() => { setPaymentClient(client); setPaymentOpen(true); }} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-600 bg-emerald-50 border-none cursor-pointer hover:bg-emerald-100 transition-all">
                                                            <IndianRupee size={12} /> Payment
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}

                {/* Pagination */}
                {!loading && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200">
                        <p className="text-xs text-slate-400">Page {page}{totalPages > 0 ? ` of ~${totalPages}` : ""} · Showing {visibleGroups.length} client groups</p>
                        <div className="flex items-center gap-2">
                            <button onClick={handlePrevPage} disabled={page <= 1} className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-500 text-xs font-medium bg-white cursor-pointer hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                                <ChevronLeft size={14} /> Prev
                            </button>
                            <button onClick={handleNextPage} disabled={page >= totalPages} className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-500 text-xs font-medium bg-white cursor-pointer hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                                Next <ChevronRight size={14} />
                            </button>
                        </div>
                    </div>
                )}
            </motion.div>

            {/* Modals */}
            <ViewClientModal isOpen={viewOpen} onClose={() => {
                setSearchParams(prev => { prev.delete("client"); return prev; });
            }} client={viewClient} />
            <PaymentModal isOpen={paymentOpen} onClose={() => setPaymentOpen(false)} client={paymentClient} onPaymentAdded={refresh} />
            <AddClientModal isOpen={addOpen} onClose={() => setAddOpen(false)} onClientAdded={refresh} prefillData={addClientPrefill} />
        </div>
    );
}
