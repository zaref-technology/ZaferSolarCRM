import { useState, useEffect, useCallback } from "react";
import { collection, addDoc, updateDoc, deleteDoc, doc, query, orderBy, getDocs, writeBatch, serverTimestamp, getCountFromServer, getDoc, where } from "firebase/firestore";
import { db } from "../../firebase";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Upload, Search, Edit2, Eye, Trash2, Loader2, ChevronLeft, ChevronRight, CheckSquare, Square, X, Merge, Download, FileText, Briefcase, ChevronDown, Settings2, Pin, PinOff } from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { getTagColor } from "../utils/leadTags";
import LeadModal from "../components/LeadModal";
import BulkImportModal from "../components/BulkImportModal";
import ViewLeadModal from "../components/ViewLeadModal";
import MergeDuplicatesModal from "../components/MergeDuplicatesModal";
import ConvertLeadModal from "../components/ConvertLeadModal";
import toast from "react-hot-toast";
import { useSearchParams } from "react-router-dom";

const PAGE_SIZE = 25;

const statusStyle = {
    New: "bg-orange-500 text-white shadow-sm shadow-orange-500/20",
    "Follow-up": "bg-orange-500 text-white shadow-sm shadow-orange-500/20",
    Negotiation: "bg-amber-500 text-white shadow-sm shadow-amber-500/20",
    Converted: "bg-emerald-500 text-white shadow-sm shadow-emerald-500/20",
    Lost: "bg-red-500 text-white shadow-sm shadow-red-500/20",
};

function getDateRange(filter) {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (filter === "today") {
        return { start, end: new Date(start.getTime() + 86400000) };
    }
    if (filter === "this_week") {
        const day = start.getDay();
        const monday = new Date(start);
        monday.setDate(start.getDate() - (day === 0 ? 6 : day - 1));
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 7);
        return { start: monday, end: sunday };
    }
    if (filter === "this_month") {
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        return { start: monthStart, end: monthEnd };
    }
    return null;
}

function formatLeadDate(value) {
    if (!value) return "";
    const date = value.toDate ? value.toDate() : value.seconds ? new Date(value.seconds * 1000) : new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString("en-IN");
}

function mapLeadForExport(data) {
    return {
        Name: data.name || "",
        Phone: data.phone || "",
        Email: data.email || "",
        Company: data.company || "",
        Source: data.source || "",
        Status: data.status || "",
        Tags: (data.tags || []).join(", "),
        Notes: data.notes || "",
        "Created At": formatLeadDate(data.createdAt),
    };
}

export default function Leads() {
    const [leads, setLeads] = useState([]);
    const [pinnedLeads, setPinnedLeads] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchParams, setSearchParams] = useSearchParams();
    const [search, setSearch] = useState("");
    const [filterStatus, setFilterStatus] = useState(() => searchParams.get("status") || "All");
    const [dateFilter, setDateFilter] = useState(() => searchParams.get("date") || "all");
    const [totalCount, setTotalCount] = useState(0);

    const [page, setPage] = useState(1);

    // Modals
    const [modalOpen, setModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState("add");
    const [selectedLead, setSelectedLead] = useState(null);
    const [viewOpen, setViewOpen] = useState(false);
    const [viewLead, setViewLead] = useState(null);
    const [bulkOpen, setBulkOpen] = useState(false);
    const [mergeOpen, setMergeOpen] = useState(false);
    const [convertOpen, setConvertOpen] = useState(false);
    const [actionsOpen, setActionsOpen] = useState(false);
    const [leadToConvert, setLeadToConvert] = useState(null);
    const [deleting, setDeleting] = useState(null);
    const [exporting, setExporting] = useState(null);

    // Bulk selection
    const [selected, setSelected] = useState(new Set());
    const [bulkDeleting, setBulkDeleting] = useState(false);
    const [selectionMode, setSelectionMode] = useState(false);
    const [focusedIndex, setFocusedIndex] = useState(-1);

    useEffect(() => {
        setFocusedIndex(-1);
    }, [page, search, filterStatus, dateFilter]);

    // Fetch total count
    useEffect(() => {
        getCountFromServer(collection(db, "leads")).then((snap) => setTotalCount(snap.data().count)).catch(() => { });
    }, [leads]);

    const fetchPinnedLeads = useCallback(async () => {
        try {
            const q = query(collection(db, "leads"), where("isPinned", "==", true));
            const snap = await getDocs(q);
            const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            data.sort((a, b) => {
                const aTime = a.createdAt?.seconds || 0;
                const bTime = b.createdAt?.seconds || 0;
                return bTime - aTime;
            });
            setPinnedLeads(data);
        } catch (err) {
            console.error("Failed to fetch pinned leads:", err);
        }
    }, []);

    useEffect(() => {
        fetchPinnedLeads();
    }, [fetchPinnedLeads]);

    async function handlePinToggle(lead) {
        const newPinnedStatus = !lead.isPinned;

        // Optimistic update
        if (newPinnedStatus) {
            setPinnedLeads(prev => [{ ...lead, isPinned: true }, ...prev].sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
        } else {
            setPinnedLeads(prev => prev.filter(l => l.id !== lead.id));
        }

        try {
            await updateDoc(doc(db, "leads", lead.id), { isPinned: newPinnedStatus });
            await logActivity(lead.id, `Lead ${newPinnedStatus ? "pinned" : "unpinned"}`, "update");
        } catch (error) {
            console.error("Failed to toggle pin:", error);
            toast.error("Failed to update pin status.");
            fetchPinnedLeads(); // Revert on failure
        }
    }

    const leadId = searchParams.get("lead");

    useEffect(() => {
        if (!leadId) {
            setViewOpen(false);
            setViewLead(null);
            return;
        }

        const existingLead = leads.find(l => l.id === leadId);
        if (existingLead) {
            setViewLead(existingLead);
            setViewOpen(true);
        } else {
            const fetchLead = async () => {
                try {
                    const docRef = doc(db, "leads", leadId);
                    const docSnap = await getDoc(docRef);
                    if (docSnap.exists()) {
                        setViewLead({ id: docSnap.id, ...docSnap.data() });
                        setViewOpen(true);
                    } else {
                        setSearchParams(prev => {
                            prev.delete("lead");
                            return prev;
                        }, { replace: true });
                    }
                } catch (error) {
                    console.error("Failed to fetch lead:", error);
                }
            };
            fetchLead();
        }
    }, [leadId, leads, setSearchParams]);

    // Fetch all data
    const fetchAllData = useCallback(async () => {
        setLoading(true);
        try {
            const q = query(collection(db, "leads"), orderBy("createdAt", "desc"));
            const snap = await getDocs(q);
            const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            setLeads(data);
        } catch (err) {
            console.error("Failed to fetch leads:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAllData();
    }, [fetchAllData]);

    // Next page
    function handleNextPage() {
        setPage((p) => p + 1);
    }

    // Prev page
    function handlePrevPage() {
        if (page <= 1) return;
        setPage((p) => p - 1);
    }

    // Refresh current page
    function refresh() {
        setPage(1);
        setSelected(new Set());
        fetchPinnedLeads();
        fetchAllData();
    }

    // Activity log helper
    async function logActivity(leadId, message, type = "update") {
        try {
            await addDoc(collection(db, "leads", leadId, "activity"), {
                message, type, timestamp: serverTimestamp(),
            });
        } catch (err) { console.error("Activity log failed:", err); }
    }

    // Add / Edit
    async function handleSave(form) {
        if (modalMode === "edit" && selectedLead?.id) {
            if (form.status === "Converted" && selectedLead.status !== "Converted") {
                setLeadToConvert({ ...selectedLead, ...form });
                setConvertOpen(true);
                setModalOpen(false);
                return;
            }

            const changes = [];
            if (selectedLead.status !== form.status) changes.push(`Status changed from "${selectedLead.status}" to "${form.status}"`);
            if (selectedLead.name !== form.name) changes.push(`Name updated to "${form.name}"`);
            if (selectedLead.phone !== form.phone) changes.push(`Phone updated`);
            if (selectedLead.email !== form.email) changes.push(`Email updated`);
            if ((selectedLead.tags || []).join() !== (form.tags || []).join()) changes.push(`Tags updated`);

            await updateDoc(doc(db, "leads", selectedLead.id), { ...form, updatedAt: serverTimestamp() });
            const msg = changes.length > 0 ? changes.join(". ") : "Lead details updated";
            await logActivity(selectedLead.id, msg, changes.some((c) => c.startsWith("Status")) ? "status_change" : "update");
        } else {
            const ref = await addDoc(collection(db, "leads"), { ...form, createdAt: serverTimestamp() });
            await logActivity(ref.id, "Lead created", "created");
        }
        refresh();
    }

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

    // Inline Status Change
    async function handleStatusChange(id, newStatus, oldStatus) {
        if (newStatus === oldStatus) return;

        if (newStatus === "Converted") {
            const lead = leads.find(l => l.id === id);
            setLeadToConvert(lead);
            setConvertOpen(true);
            return;
        }

        // Optimistic update
        setLeads(prev => prev.map(l => l.id === id ? { ...l, status: newStatus } : l));

        try {
            await updateDoc(doc(db, "leads", id), { status: newStatus, updatedAt: serverTimestamp() });
            await logActivity(id, `Status changed from "${oldStatus}" to "${newStatus}"`, "status_change");
        } catch (error) {
            console.error("Failed to update status:", error);
            // Revert
            setLeads(prev => prev.map(l => l.id === id ? { ...l, status: oldStatus } : l));
            toast.error("Failed to update status.");
        }
    }

    // Delete
    async function handleDelete(id) {
        if (!confirm("Are you sure you want to delete this lead?")) return;
        setDeleting(id);
        try {
            await deleteDoc(doc(db, "leads", id));
            refresh();
        } finally {
            setDeleting(null);
        }
    }

    // Bulk Import
    async function handleBulkImport(rows) {
        const batch = writeBatch(db);
        rows.forEach((row) => {
            const ref = doc(collection(db, "leads"));
            batch.set(ref, { ...row, createdAt: serverTimestamp() });
        });
        await batch.commit();
        refresh();
        return rows.length;
    }

    // Bulk Delete (chunks of 500 for Firestore batch limit)
    async function handleBulkDelete() {
        if (selected.size === 0) return;

        const idsToDelete = Array.from(selected).filter(id => {
            const lead = leads.find(l => l.id === id);
            return lead && lead.status !== "Converted";
        });

        if (idsToDelete.length === 0) {
            toast.error("No deletable leads selected. Converted leads cannot be deleted.");
            return;
        }

        if (!confirm(`Are you sure you want to delete ${idsToDelete.length} lead${idsToDelete.length > 1 ? "s" : ""}? Converted leads will be skipped. This cannot be undone.`)) return;
        setBulkDeleting(true);
        try {
            // Firestore batch limit is 500
            for (let i = 0; i < idsToDelete.length; i += 500) {
                const chunk = idsToDelete.slice(i, i + 500);
                const batch = writeBatch(db);
                chunk.forEach((id) => batch.delete(doc(db, "leads", id)));
                await batch.commit();
            }
            refresh();
        } catch (err) {
            console.error("Bulk delete failed:", err);
            toast.error("Failed to delete some leads. Please try again.");
        } finally {
            setBulkDeleting(false);
        }
    }

    // Selection helpers
    function toggleSelect(id) {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }

    function toggleSelectAll() {
        if (selected.size === filtered.length) {
            setSelected(new Set());
        } else {
            setSelected(new Set(filtered.map((l) => l.id)));
        }
    }

    async function getExportRows() {
        const snap = await getDocs(query(collection(db, "leads"), orderBy("createdAt", "desc")));
        return snap.docs.map((d) => mapLeadForExport(d.data()));
    }

    // Export to Excel
    async function handleExcelExport() {
        setExporting("excel");
        try {
            const allLeads = await getExportRows();
            if (allLeads.length === 0) {
                toast.error("No leads to export.");
                return;
            }
            const ws = XLSX.utils.json_to_sheet(allLeads);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Leads");
            XLSX.writeFile(wb, `Zaref_Solar_CRM_Leads_${new Date().toISOString().slice(0, 10)}.xlsx`);
        } catch (err) {
            console.error("Excel export failed:", err);
            toast.error("Failed to export leads. Please try again.");
        } finally {
            setExporting(null);
        }
    }

    // Export to PDF
    async function handlePdfExport() {
        setExporting("pdf");
        try {
            const allLeads = await getExportRows();
            if (allLeads.length === 0) {
                toast.error("No leads to export.");
                return;
            }

            const reportDate = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
            const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });

            doc.setFont("helvetica", "bold");
            doc.setFontSize(18);
            doc.setTextColor(15, 23, 42);
            doc.text("Zaref Solar CRM Leads", 40, 42);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(10);
            doc.setTextColor(100, 116, 139);
            doc.text(`Generated ${reportDate} · ${allLeads.length} lead${allLeads.length === 1 ? "" : "s"}`, 40, 60);

            autoTable(doc, {
                startY: 82,
                head: [["Name", "Phone", "Email", "Company", "Source", "Status", "Tags", "Created At"]],
                body: allLeads.map((lead) => [
                    lead.Name,
                    lead.Phone,
                    lead.Email,
                    lead.Company,
                    lead.Source,
                    lead.Status,
                    lead.Tags,
                    lead["Created At"],
                ]),
                margin: { left: 40, right: 40, bottom: 42 },
                styles: {
                    fontSize: 8,
                    cellPadding: 5,
                    overflow: "linebreak",
                    valign: "middle",
                    textColor: [51, 65, 85],
                    lineColor: [226, 232, 240],
                    lineWidth: 0.5,
                },
                headStyles: {
                    fillColor: [245, 158, 11],
                    textColor: [255, 255, 255],
                    fontStyle: "bold",
                },
                alternateRowStyles: { fillColor: [248, 250, 252] },
                columnStyles: {
                    0: { cellWidth: 100 },
                    1: { cellWidth: 75 },
                    2: { cellWidth: 120 },
                    3: { cellWidth: 95 },
                    4: { cellWidth: 70 },
                    5: { cellWidth: 82 },
                    6: { cellWidth: 118 },
                    7: { cellWidth: 68 },
                },
                didDrawPage: () => {
                    const pageWidth = doc.internal.pageSize.getWidth();
                    const pageHeight = doc.internal.pageSize.getHeight();
                    doc.setFont("helvetica", "normal");
                    doc.setFontSize(8);
                    doc.setTextColor(100, 116, 139);
                    doc.text(`Page ${doc.internal.getCurrentPageInfo().pageNumber}`, pageWidth - 70, pageHeight - 24);
                },
            });

            doc.save(`Zaref_Solar_CRM_Leads_${new Date().toISOString().slice(0, 10)}.pdf`);
        } catch (err) {
            console.error("PDF export failed:", err);
            toast.error("Failed to export PDF. Please try again.");
        } finally {
            setExporting(null);
        }
    }

    // Open modals
    function openAdd() { setSelectedLead(null); setModalMode("add"); setModalOpen(true); }
    function openEdit(lead) { setSelectedLead(lead); setModalMode("edit"); setModalOpen(true); }
    function openView(lead) {
        setSearchParams(prev => {
            prev.set("lead", lead.id);
            return prev;
        });
    }

    // Client-side filtering (search, status, date)
    const filterLeadsArray = (leadArray) => leadArray.filter((l) => {
        const matchSearch = !search || [l.name, l.phone, l.email, l.company].some((v) => v?.toLowerCase().includes(search.toLowerCase()));
        const matchStatus = filterStatus === "All" || l.status === filterStatus;

        let matchDate = true;
        if (dateFilter !== "all" && l.createdAt) {
            const range = getDateRange(dateFilter);
            if (range) {
                const created = l.createdAt.toDate ? l.createdAt.toDate() : new Date(l.createdAt.seconds * 1000);
                matchDate = created >= range.start && created < range.end;
            }
        }

        return matchSearch && matchStatus && matchDate;
    });

    const filteredPinned = filterLeadsArray(pinnedLeads);
    const filteredPaginated = filterLeadsArray(leads).filter(l => !pinnedLeads.find(p => p.id === l.id));
    const filteredTotal = [...filteredPinned, ...filteredPaginated];

    const filtered = filteredTotal.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    const statuses = ["All", ...Object.keys(statusStyle)];
    const totalPages = Math.ceil(filteredTotal.length / PAGE_SIZE);

    // Keyboard navigation — placed after filtered is computed
    useEffect(() => {
        function handleKeyDown(e) {
            if (modalOpen || viewOpen || bulkOpen || mergeOpen || convertOpen) return;
            if (["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)) return;

            if (e.key === "ArrowDown") {
                e.preventDefault();
                setFocusedIndex(prev => Math.min(prev + 1, filtered.length - 1));
            } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setFocusedIndex(prev => Math.max(prev - 1, 0));
            } else if (e.key === "Enter" && focusedIndex >= 0 && focusedIndex < filtered.length) {
                e.preventDefault();
                const lead = filtered[focusedIndex];
                setSearchParams(prev => {
                    prev.set("lead", lead.id);
                    return prev;
                });
            } else if (e.key === "Escape") {
                setFocusedIndex(-1);
            }
        }

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [filtered, modalOpen, viewOpen, bulkOpen, mergeOpen, convertOpen, focusedIndex, setSearchParams]);

    return (
        <div className="max-w-6xl">
            {/* Header */}
            <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
                <div>
                    <h1 className="text-xl font-bold text-slate-800">Leads</h1>
                    <p className="text-xs text-slate-500 mt-0.5">{totalCount} total leads</p>
                </div>

                <div className="flex items-center gap-2">
                    <button onClick={() => {
                        setSelectionMode(!selectionMode);
                        if (selectionMode) setSelected(new Set());
                    }} className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-semibold cursor-pointer transition-all ${selectionMode ? 'bg-blue-50 border-orange-200 text-orange-600 shadow-sm' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm'}`}>
                        <CheckSquare size={16} className={selectionMode ? "text-orange-500" : "text-slate-500"} />
                        <span className="hidden sm:inline">{selectionMode ? "Done" : "Select"}</span>
                    </button>
                    <div className="relative">
                        <button onClick={() => setActionsOpen(!actionsOpen)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-semibold cursor-pointer hover:bg-slate-50 hover:border-slate-300 bg-white shadow-sm transition-all">
                            <Settings2 size={16} className="text-slate-500" /> Actions <ChevronDown size={14} className={`text-slate-400 transition-transform ${actionsOpen ? "rotate-180" : ""}`} />
                        </button>

                        <AnimatePresence>
                            {actionsOpen && (
                                <>
                                    <div className="fixed inset-0 z-10" onClick={() => setActionsOpen(false)}></div>
                                    <motion.div initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }} transition={{ duration: 0.15 }} className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-100 z-20 overflow-hidden">
                                        <div className="px-3 py-2 border-b border-slate-100 bg-slate-50/50">
                                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Lead Management</p>
                                        </div>
                                        <div className="p-1.5">
                                            <button onClick={() => { setActionsOpen(false); setBulkOpen(true); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-colors border-none bg-transparent cursor-pointer text-left">
                                                <Upload size={16} className="text-orange-500" /> Import Leads
                                            </button>
                                            <button onClick={() => { setActionsOpen(false); setMergeOpen(true); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold text-purple-600 hover:bg-purple-50 transition-colors border-none bg-transparent cursor-pointer text-left mt-0.5">
                                                <Merge size={16} /> Merge Duplicates
                                            </button>
                                        </div>
                                        <div className="px-3 py-2 border-y border-slate-100 bg-slate-50/50">
                                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Export Data</p>
                                        </div>
                                        <div className="p-1.5">
                                            <button onClick={() => { setActionsOpen(false); handleExcelExport(); }} disabled={exporting !== null} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-colors border-none bg-transparent cursor-pointer text-left disabled:opacity-60">
                                                {exporting === "excel" ? <Loader2 size={16} className="animate-spin text-emerald-500" /> : <Download size={16} className="text-emerald-500" />} Export to Excel
                                            </button>
                                            <button onClick={() => { setActionsOpen(false); handlePdfExport(); }} disabled={exporting !== null} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-colors border-none bg-transparent cursor-pointer text-left mt-0.5 disabled:opacity-60">
                                                {exporting === "pdf" ? <Loader2 size={16} className="animate-spin text-orange-500" /> : <FileText size={16} className="text-orange-500" />} Export to PDF
                                            </button>
                                        </div>
                                    </motion.div>
                                </>
                            )}
                        </AnimatePresence>
                    </div>
                    <button onClick={openAdd} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-purple-500 text-white text-sm font-bold border-none cursor-pointer shadow-md shadow-orange-500/20 hover:-translate-y-0.5 transition-all">
                        <Plus size={18} /> Add Lead
                    </button>
                </div>
            </div>

            {/* Filters Row */}
            <div className="flex flex-col gap-2 mb-4">
                {/* Search + Status row */}
                <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 flex-1 min-w-[160px] focus-within:border-orange-500 focus-within:ring-2 focus-within:ring-orange-500/15 transition-all">
                        <Search size={15} className="text-slate-400 shrink-0" />
                        <input type="text" placeholder="Search name, phone, email..." value={search} onChange={(e) => setSearch(e.target.value)} className="border-none outline-none bg-transparent text-sm text-slate-700 w-full placeholder:text-slate-400" />
                    </div>
                    <select value={filterStatus} onChange={(e) => setFilterStatusAndUrl(e.target.value)} className="border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-600 outline-none bg-white cursor-pointer focus:border-orange-500 shrink-0">
                        {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>
                {/* Date filter — scrollable on mobile */}
                <div className="flex items-center bg-white border border-slate-200 rounded-xl overflow-x-auto overflow-hidden">
                    {[
                        { key: "all", label: "All Time" },
                        { key: "today", label: "Today" },
                        { key: "this_week", label: "This Week" },
                        { key: "this_month", label: "This Month" },
                    ].map((d) => (
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

            {/* Table/Card View */}
            <motion.div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                {loading ? (
                    <div className="flex items-center justify-center py-16">
                        <Loader2 size={28} className="animate-spin text-orange-500" />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                        <p className="text-base font-medium">No leads found</p>
                        <p className="text-sm mt-1">Add your first lead or adjust filters</p>
                    </div>
                ) : (
                    <>
                        {/* Desktop Table (hidden on mobile) */}
                        <div className="hidden sm:block overflow-x-auto">
                            <table className="w-full border-collapse text-left">
                                <thead>
                                    <tr className="bg-slate-50">
                                        {selectionMode && (
                                            <th className="w-10 py-3 px-3 border-b border-slate-200 transition-all">
                                                <button onClick={toggleSelectAll} className="flex items-center justify-center w-5 h-5 border-none bg-transparent cursor-pointer text-slate-400 hover:text-orange-500 transition-colors">
                                                    {selected.size > 0 && selected.size === filtered.length ? <CheckSquare size={18} className="text-orange-500" /> : <Square size={18} />}
                                                </button>
                                            </th>
                                        )}
                                        {["Name", "Phone", "Email", "Source", "Status", "Actions"].map((h) => (
                                            <th key={h} className={`text-xs font-semibold uppercase tracking-wider text-slate-500 py-3 px-4 border-b border-slate-200 ${h === "Actions" ? "text-right" : ""}`}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map((lead, index) => (
                                        <tr key={lead.id} className={`group transition-colors ${selected.has(lead.id) ? "bg-blue-50/60" : lead.isPinned ? "bg-amber-50/30 hover:bg-amber-50/50" : "hover:bg-slate-50"} ${focusedIndex === index ? "ring-1 ring-inset ring-orange-500 bg-blue-50/40" : ""}`}>
                                            {selectionMode && (
                                                <td className="py-3.5 px-3 border-b border-slate-100 transition-all">
                                                    <button onClick={() => toggleSelect(lead.id)} className="flex items-center justify-center w-5 h-5 border-none bg-transparent cursor-pointer text-slate-400 hover:text-orange-500 transition-colors">
                                                        {selected.has(lead.id) ? <CheckSquare size={18} className="text-orange-500" /> : <Square size={18} />}
                                                    </button>
                                                </td>
                                            )}
                                            <td className="py-3.5 px-4 text-sm font-medium text-slate-800 border-b border-slate-100">
                                                <div className="flex items-center gap-1.5">
                                                    {lead.name}
                                                    {lead.isPinned && <Pin size={12} className="text-amber-500 fill-amber-500" />}
                                                </div>
                                                {lead.company && <div className="text-xs text-slate-400 mt-0.5">{lead.company}</div>}
                                                {lead.tags?.length > 0 && (
                                                    <div className="flex flex-wrap gap-1 mt-1">
                                                        {lead.tags.slice(0, 3).map((tag) => (
                                                            <span key={tag} className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${getTagColor(tag)}`}>{tag}</span>
                                                        ))}
                                                        {lead.tags.length > 3 && <span className="text-[10px] text-slate-400">+{lead.tags.length - 3}</span>}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="py-3.5 px-4 text-sm text-slate-500 border-b border-slate-100">{lead.phone}</td>
                                            <td className="py-3.5 px-4 text-sm text-slate-500 border-b border-slate-100">{lead.email || "—"}</td>
                                            <td className="py-3.5 px-4 text-sm text-slate-500 border-b border-slate-100">{lead.source || "—"}</td>
                                            <td className="py-3.5 px-4 border-b border-slate-100">
                                                {lead.status === "Converted" ? (
                                                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${statusStyle[lead.status] || "bg-slate-100 text-slate-600"}`}>Converted</span>
                                                ) : (
                                                    <select
                                                        value={lead.status}
                                                        onChange={(e) => handleStatusChange(lead.id, e.target.value, lead.status)}
                                                        className={`px-2 py-1 rounded-full text-xs font-semibold cursor-pointer outline-none border-none ring-1 ring-inset ring-black/5 ${statusStyle[lead.status] || "bg-slate-100 text-slate-600"}`}
                                                    >
                                                        {Object.keys(statusStyle).map((s) => (
                                                            <option key={s} value={s} className="bg-white text-slate-800">{s}</option>
                                                        ))}
                                                    </select>
                                                )}
                                            </td>
                                            <td className="py-3.5 px-4 border-b border-slate-100">
                                                <div className="flex items-center justify-end gap-1">
                                                    <div className={`flex items-center gap-1 transition-opacity duration-200 ${focusedIndex === index ? 'opacity-100' : 'opacity-100 xl:opacity-0 xl:group-hover:opacity-100 focus-within:opacity-100'}`}>
                                                        <button onClick={() => handlePinToggle(lead)} className={`w-8 h-8 flex items-center justify-center rounded-lg border-none bg-transparent cursor-pointer transition-all ${lead.isPinned ? "text-amber-500 hover:bg-amber-100" : "text-slate-400 hover:bg-amber-50 hover:text-amber-500"}`} title={lead.isPinned ? "Unpin" : "Pin to top"}>
                                                            {lead.isPinned ? <PinOff size={16} /> : <Pin size={16} />}
                                                        </button>
                                                        {lead.status === "Converted" && (
                                                            <button onClick={() => { setLeadToConvert(lead); setConvertOpen(true); }} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-emerald-50 hover:text-emerald-500 border-none bg-transparent cursor-pointer transition-all" title="Add Another Project">
                                                                <Briefcase size={16} />
                                                            </button>
                                                        )}
                                                        <button onClick={() => openEdit(lead)} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-amber-50 hover:text-amber-500 border-none bg-transparent cursor-pointer transition-all" title="Edit">
                                                            <Edit2 size={16} />
                                                        </button>
                                                        <button onClick={() => handleDelete(lead.id)} disabled={deleting === lead.id || lead.status === "Converted"} className={`w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 border-none bg-transparent transition-all disabled:opacity-50 ${lead.status === "Converted" ? "cursor-not-allowed" : "cursor-pointer"}`} title={lead.status === "Converted" ? "Cannot delete converted leads" : "Delete"}>
                                                            {deleting === lead.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                                                        </button>
                                                    </div>
                                                    <button onClick={() => openView(lead)} className={`w-8 h-8 flex items-center justify-center rounded-lg border-none bg-transparent cursor-pointer transition-all ${focusedIndex === index ? 'text-orange-500 bg-blue-50' : 'text-slate-300 hover:bg-blue-50 hover:text-orange-500 group-hover:text-orange-500'}`} title="View">
                                                        <Eye size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile Card View (hidden on sm+) */}
                        <div className="sm:hidden divide-y divide-slate-100">
                            {filtered.map((lead, index) => (
                                <div key={lead.id} className={`p-4 ${lead.isPinned ? "bg-amber-50/30" : ""} ${selected.has(lead.id) ? "bg-blue-50/60" : ""}`}>
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                {selectionMode && (
                                                    <button onClick={() => toggleSelect(lead.id)} className="flex items-center justify-center w-5 h-5 border-none bg-transparent cursor-pointer text-slate-400">
                                                        {selected.has(lead.id) ? <CheckSquare size={16} className="text-orange-500" /> : <Square size={16} />}
                                                    </button>
                                                )}
                                                <p className="text-sm font-bold text-slate-800 truncate">{lead.name}</p>
                                                {lead.isPinned && <Pin size={11} className="text-amber-500 fill-amber-500 shrink-0" />}
                                            </div>
                                            {lead.company && <p className="text-xs text-slate-400 mt-0.5">{lead.company}</p>}
                                            <p className="text-xs text-slate-500 mt-1 font-medium">{lead.phone}</p>
                                            {lead.tags?.length > 0 && (
                                                <div className="flex flex-wrap gap-1 mt-1.5">
                                                    {lead.tags.slice(0, 3).map((tag) => (
                                                        <span key={tag} className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${getTagColor(tag)}`}>{tag}</span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex flex-col items-end gap-2 shrink-0">
                                            {lead.status === "Converted" ? (
                                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${statusStyle[lead.status] || "bg-slate-100 text-slate-600"}`}>Converted</span>
                                            ) : (
                                                <select
                                                    value={lead.status}
                                                    onChange={(e) => handleStatusChange(lead.id, e.target.value, lead.status)}
                                                    className={`px-2 py-1 rounded-full text-[10px] font-semibold cursor-pointer outline-none border-none ring-1 ring-inset ring-black/5 ${statusStyle[lead.status] || "bg-slate-100 text-slate-600"}`}
                                                >
                                                    {Object.keys(statusStyle).map((s) => (
                                                        <option key={s} value={s} className="bg-white text-slate-800">{s}</option>
                                                    ))}
                                                </select>
                                            )}
                                            <div className="flex items-center gap-1">
                                                <button onClick={() => handlePinToggle(lead)} className={`w-7 h-7 flex items-center justify-center rounded-lg border-none bg-transparent cursor-pointer transition-all ${lead.isPinned ? "text-amber-500" : "text-slate-400"}`}>
                                                    {lead.isPinned ? <PinOff size={14} /> : <Pin size={14} />}
                                                </button>
                                                <button onClick={() => openEdit(lead)} className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:bg-amber-50 hover:text-amber-500 border-none bg-transparent cursor-pointer transition-all">
                                                    <Edit2 size={14} />
                                                </button>
                                                <button onClick={() => openView(lead)} className="w-7 h-7 flex items-center justify-center rounded-lg text-orange-500 bg-orange-50 border-none cursor-pointer transition-all">
                                                    <Eye size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}

                {/* Pagination */}
                {!loading && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200">
                        <p className="text-xs text-slate-400">Page {page}{totalPages > 0 ? ` of ~${totalPages}` : ""} · {filtered.length} leads</p>
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

            {/* Bulk Delete Floating Bar */}
            {selected.size > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-800 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-4 animate-[slideUp_0.25s_ease]">
                    <span className="text-sm font-medium">{selected.size} lead{selected.size > 1 ? "s" : ""} selected</span>
                    <div className="w-px h-5 bg-slate-600" />
                    <button onClick={handleBulkDelete} disabled={bulkDeleting} className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-red-500 text-white text-sm font-semibold border-none cursor-pointer hover:bg-red-600 disabled:opacity-60 transition-all">
                        {bulkDeleting ? <><Loader2 size={14} className="animate-spin" /> Deleting...</> : <><Trash2 size={14} /> Delete Selected</>}
                    </button>
                    <button onClick={() => setSelected(new Set())} className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 border-none bg-transparent cursor-pointer transition-all">
                        <X size={16} />
                    </button>
                </div>
            )}

            {/* Modals */}
            <LeadModal isOpen={modalOpen} onClose={() => setModalOpen(false)} onSave={handleSave} lead={selectedLead} mode={modalMode} />
            <ViewLeadModal isOpen={viewOpen} onClose={() => {
                setSearchParams(prev => {
                    prev.delete("lead");
                    return prev;
                });
            }} lead={viewLead} />
            <BulkImportModal isOpen={bulkOpen} onClose={() => setBulkOpen(false)} onImport={handleBulkImport} />
            <MergeDuplicatesModal isOpen={mergeOpen} onClose={() => setMergeOpen(false)} onMergeComplete={refresh} />
            <ConvertLeadModal isOpen={convertOpen} onClose={() => setConvertOpen(false)} lead={leadToConvert} onConverted={refresh} />
        </div>
    );
}
