import { useState, useRef } from "react";
import { X, Upload, FileSpreadsheet, FileJson, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import * as XLSX from "xlsx";

export default function BulkImportModal({ isOpen, onClose, onImport }) {
    const [tab, setTab] = useState("excel");
    const [jsonText, setJsonText] = useState("");
    const [preview, setPreview] = useState([]);
    const [fileName, setFileName] = useState("");
    const [importing, setImporting] = useState(false);
    const [result, setResult] = useState(null);
    const fileRef = useRef();

    if (!isOpen) return null;

    function reset() {
        setPreview([]);
        setFileName("");
        setJsonText("");
        setResult(null);
    }

    function handleClose() {
        reset();
        onClose();
    }

    function normalizeKeys(obj) {
        const mapped = {};
        Object.entries(obj).forEach(([key, val]) => {
            const k = key.trim().toLowerCase().replace(/\s+/g, "_");
            if (k === "name" || k === "full_name" || k === "fullname") mapped.name = String(val || "");
            else if (k === "phone" || k === "mobile" || k === "contact") mapped.phone = String(val || "");
            else if (k === "email" || k === "email_address") mapped.email = String(val || "");
            else if (k === "company" || k === "organization") mapped.company = String(val || "");
            else if (k === "source") mapped.source = String(val || "");
            else if (k === "status") mapped.status = String(val || "New");
            else if (k === "notes" || k === "note" || k === "remark") mapped.notes = String(val || "");
        });
        if (!mapped.status) mapped.status = "New";
        return mapped;
    }

    function handleExcelFile(e) {
        const file = e.target.files?.[0];
        if (!file) return;
        setFileName(file.name);
        setResult(null);

        const reader = new FileReader();
        reader.onload = (evt) => {
            const wb = XLSX.read(evt.target.result, { type: "array" });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(ws);
            const normalized = rows.map(normalizeKeys).filter((r) => r.name && r.phone);
            setPreview(normalized);
        };
        reader.readAsArrayBuffer(file);
    }

    function handleJsonParse() {
        setResult(null);
        try {
            const parsed = JSON.parse(jsonText);
            const arr = Array.isArray(parsed) ? parsed : [parsed];
            const normalized = arr.map(normalizeKeys).filter((r) => r.name && r.phone);
            setPreview(normalized);
        } catch {
            setResult({ success: false, message: "Invalid JSON format" });
        }
    }

    async function handleImport() {
        if (preview.length === 0) return;
        setImporting(true);
        try {
            const count = await onImport(preview);
            setResult({ success: true, message: `Successfully imported ${count} leads!` });
            setPreview([]);
        } catch (err) {
            setResult({ success: false, message: err.message || "Import failed" });
        } finally {
            setImporting(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={handleClose}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
                    <h2 className="text-lg font-semibold text-slate-800">Bulk Import Leads</h2>
                    <button onClick={handleClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 border-none bg-transparent cursor-pointer">
                        <X size={20} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-200 px-6 shrink-0">
                    <button
                        onClick={() => { setTab("excel"); reset(); }}
                        className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all bg-transparent cursor-pointer border-none ${tab === "excel" ? "border-b-orange-500 text-orange-600" : "border-b-transparent text-slate-500 hover:text-slate-700"}`}
                        style={{ borderBottomWidth: "2px", borderBottomStyle: "solid", borderBottomColor: tab === "excel" ? "#3b82f6" : "transparent" }}
                    >
                        <FileSpreadsheet size={16} /> Excel / CSV
                    </button>
                    <button
                        onClick={() => { setTab("json"); reset(); }}
                        className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all bg-transparent cursor-pointer border-none ${tab === "json" ? "border-b-orange-500 text-orange-600" : "border-b-transparent text-slate-500 hover:text-slate-700"}`}
                        style={{ borderBottomWidth: "2px", borderBottomStyle: "solid", borderBottomColor: tab === "json" ? "#3b82f6" : "transparent" }}
                    >
                        <FileJson size={16} /> JSON
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 flex-1 overflow-y-auto flex flex-col gap-4">
                    {tab === "excel" && (
                        <>
                            <div
                                className="border-2 border-dashed border-slate-200 rounded-xl p-8 flex flex-col items-center gap-3 cursor-pointer hover:border-orange-400 hover:bg-blue-50/30 transition-all"
                                onClick={() => fileRef.current?.click()}
                            >
                                <Upload size={32} className="text-slate-400" />
                                <p className="text-sm text-slate-600 font-medium">
                                    {fileName || "Click to upload Excel or CSV file"}
                                </p>
                                <p className="text-xs text-slate-400">Supports .xlsx, .xls, .csv</p>
                                <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleExcelFile} className="hidden" />
                            </div>
                            <p className="text-xs text-slate-400">
                                Required columns: <strong>Name</strong>, <strong>Phone</strong>. Optional: Email, Company, Source, Status, Notes
                            </p>
                        </>
                    )}

                    {tab === "json" && (
                        <>
                            <textarea
                                value={jsonText}
                                onChange={(e) => setJsonText(e.target.value)}
                                placeholder={'[\n  { "name": "John", "phone": "9876543210", "email": "john@example.com" }\n]'}
                                rows={6}
                                className="border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-700 font-mono outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 resize-none transition-all"
                            />
                            <button type="button" onClick={handleJsonParse} className="self-start px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm font-medium cursor-pointer hover:bg-slate-50 bg-white transition-all">
                                Parse JSON
                            </button>
                        </>
                    )}

                    {/* Result message */}
                    {result && (
                        <div className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium ${result.success ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
                            {result.success ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                            {result.message}
                        </div>
                    )}

                    {/* Preview Table */}
                    {preview.length > 0 && (
                        <div className="border border-slate-200 rounded-xl overflow-hidden">
                            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                                <p className="text-sm font-medium text-slate-700">{preview.length} leads ready to import</p>
                            </div>
                            <div className="overflow-x-auto max-h-48">
                                <table className="w-full border-collapse text-left text-sm">
                                    <thead>
                                        <tr className="bg-slate-50">
                                            <th className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase">#</th>
                                            <th className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Name</th>
                                            <th className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Phone</th>
                                            <th className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Email</th>
                                            <th className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {preview.slice(0, 50).map((r, i) => (
                                            <tr key={i} className="border-t border-slate-100 hover:bg-slate-50">
                                                <td className="px-3 py-2 text-slate-400">{i + 1}</td>
                                                <td className="px-3 py-2 text-slate-700">{r.name}</td>
                                                <td className="px-3 py-2 text-slate-500">{r.phone}</td>
                                                <td className="px-3 py-2 text-slate-500">{r.email || "—"}</td>
                                                <td className="px-3 py-2 text-slate-500">{r.status}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            {preview.length > 50 && (
                                <p className="px-4 py-2 text-xs text-slate-400 border-t border-slate-100">
                                    Showing first 50 of {preview.length} rows
                                </p>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                {preview.length > 0 && (
                    <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200 shrink-0">
                        <button onClick={reset} className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm font-medium cursor-pointer hover:bg-slate-50 bg-white transition-all">
                            Clear
                        </button>
                        <button onClick={handleImport} disabled={importing} className="px-5 py-2 rounded-lg bg-gradient-to-r from-orange-500 to-purple-500 text-white text-sm font-semibold border-none cursor-pointer shadow-md shadow-orange-500/20 disabled:opacity-60 flex items-center gap-2 transition-all">
                            {importing ? <><Loader2 size={16} className="animate-spin" /> Importing...</> : `Import ${preview.length} Leads`}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
