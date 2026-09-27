import { useState, useEffect, useCallback } from "react";
import { collection, query, orderBy, getDocs, doc, deleteDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Search, Edit2, Trash2, Plus, FileText, Zap, Copy, ChevronRight, LayoutGrid, List, Sparkles } from "lucide-react";
import toast from "react-hot-toast";
import TemplateModal from "../components/TemplateModal";

const BADGE_COLORS = {
    "On-Grid": { bg: "bg-emerald-50", text: "text-emerald-600", dot: "bg-emerald-400", accent: "from-emerald-400 to-teal-500" },
    "Off-Grid": { bg: "bg-blue-50", text: "text-orange-600", dot: "bg-orange-400", accent: "from-orange-400 to-indigo-500" },
    "Hybrid": { bg: "bg-purple-50", text: "text-purple-600", dot: "bg-purple-400", accent: "from-purple-400 to-pink-500" },
    "Pump": { bg: "bg-cyan-50", text: "text-cyan-600", dot: "bg-cyan-400", accent: "from-cyan-400 to-orange-500" },
    "Heater": { bg: "bg-orange-50", text: "text-orange-600", dot: "bg-orange-400", accent: "from-orange-400 to-red-500" },
    "Street": { bg: "bg-amber-50", text: "text-amber-600", dot: "bg-amber-400", accent: "from-amber-400 to-orange-500" },
    "Template": { bg: "bg-slate-100", text: "text-slate-600", dot: "bg-slate-400", accent: "from-slate-400 to-slate-600" },
};

function getBadgeStyle(badge) {
    return BADGE_COLORS[badge] || BADGE_COLORS["Template"];
}

function TemplateCard({ template, onEdit, onDelete, deleting, index }) {
    const style = getBadgeStyle(template.badge);
    const matCount = template.materialRows?.length || 0;
    const finCount = template.financialRows?.length || 0;

    return (
        <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.04, duration: 0.3 }}
            className="group bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-sm hover:shadow-lg hover:border-slate-300 transition-all duration-300 flex flex-col"
        >
            {/* Accent bar */}
            <div className={`h-1 w-full bg-gradient-to-r ${style.accent}`} />

            <div className="p-5 flex flex-col flex-1">
                {/* Top row */}
                <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className={`w-11 h-11 rounded-xl ${style.bg} flex items-center justify-center shrink-0`}>
                            <FileText size={20} className={style.text} />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-800 text-sm leading-tight line-clamp-1" title={template.name}>
                                {template.name}
                            </h3>
                            <span className={`inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${style.bg} ${style.text}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                                {template.badge || "Template"}
                            </span>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                            onClick={() => onEdit(template)}
                            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-blue-50 hover:text-orange-600 transition-all border-none bg-transparent cursor-pointer"
                            title="Edit"
                        >
                            <Edit2 size={14} />
                        </button>
                        <button
                            onClick={() => onDelete(template.id)}
                            disabled={deleting === template.id}
                            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 transition-all border-none bg-transparent cursor-pointer disabled:opacity-50"
                            title="Delete"
                        >
                            {deleting === template.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                        </button>
                    </div>
                </div>

                {/* Intro text */}
                <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed flex-1 mb-4">
                    {template.intro || <span className="italic text-slate-300">No description</span>}
                </p>

                {/* Stats row */}
                <div className="grid grid-cols-3 gap-2 border-t border-slate-100 pt-4">
                    <div className="text-center">
                        <p className="text-base font-bold text-slate-800">{matCount}</p>
                        <p className="text-[10px] text-slate-400 font-medium">Materials</p>
                    </div>
                    <div className="text-center border-x border-slate-100">
                        <p className="text-base font-bold text-slate-800">{finCount}</p>
                        <p className="text-[10px] text-slate-400 font-medium">Financials</p>
                    </div>
                    <div className="text-center">
                        <p className="text-sm font-bold text-slate-800 truncate" title={template.amountLabel}>{template.amountLabel || "—"}</p>
                        <p className="text-[10px] text-slate-400 font-medium">Price</p>
                    </div>
                </div>
            </div>

            {/* Footer CTA */}
            <button
                onClick={() => onEdit(template)}
                className="w-full flex items-center justify-between px-5 py-3 border-t border-slate-100 text-xs font-semibold text-slate-400 hover:text-orange-600 hover:bg-blue-50/50 transition-all cursor-pointer bg-transparent"
            >
                <span>Edit Template</span>
                <ChevronRight size={14} />
            </button>
        </motion.div>
    );
}

function TemplateRow({ template, onEdit, onDelete, deleting, index }) {
    const style = getBadgeStyle(template.badge);
    return (
        <motion.div
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.03 }}
            className="group flex items-center gap-4 bg-white border border-slate-200/80 rounded-xl px-5 py-4 hover:shadow-md hover:border-slate-300 transition-all"
        >
            <div className={`w-10 h-10 rounded-xl ${style.bg} flex items-center justify-center shrink-0`}>
                <FileText size={18} className={style.text} />
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <p className="font-semibold text-slate-800 text-sm truncate">{template.name}</p>
                    <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${style.bg} ${style.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                        {template.badge || "Template"}
                    </span>
                </div>
                <p className="text-xs text-slate-400 truncate mt-0.5">{template.intro}</p>
            </div>
            <div className="hidden md:flex items-center gap-6 text-center shrink-0">
                <div>
                    <p className="text-sm font-bold text-slate-700">{template.materialRows?.length || 0}</p>
                    <p className="text-[10px] text-slate-400">Materials</p>
                </div>
                <div>
                    <p className="text-sm font-bold text-slate-700">{template.amountLabel || "—"}</p>
                    <p className="text-[10px] text-slate-400">Price</p>
                </div>
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => onEdit(template)} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-blue-50 hover:text-orange-600 transition-all border-none bg-transparent cursor-pointer" title="Edit">
                    <Edit2 size={14} />
                </button>
                <button onClick={() => onDelete(template.id)} disabled={deleting === template.id} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 transition-all border-none bg-transparent cursor-pointer disabled:opacity-50" title="Delete">
                    {deleting === template.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                </button>
            </div>
        </motion.div>
    );
}

export default function QuotationTemplates() {
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [deleting, setDeleting] = useState(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [editTemplate, setEditTemplate] = useState(null);
    const [viewMode, setViewMode] = useState("grid");

    const fetchTemplates = useCallback(async () => {
        setLoading(true);
        try {
            const q = query(collection(db, "quotationTemplates"), orderBy("createdAt", "desc"));
            const snap = await getDocs(q);
            const data = snap.docs.map(d => {
                const docData = d.data();
                return {
                    ...docData,
                    id: d.id,
                    materialRows: typeof docData.materialRows === "string" ? JSON.parse(docData.materialRows) : (docData.materialRows || []),
                    financialRows: typeof docData.financialRows === "string" ? JSON.parse(docData.financialRows) : (docData.financialRows || []),
                };
            });
            setTemplates(data);
        } catch (err) {
            console.error("Failed to fetch templates:", err);
            toast.error("Failed to fetch templates");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

    async function handleDelete(id) {
        if (!confirm("Are you sure you want to delete this template?")) return;
        setDeleting(id);
        try {
            await deleteDoc(doc(db, "quotationTemplates", id));
            setTemplates(prev => prev.filter(t => t.id !== id));
            toast.success("Template deleted");
        } catch (error) {
            console.error("Delete failed:", error);
            toast.error("Failed to delete template");
        } finally {
            setDeleting(null);
        }
    }

    function handleEdit(template) {
        setEditTemplate(template);
        setModalOpen(true);
    }

    const filtered = templates.filter(t =>
        !search ||
        t.name?.toLowerCase().includes(search.toLowerCase()) ||
        t.badge?.toLowerCase().includes(search.toLowerCase()) ||
        t.projectName?.toLowerCase().includes(search.toLowerCase())
    );

    const totalMaterials = templates.reduce((s, t) => s + (t.materialRows?.length || 0), 0);
    const totalFinancials = templates.reduce((s, t) => s + (t.financialRows?.length || 0), 0);

    return (
        <div className="max-w-6xl mx-auto">
            {/* ── Header ── */}
            <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-purple-600 flex items-center justify-center">
                            <Sparkles size={16} className="text-white" />
                        </div>
                        <h1 className="text-2xl font-bold text-slate-800">Quotation Templates</h1>
                    </div>
                    <p className="text-sm text-slate-500 ml-10">
                        Manage reusable quotation blueprints for faster PDF generation
                    </p>
                </div>
                <button
                    onClick={() => { setEditTemplate(null); setModalOpen(true); }}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-purple-600 text-white text-sm font-bold border-none cursor-pointer shadow-md shadow-orange-500/25 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-orange-500/30 transition-all"
                >
                    <Plus size={16} /> New Template
                </button>
            </div>

            {/* ── Stats Bar ── */}


            {/* ── Toolbar ── */}
            <div className="flex items-center gap-3 mb-5 flex-wrap">
                <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 flex-1 min-w-[200px] max-w-sm focus-within:border-orange-500 focus-within:ring-2 focus-within:ring-orange-500/15 transition-all">
                    <Search size={15} className="text-slate-400 shrink-0" />
                    <input
                        type="text"
                        placeholder="Search templates..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="border-none outline-none bg-transparent text-sm text-slate-700 w-full placeholder:text-slate-400"
                    />
                </div>
                <div className="flex items-center bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                    <button
                        onClick={() => setViewMode("grid")}
                        className={`w-9 h-9 flex items-center justify-center transition-all border-none cursor-pointer ${viewMode === "grid" ? "bg-orange-500 text-white" : "bg-transparent text-slate-400 hover:bg-slate-50"}`}
                        title="Grid view"
                    >
                        <LayoutGrid size={15} />
                    </button>
                    <button
                        onClick={() => setViewMode("list")}
                        className={`w-9 h-9 flex items-center justify-center transition-all border-none cursor-pointer ${viewMode === "list" ? "bg-orange-500 text-white" : "bg-transparent text-slate-400 hover:bg-slate-50"}`}
                        title="List view"
                    >
                        <List size={15} />
                    </button>
                </div>
                {filtered.length > 0 && (
                    <span className="text-xs text-slate-400 font-medium ml-1">
                        {filtered.length} {filtered.length === 1 ? "template" : "templates"}
                    </span>
                )}
            </div>

            {/* ── Content ── */}
            {loading ? (
                <div className="flex flex-col items-center justify-center py-24 bg-white border border-slate-200 rounded-2xl">
                    <Loader2 size={32} className="animate-spin text-orange-500 mb-3" />
                    <p className="text-sm text-slate-400">Loading templates...</p>
                </div>
            ) : filtered.length === 0 ? (
                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col items-center justify-center py-24 bg-white border border-dashed border-slate-200 rounded-2xl text-center"
                >
                    <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                        <FileText size={28} className="text-slate-300" />
                    </div>
                    <p className="text-base font-semibold text-slate-600 mb-1">
                        {search ? "No templates match your search" : "No templates yet"}
                    </p>
                    <p className="text-sm text-slate-400 mb-6">
                        {search ? "Try different keywords" : "Create your first template to speed up quotations"}
                    </p>
                    {!search && (
                        <button
                            onClick={() => { setEditTemplate(null); setModalOpen(true); }}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-purple-600 text-white text-sm font-bold border-none cursor-pointer shadow-md shadow-orange-500/20 hover:-translate-y-0.5 transition-all"
                        >
                            <Plus size={16} /> Create First Template
                        </button>
                    )}
                </motion.div>
            ) : viewMode === "grid" ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <AnimatePresence>
                        {filtered.map((template, i) => (
                            <TemplateCard
                                key={template.id}
                                template={template}
                                index={i}
                                onEdit={handleEdit}
                                onDelete={handleDelete}
                                deleting={deleting}
                            />
                        ))}
                    </AnimatePresence>
                </div>
            ) : (
                <div className="flex flex-col gap-2.5">
                    <AnimatePresence>
                        {filtered.map((template, i) => (
                            <TemplateRow
                                key={template.id}
                                template={template}
                                index={i}
                                onEdit={handleEdit}
                                onDelete={handleDelete}
                                deleting={deleting}
                            />
                        ))}
                    </AnimatePresence>
                </div>
            )}

            <TemplateModal
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                template={editTemplate}
                onSave={fetchTemplates}
            />
        </div>
    );
}
