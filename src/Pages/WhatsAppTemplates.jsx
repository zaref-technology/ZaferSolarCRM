import { useState, useEffect } from "react";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase";
import { motion } from "framer-motion";
import { Loader2, Save, MessageCircle, RotateCcw, Info } from "lucide-react";
import toast from "react-hot-toast";

const STATUS_LIST = ["New", "Follow-up", "Negotiation", "Converted", "Lost"];

const STATUS_META = {
    New: {
        color: "blue",
        badge: "bg-blue-50 border-orange-200 text-orange-700",
        ring: "focus:border-orange-400 focus:ring-orange-400/20",
        glow: "shadow-orange-500/20",
        icon: "🆕",
        desc: "Sent when a fresh lead is just received.",
    },
    "Follow-up": {
        color: "orange",
        badge: "bg-orange-50 border-orange-200 text-orange-700",
        ring: "focus:border-orange-400 focus:ring-orange-400/20",
        glow: "shadow-orange-500/20",
        icon: "🔔",
        desc: "Sent to re-engage a lead that hasn't responded.",
    },
    Negotiation: {
        color: "amber",
        badge: "bg-amber-50 border-amber-200 text-amber-700",
        ring: "focus:border-amber-400 focus:ring-amber-400/20",
        glow: "shadow-amber-500/20",
        icon: "🤝",
        desc: "Sent during active price / deal discussions.",
    },
    Converted: {
        color: "emerald",
        badge: "bg-emerald-50 border-emerald-200 text-emerald-700",
        ring: "focus:border-emerald-400 focus:ring-emerald-400/20",
        glow: "shadow-emerald-500/20",
        icon: "✅",
        desc: "Sent when a lead successfully becomes a client.",
    },
    Lost: {
        color: "red",
        badge: "bg-red-50 border-red-200 text-red-700",
        ring: "focus:border-red-400 focus:ring-red-400/20",
        glow: "shadow-red-500/20",
        icon: "❌",
        desc: "Sent as a polite close when a deal doesn't move forward.",
    },
};

const DEFAULT_TEMPLATES = {
    New: "Hello {name}, thank you for your interest! We have received your enquiry and our team will reach out to you shortly.",
    "Follow-up": "Hello {name}, this is a follow-up regarding your enquiry with us. Please let us know if you have any questions or need any clarification.",
    Negotiation: "Hello {name}, we are excited to move forward with your project. Let us discuss the best offer that works for you.",
    Converted: "Hello {name}, congratulations! We are happy to welcome you as our valued client. Our team will be in touch with the next steps.",
    Lost: "Hello {name}, we appreciate your time in considering us. If there is anything we can help you with in the future, please don't hesitate to reach out.",
};

export default function WhatsAppTemplates() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [templates, setTemplates] = useState({ ...DEFAULT_TEMPLATES });
    const [activeStatus, setActiveStatus] = useState("New");

    useEffect(() => {
        async function load() {
            setLoading(true);
            try {
                const snap = await getDoc(doc(db, "settings", "whatsappTemplates"));
                if (snap.exists()) {
                    setTemplates(prev => ({ ...prev, ...snap.data() }));
                }
            } catch (err) {
                console.error(err);
                toast.error("Failed to load templates");
            } finally {
                setLoading(false);
            }
        }
        load();
    }, []);

    async function handleSave() {
        setSaving(true);
        try {
            await setDoc(doc(db, "settings", "whatsappTemplates"), {
                ...templates,
                updatedAt: serverTimestamp(),
            }, { merge: true });
            toast.success("Templates saved successfully!");
        } catch (err) {
            console.error(err);
            toast.error("Failed to save templates");
        } finally {
            setSaving(false);
        }
    }

    function resetToDefault(status) {
        setTemplates(p => ({ ...p, [status]: DEFAULT_TEMPLATES[status] }));
        toast.success(`"${status}" template reset to default`);
    }

    const meta = STATUS_META[activeStatus];
    const charCount = (templates[activeStatus] || "").length;

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full min-h-[400px]">
                <Loader2 size={32} className="animate-spin text-emerald-500" />
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto pb-12">

            {/* Page Header */}
            <div className="flex items-center justify-between mb-8 border-b border-slate-200 pb-5">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center text-white shadow-lg shadow-emerald-500/25">
                        <MessageCircle size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">WhatsApp Templates</h1>
                        <p className="text-sm text-slate-500 mt-0.5">Customise the message sent for each lead status</p>
                    </div>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-6 py-2.5 rounded-xl bg-emerald-500 text-white font-bold text-sm hover:bg-emerald-600 hover:-translate-y-0.5 shadow-lg shadow-emerald-500/25 transition-all flex items-center gap-2 disabled:opacity-70 disabled:hover:translate-y-0 border-none cursor-pointer"
                >
                    {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    {saving ? "Saving..." : "Save All Templates"}
                </button>
            </div>

            {/* Placeholder hint */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-start gap-3 bg-emerald-50 border border-emerald-100 rounded-xl px-5 py-4 mb-7"
            >
                <Info size={16} className="text-emerald-600 mt-0.5 shrink-0" />
                <p className="text-sm text-emerald-700">
                    Use&nbsp;
                    <code className="bg-white border border-emerald-200 px-1.5 py-0.5 rounded text-emerald-600 font-mono text-[12px]">{"{name}"}</code>
                    &nbsp;as a placeholder — it will automatically be replaced with the lead's actual name when sending.
                    For example: <em>"Hello {"{name}"}"</em> becomes <em>"Hello Rahul"</em>.
                </p>
            </motion.div>

            <div className="grid grid-cols-[200px_1fr] gap-6 max-md:grid-cols-1">

                {/* Status Tabs (left column) */}
                <div className="flex flex-col gap-2">
                    {STATUS_LIST.map((status) => {
                        const m = STATUS_META[status];
                        const isActive = activeStatus === status;
                        return (
                            <button
                                key={status}
                                onClick={() => setActiveStatus(status)}
                                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all border cursor-pointer ${isActive
                                    ? `bg-white border-slate-200 shadow-md ${m.glow} text-slate-800`
                                    : "bg-transparent border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                                    }`}
                            >
                                <span className="text-lg leading-none">{m.icon}</span>
                                <div className="flex-1 min-w-0">
                                    <p className={`text-sm font-bold truncate ${isActive ? "text-slate-800" : "text-slate-500"}`}>{status}</p>
                                    {isActive && (
                                        <p className="text-[10px] text-slate-400 mt-0.5 leading-tight truncate">{m.desc}</p>
                                    )}
                                </div>
                                {isActive && (
                                    <div className={`w-1.5 h-5 rounded-full bg-${m.color}-500 shrink-0`} />
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Editor (right column) */}
                <motion.div
                    key={activeStatus}
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.18 }}
                    className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm"
                >
                    {/* Status badge + description */}
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <span className="text-xl">{meta.icon}</span>
                            <span className={`px-3 py-1 rounded-full text-xs font-bold border ${meta.badge}`}>{activeStatus}</span>
                            <span className="text-xs text-slate-400">{meta.desc}</span>
                        </div>
                        <button
                            onClick={() => resetToDefault(activeStatus)}
                            title="Reset to default"
                            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg transition-all cursor-pointer"
                        >
                            <RotateCcw size={12} />
                            Reset
                        </button>
                    </div>

                    {/* Textarea */}
                    <textarea
                        rows={7}
                        value={templates[activeStatus] ?? DEFAULT_TEMPLATES[activeStatus]}
                        onChange={(e) => setTemplates(p => ({ ...p, [activeStatus]: e.target.value }))}
                        className={`w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 outline-none focus:ring-2 focus:bg-white transition-all resize-none font-[inherit] ${meta.ring}`}
                        placeholder={DEFAULT_TEMPLATES[activeStatus]}
                    />

                    {/* Character count + live preview */}
                    <div className="mt-2 flex items-center justify-between">
                        <p className="text-[11px] text-slate-400">{charCount} characters</p>
                        {charCount > 1000 && (
                            <p className="text-[11px] text-orange-500 font-semibold">Long messages may be split by WhatsApp</p>
                        )}
                    </div>

                    {/* Live preview panel */}
                    <div className="mt-5 bg-[#e5ddd5] rounded-xl p-4">
                        <p className="text-[10px] font-bold text-slate-500 uppercase mb-2 tracking-wider">Preview</p>
                        <div className="bg-white rounded-xl rounded-tl-none px-4 py-3 max-w-[85%] shadow-sm">
                            <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                                {(templates[activeStatus] || DEFAULT_TEMPLATES[activeStatus]).replace(/\{name\}/gi, "Rahul")}
                            </p>
                            <p className="text-[10px] text-slate-400 mt-1.5 text-right">12:00 PM ✓✓</p>
                        </div>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
