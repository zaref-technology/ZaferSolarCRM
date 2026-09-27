import { useState } from "react";
import { collection, getDocs, doc, updateDoc, writeBatch, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase";
import { X, Search, Loader2, Merge, CheckCircle, AlertTriangle } from "lucide-react";
import toast from "react-hot-toast";

function normalizePhone(phone) {
    return (phone || "").replace(/\D/g, "").slice(-10);
}

function normalizeName(name) {
    return (name || "").trim().toLowerCase();
}

// Merge fields: primary gets filled with data from duplicates
function mergeLeadData(primary, duplicates) {
    const merged = { ...primary };
    const fields = ["email", "company", "source", "status"];

    for (const dup of duplicates) {
        for (const f of fields) {
            if (!merged[f] && dup[f]) merged[f] = dup[f];
        }
    }

    // Combine notes
    const allNotes = [primary, ...duplicates]
        .map((l) => l.notes?.trim())
        .filter(Boolean);
    merged.notes = [...new Set(allNotes)].join("\n---\n");

    return merged;
}

export default function MergeDuplicatesModal({ isOpen, onClose, onMergeComplete }) {
    const [scanning, setScanning] = useState(false);
    const [groups, setGroups] = useState([]);
    const [selectedPrimary, setSelectedPrimary] = useState({});
    const [merging, setMerging] = useState(null);
    const [mergingAll, setMergingAll] = useState(false);
    const [result, setResult] = useState(null);
    const [tab, setTab] = useState("phone");

    if (!isOpen) return null;

    async function handleScan() {
        setScanning(true);
        setGroups([]);
        setResult(null);
        setSelectedPrimary({});

        try {
            // Fetch all leads
            const snap = await getDocs(collection(db, "leads"));
            const allLeads = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

            // Group by phone
            const phoneMap = {};
            allLeads.forEach((l) => {
                const key = normalizePhone(l.phone);
                if (key.length >= 7) {
                    if (!phoneMap[key]) phoneMap[key] = [];
                    phoneMap[key].push(l);
                }
            });

            // Group by name
            const nameMap = {};
            allLeads.forEach((l) => {
                const key = normalizeName(l.name);
                if (key.length >= 2) {
                    if (!nameMap[key]) nameMap[key] = [];
                    nameMap[key].push(l);
                }
            });

            // Filter only groups with 2+ leads (actual duplicates)
            const phoneDups = Object.entries(phoneMap)
                .filter(([, arr]) => arr.length > 1)
                .map(([key, arr]) => ({ key, type: "phone", leads: arr.sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0)) }));

            const nameDups = Object.entries(nameMap)
                .filter(([, arr]) => arr.length > 1)
                // Exclude groups already covered by phone match
                .filter(([, arr]) => {
                    const phones = arr.map((l) => normalizePhone(l.phone));
                    const uniquePhones = new Set(phones);
                    return uniquePhones.size > 1 || phones[0].length < 7;
                })
                .map(([key, arr]) => ({ key, type: "name", leads: arr.sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0)) }));

            const allGroups = [...phoneDups, ...nameDups];

            // Auto-select oldest as primary
            const primaries = {};
            allGroups.forEach((g, i) => { primaries[i] = g.leads[0].id; });
            setSelectedPrimary(primaries);
            setGroups(allGroups);

            if (allGroups.length === 0) {
                setResult({ success: true, message: "No duplicates found! All leads are unique." });
            }
        } catch (err) {
            console.error(err);
            setResult({ success: false, message: "Failed to scan leads." });
        } finally {
            setScanning(false);
        }
    }

    async function handleMergeGroup(groupIndex) {
        const group = groups[groupIndex];
        const primaryId = selectedPrimary[groupIndex];
        if (!primaryId) return;

        setMerging(groupIndex);
        try {
            const primary = group.leads.find((l) => l.id === primaryId);
            const duplicates = group.leads.filter((l) => l.id !== primaryId);
            const merged = mergeLeadData(primary, duplicates);

            // Update primary
            const data = { ...merged };
            delete data.id;
            await updateDoc(doc(db, "leads", primaryId), { ...data, updatedAt: serverTimestamp() });

            // Delete duplicates
            const batch = writeBatch(db);
            duplicates.forEach((d) => batch.delete(doc(db, "leads", d.id)));
            await batch.commit();

            // Remove group from list
            setGroups((prev) => prev.filter((_, i) => i !== groupIndex));
            // Reindex selectedPrimary
            setSelectedPrimary((prev) => {
                const next = {};
                Object.entries(prev).forEach(([k, v]) => {
                    const ki = parseInt(k);
                    if (ki < groupIndex) next[ki] = v;
                    else if (ki > groupIndex) next[ki - 1] = v;
                });
                return next;
            });
        } catch (err) {
            console.error(err);
            toast.error("Merge failed. Please try again.");
        } finally {
            setMerging(null);
        }
    }

    async function handleMergeAll() {
        if (!confirm(`Merge all ${groups.length} duplicate groups? This cannot be undone.`)) return;
        setMergingAll(true);
        try {
            for (let i = groups.length - 1; i >= 0; i--) {
                const group = groups[i];
                const primaryId = selectedPrimary[i];
                if (!primaryId) continue;

                const primary = group.leads.find((l) => l.id === primaryId);
                const duplicates = group.leads.filter((l) => l.id !== primaryId);
                const merged = mergeLeadData(primary, duplicates);

                const data = { ...merged };
                delete data.id;
                await updateDoc(doc(db, "leads", primaryId), { ...data, updatedAt: serverTimestamp() });

                const batch = writeBatch(db);
                duplicates.forEach((d) => batch.delete(doc(db, "leads", d.id)));
                await batch.commit();
            }
            setGroups([]);
            setResult({ success: true, message: "All duplicates merged successfully!" });
            onMergeComplete?.();
        } catch (err) {
            console.error(err);
            setResult({ success: false, message: "Some merges failed. Please rescan." });
        } finally {
            setMergingAll(false);
        }
    }

    function handleClose() {
        if (groups.length === 0 || confirm("Close without merging remaining duplicates?")) {
            setGroups([]);
            setResult(null);
            setSelectedPrimary({});
            onClose();
            onMergeComplete?.();
        }
    }

    const phoneGroups = groups.filter((g) => g.type === "phone");
    const nameGroups = groups.filter((g) => g.type === "name");
    const displayGroups = tab === "phone" ? phoneGroups : nameGroups;
    // Map display index back to original groups index
    const displayIndexMap = groups.map((g, i) => ({ g, i })).filter((x) => x.g.type === tab).map((x) => x.i);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={handleClose}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center">
                            <Merge size={18} className="text-purple-500" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-slate-800">Merge Duplicates</h2>
                            <p className="text-xs text-slate-400">Find and merge leads with same phone or name</p>
                        </div>
                    </div>
                    <button onClick={handleClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 border-none bg-transparent cursor-pointer">
                        <X size={20} />
                    </button>
                </div>

                {/* Scan Button or Tabs */}
                <div className="px-6 py-4 border-b border-slate-200 shrink-0">
                    {groups.length === 0 && !result ? (
                        <button onClick={handleScan} disabled={scanning} className="w-full py-3 rounded-lg bg-gradient-to-r from-purple-500 to-orange-500 text-white font-semibold text-sm border-none cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60 transition-all">
                            {scanning ? <><Loader2 size={16} className="animate-spin" /> Scanning all leads...</> : <><Search size={16} /> Scan for Duplicates</>}
                        </button>
                    ) : groups.length > 0 ? (
                        <div className="flex items-center justify-between">
                            <div className="flex border border-slate-200 rounded-lg overflow-hidden">
                                <button onClick={() => setTab("phone")} className={`px-4 py-2 text-xs font-medium border-none cursor-pointer transition-all ${tab === "phone" ? "bg-orange-500 text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}>
                                    Phone Match ({phoneGroups.length})
                                </button>
                                <button onClick={() => setTab("name")} className={`px-4 py-2 text-xs font-medium border-none cursor-pointer transition-all ${tab === "name" ? "bg-orange-500 text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}>
                                    Name Match ({nameGroups.length})
                                </button>
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={handleScan} disabled={scanning} className="px-3 py-2 rounded-lg border border-slate-200 text-slate-500 text-xs font-medium bg-white cursor-pointer hover:bg-slate-50 transition-all">
                                    Rescan
                                </button>
                                {groups.length > 0 && (
                                    <button onClick={handleMergeAll} disabled={mergingAll} className="px-4 py-2 rounded-lg bg-purple-500 text-white text-xs font-semibold border-none cursor-pointer hover:bg-purple-600 disabled:opacity-60 flex items-center gap-2 transition-all">
                                        {mergingAll ? <><Loader2 size={14} className="animate-spin" /> Merging...</> : `Merge All (${groups.length})`}
                                    </button>
                                )}
                            </div>
                        </div>
                    ) : null}
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-6 py-4">
                    {/* Result message */}
                    {result && (
                        <div className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium mb-4 ${result.success ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
                            {result.success ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
                            {result.message}
                        </div>
                    )}

                    {/* Duplicate Groups */}
                    <div className="flex flex-col gap-4">
                        {displayGroups.map((group, displayIdx) => {
                            const originalIdx = displayIndexMap[displayIdx];
                            return (
                                <div key={originalIdx} className="border border-slate-200 rounded-xl overflow-hidden">
                                    {/* Group header */}
                                    <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
                                        <div className="flex items-center gap-2">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${group.type === "phone" ? "bg-orange-100 text-orange-600" : "bg-amber-100 text-amber-600"}`}>
                                                {group.type}
                                            </span>
                                            <span className="text-sm font-medium text-slate-700">
                                                {group.type === "phone" ? group.key : `"${group.leads[0]?.name}"`}
                                            </span>
                                            <span className="text-xs text-slate-400">({group.leads.length} leads)</span>
                                        </div>
                                        <button
                                            onClick={() => handleMergeGroup(originalIdx)}
                                            disabled={merging === originalIdx}
                                            className="px-3 py-1.5 rounded-lg bg-purple-500 text-white text-xs font-semibold border-none cursor-pointer hover:bg-purple-600 disabled:opacity-60 flex items-center gap-1 transition-all"
                                        >
                                            {merging === originalIdx ? <><Loader2 size={12} className="animate-spin" /> Merging...</> : "Merge"}
                                        </button>
                                    </div>

                                    {/* Leads in group */}
                                    <div className="divide-y divide-slate-100">
                                        {group.leads.map((lead) => (
                                            <label key={lead.id} className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors ${selectedPrimary[originalIdx] === lead.id ? "bg-blue-50/50" : "hover:bg-slate-50"}`}>
                                                <input
                                                    type="radio"
                                                    name={`primary-${originalIdx}`}
                                                    checked={selectedPrimary[originalIdx] === lead.id}
                                                    onChange={() => setSelectedPrimary((p) => ({ ...p, [originalIdx]: lead.id }))}
                                                    className="mt-1 accent-orange-500"
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="text-sm font-medium text-slate-800">{lead.name}</span>
                                                        {selectedPrimary[originalIdx] === lead.id && (
                                                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-600">PRIMARY</span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-4 mt-1 text-xs text-slate-400 flex-wrap">
                                                        <span>{lead.phone}</span>
                                                        {lead.email && <span>{lead.email}</span>}
                                                        {lead.company && <span>{lead.company}</span>}
                                                        {lead.source && <span>{lead.source}</span>}
                                                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${lead.status === "Converted" ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"}`}>{lead.status}</span>
                                                    </div>
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {groups.length > 0 && displayGroups.length === 0 && (
                        <p className="text-center text-sm text-slate-400 py-8">No {tab} duplicates found</p>
                    )}
                </div>
            </div>
        </div>
    );
}
