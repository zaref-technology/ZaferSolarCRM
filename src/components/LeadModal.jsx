import { useState, useEffect } from "react";
import { X, Plus } from "lucide-react";
import { getTagColor } from "../utils/leadTags";

const emptyLead = {
    name: "", phone: "", email: "", company: "", source: "",
    status: "New", notes: "", tags: [],
};

const statusOptions = ["New", "Follow-up", "Negotiation", "Converted", "Lost"];
const sourceOptions = ["Website", "Referral", "Social Media", "Cold Call", "WhatsApp", "Just Dial", "Other"];
export default function LeadModal({ isOpen, onClose, onSave, lead, mode }) {
    const [form, setForm] = useState(emptyLead);
    const [saving, setSaving] = useState(false);
    const [tagInput, setTagInput] = useState("");

    useEffect(() => {
        if (lead && mode === "edit") {
            setForm({ ...emptyLead, ...lead, tags: lead.tags || [] });
        } else {
            setForm(emptyLead);
        }
        setTagInput("");
    }, [lead, mode]);

    if (!isOpen) return null;

    async function handleSubmit(e) {
        e.preventDefault();
        setSaving(true);
        try {
            await onSave(form);
            onClose();
        } catch (err) {
            console.error(err);
        } finally {
            setSaving(false);
        }
    }

    function addTag() {
        const tag = tagInput.trim();
        if (tag && !form.tags.includes(tag)) {
            setForm((p) => ({ ...p, tags: [...p.tags, tag] }));
        }
        setTagInput("");
    }

    function removeTag(tag) {
        setForm((p) => ({ ...p, tags: p.tags.filter((t) => t !== tag) }));
    }

    function handleTagKeyDown(e) {
        if (e.key === "Enter") { e.preventDefault(); addTag(); }
        if (e.key === "Backspace" && !tagInput && form.tags.length > 0) {
            removeTag(form.tags[form.tags.length - 1]);
        }
    }

    const title = mode === "edit" ? "Edit Lead" : "Add New Lead";
    const inputClass = "border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 transition-all";

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 sm:p-4" onClick={onClose}>
            <div className="bg-white sm:rounded-2xl rounded-t-2xl shadow-xl w-full max-w-lg max-h-[95dvh] sm:max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
                    <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
                    <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 border-none bg-transparent cursor-pointer transition-all">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-4 sm:p-6 flex flex-col gap-4">
                    {/* Two column layout for name and phone */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1">
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Full Name *</label>
                            <input type="text" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} required className={inputClass} placeholder="Rahul Sharma" />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Phone *</label>
                            <input type="tel" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} required className={inputClass} placeholder="9876543210" />
                        </div>
                    </div>

                    {/* Two column for email and company */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1">
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Email</label>
                            <input type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} className={inputClass} placeholder="email@example.com" />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Company</label>
                            <input type="text" value={form.company} onChange={(e) => setForm((p) => ({ ...p, company: e.target.value }))} className={inputClass} placeholder="Acme Corp" />
                        </div>
                    </div>

                    {/* Two column for source and status */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1">
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Source</label>
                            <select value={form.source} onChange={(e) => setForm((p) => ({ ...p, source: e.target.value }))} className={`${inputClass} bg-white`}>
                                <option value="">Select source</option>
                                {sourceOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</label>
                            <select disabled={lead?.status === "Converted"} value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))} className={`${inputClass} bg-white disabled:opacity-50 disabled:cursor-not-allowed`}>
                                {statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Tags */}
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tags</label>
                        <div className="flex flex-wrap items-center gap-1.5 border border-slate-200 rounded-lg px-2 py-2 min-h-[42px] focus-within:border-orange-500 focus-within:ring-2 focus-within:ring-orange-500/15 transition-all">
                            {form.tags.map((tag) => (
                                <span key={tag} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold ${getTagColor(tag)}`}>
                                    {tag}
                                    <button type="button" onClick={() => removeTag(tag)} className="w-3.5 h-3.5 flex items-center justify-center rounded-full hover:bg-black/10 border-none bg-transparent cursor-pointer text-current">
                                        <X size={10} />
                                    </button>
                                </span>
                            ))}
                            <input
                                type="text"
                                value={tagInput}
                                onChange={(e) => setTagInput(e.target.value)}
                                onKeyDown={handleTagKeyDown}
                                placeholder={form.tags.length === 0 ? "Type & press Enter" : ""}
                                className="flex-1 min-w-[80px] border-none outline-none bg-transparent text-sm text-slate-700 py-0.5"
                            />
                            {tagInput && (
                                <button type="button" onClick={addTag} className="w-6 h-6 flex items-center justify-center rounded-md bg-blue-50 text-orange-500 border-none cursor-pointer hover:bg-orange-100 transition-all">
                                    <Plus size={14} />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Notes */}
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Notes</label>
                        <textarea value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} rows={3} placeholder="Add any notes about this lead..." className={`${inputClass} resize-none`} />
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-3 pt-2">
                        <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-lg border border-slate-200 text-slate-600 text-sm font-medium cursor-pointer hover:bg-slate-50 bg-white transition-all">Cancel</button>
                        <button type="submit" disabled={saving} className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-orange-500 to-purple-500 text-white text-sm font-semibold border-none cursor-pointer shadow-md shadow-orange-500/20 disabled:opacity-60 transition-all">
                            {saving ? "Saving..." : mode === "edit" ? "Update Lead" : "Add Lead"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
