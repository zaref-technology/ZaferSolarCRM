import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCircle, Loader2, Plus, Trash2, UploadCloud } from "lucide-react";
import { doc, setDoc, addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase";
import toast from "react-hot-toast";

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

export default function TemplateModal({ isOpen, onClose, template, onSave }) {
    const [activeTab, setActiveTab] = useState("general");
    const [loading, setLoading] = useState(false);
    const [uploadingImage, setUploadingImage] = useState(false);

    const [formData, setFormData] = useState({});

    useEffect(() => {
        if (isOpen) {
            if (template) {
                const t = JSON.parse(JSON.stringify(template));
                // Deserialize nested arrays stored as JSON strings in Firestore
                setFormData(t);
            } else {
                setFormData({
                    name: "", badge: "", projectTitle: "", projectName: "", intro: "",
                    introConfig: {
                        salutation: "Respected Sir,",
                        capacities: [{ kw: 3 }],
                        closing: "This proposal has been designed as per the detailed analysis of the site and is based on your electricity bill calculation and the space available.",
                        projectType: "Net-Metering based Rooftop PV Solar Power Plant"
                    },
                    diagramTitle: "", diagramImage: "", singleLineImage: "",
                    benefitsTitle: "Benefits", benefits: [""],
                    amountLabel: "", amountWords: "", delivery: "",
                    paymentTerms: [""], clientScope: [""],
                    companyScope: [
                        "Prepare a full system design to include civil, structural, electrical, and mechanical components, with construction drawings and specifications.",
                        "Procure equipment and materials and deliver to site.",
                        "Perform complete system installation.",
                        "Test all electrical components in accordance with manufacturer instructions.",
                        "Commission the system to full operability."
                    ],
                    warranteePanels: "The solar modules are warranted by the solar panel manufacturer for a period of 25 years. Beginning on the Warranty Start Date and terminating on that date, which is one hundred and twenty (120) months thereafter, the warranty of modules and their respective DC connectors and cables, if any, shall be free from material defects in design, materials, and workmanship that affect the performance of the module and shall be covered under service warranty. (\"Limited Product Warranty\"). Material defects shall not include normal wear and tear.",
                    warranteePerformance: "80% efficiency up to 25 years",
                    warranteeInverter: "Inverter comes under complete 5 years of replacement warranty addition warranty can be add by Paying addition charges for the system.",
                    warranteeBos: "A standard 12-month warranty against manufacturing defects is provided. After the warranty period, this will ensure the supply of spares for the system at actual cost.",
                    warranteeNotes: [
                        "All warranty will start from the date of delivery",
                        "Test Report will be provided after completion",
                        "Performance report will be provided after 7 day of live working Site"
                    ],
                    warranteeImage: "",
                    howItWorksText1: "The solar panels convert sunlight into electric energy, which is Direct Current (DC). This current is sent to an inverter or controller as per the system design. The power is then converted or regulated for useful consumption at the customer site.",
                    howItWorksText2: "The generated power from the plant can fulfill the power requirement of the customer site during the daytime. The generated power is utilized, and surplus power is fed into the grid for later use.",
                    howItWorksText3: "All electrical components will be tested in accordance with manufacturer instructions and project requirements before handover."
                });
            }
            setActiveTab("general");
        }
    }, [isOpen, template]);

    if (!isOpen) return null;

    const handleUpload = async (file, field) => {
        if (!file) return;
        setUploadingImage(field);
        try {
            const data = new FormData();
            data.append("file", file);
            data.append("upload_preset", UPLOAD_PRESET);
            data.append("cloud_name", CLOUD_NAME);
            const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
                method: "POST",
                body: data,
            });
            const result = await res.json();
            if (result.secure_url) {
                setFormData(p => ({ ...p, [field]: result.secure_url }));
                toast.success("Image uploaded!");
            } else {
                throw new Error("Upload failed");
            }
        } catch (error) {
            console.error(error);
            toast.error("Failed to upload image");
        } finally {
            setUploadingImage(false);
        }
    };

    const handleArrayChange = (field, index, value) => {
        const newArray = [...(formData[field] || [])];
        newArray[index] = value;
        setFormData(p => ({ ...p, [field]: newArray }));
    };
    const addArrayItem = (field, defaultVal = "") => {
        setFormData(p => ({ ...p, [field]: [...(p[field] || []), defaultVal] }));
    };
    const removeArrayItem = (field, index) => {
        setFormData(p => ({ ...p, [field]: p[field].filter((_, i) => i !== index) }));
    };

    const handleNestedChange = (field, rowIndex, colIndex, value) => {
        const newRows = [...(formData[field] || [])];
        if (!newRows[rowIndex]) newRows[rowIndex] = [];
        newRows[rowIndex][colIndex] = value;
        setFormData(p => ({ ...p, [field]: newRows }));
    };
    const addNestedRow = (field, colCount) => {
        const emptyRow = Array(colCount).fill("");
        setFormData(p => ({ ...p, [field]: [...(p[field] || []), emptyRow] }));
    };
    const removeNestedRow = (field, rowIndex) => {
        setFormData(p => ({ ...p, [field]: p[field].filter((_, i) => i !== rowIndex) }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const payload = {
                ...formData,
                // Firestore doesn't support nested arrays — serialize to JSON strings
                updatedAt: serverTimestamp()
            };

            if (formData.id) {
                await setDoc(doc(db, "quotationTemplates", formData.id), payload, { merge: true });
                toast.success("Template updated successfully");
            } else {
                payload.createdAt = serverTimestamp();
                await addDoc(collection(db, "quotationTemplates"), payload);
                toast.success("Template created successfully");
            }
            onSave();
            onClose();
        } catch (err) {
            console.error(err);
            toast.error("Failed to save template");
        } finally {
            setLoading(false);
        }
    };

    const tabs = [
        { id: "general", label: "Page 1 · Cover" },
        { id: "intro", label: "Page 2 · Intro" },
        { id: "howItWorks", label: "Page 3 · How It Works & Benefits" },
        { id: "warrantee", label: "Page 6 · Warrantee" },
        { id: "scope", label: "Page 7 · Scope" },
        { id: "terms", label: "Page 8 · Terms" },
    ];

    // ── Intro helpers ─────────────────────────────────────────────
    const UNITS_PER_KW_PER_YEAR = 4 * 365; // 1460 units

    function getIntroConfig() {
        return formData.introConfig || {
            salutation: "Respected Sir,",
            capacities: [{ kw: 3 }],
            closing: "This proposal has been designed as per the detailed analysis of the site and is based on your electricity bill calculation and the space available.",
            projectType: "Net-Metering based Rooftop PV Solar Power Plant"
        };
    }

    function updateIntroConfig(field, value) {
        setFormData(p => ({ ...p, introConfig: { ...getIntroConfig(), [field]: value } }));
    }

    function addCapacity() {
        const cfg = getIntroConfig();
        updateIntroConfig("capacities", [...cfg.capacities, { kw: 1 }]);
    }

    function updateCapacity(i, kw) {
        const cfg = getIntroConfig();
        const updated = cfg.capacities.map((c, idx) => idx === i ? { kw: Number(kw) || 0 } : c);
        updateIntroConfig("capacities", updated);
    }

    function removeCapacity(i) {
        const cfg = getIntroConfig();
        updateIntroConfig("capacities", cfg.capacities.filter((_, idx) => idx !== i));
    }

    function buildIntroPreview(cfg) {
        if (!cfg || !cfg.capacities || cfg.capacities.length === 0) return "";
        const capParts = cfg.capacities.map(c => {
            const units = Math.round(c.kw * UNITS_PER_KW_PER_YEAR);
            return `(${c.kw} KW DC capacities to generate approx. ${units.toLocaleString("en-IN")} AC units respectively annually.)`;
        }).join(" ");
        return `We are delighted to present to you the quotation/proposal for a ${cfg.projectType || "Net-Metering based Rooftop PV Solar Power Plant"} of ${capParts} ${cfg.closing || ""}`;
    }

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-5xl bg-white rounded-2xl shadow-2xl overflow-hidden z-10 flex flex-col h-[90vh]">

                    <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
                        <div>
                            <h2 className="text-xl font-bold text-slate-800">{formData.id ? "Edit Template" : "Create Template"}</h2>
                            <p className="text-sm text-slate-500">{formData.name || "New Template"}</p>
                        </div>
                        <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-xl transition-colors"><X size={20} /></button>
                    </div>

                    <div className="flex border-b border-slate-200 shrink-0 overflow-x-auto">
                        {tabs.map(tab => (
                            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`px-6 py-3 text-sm font-semibold whitespace-nowrap transition-colors border-b-2 ${activeTab === tab.id ? "border-orange-500 text-orange-600" : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50"}`}>
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 bg-slate-50/30">
                        {activeTab === "general" && (
                            <div className="space-y-5">
                                <div className="grid grid-cols-2 gap-4">
                                    <div><label className="block text-xs font-semibold text-slate-700 mb-1">Template Name (Internal)</label><input type="text" required value={formData.name || ""} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} className="w-full px-4 py-2 border rounded-lg text-sm" /></div>
                                    <div><label className="block text-xs font-semibold text-slate-700 mb-1">Badge (e.g. Popular)</label><input type="text" value={formData.badge || ""} onChange={e => setFormData(p => ({ ...p, badge: e.target.value }))} className="w-full px-4 py-2 border rounded-lg text-sm" /></div>
                                    <div><label className="block text-xs font-semibold text-slate-700 mb-1">Project Name (Short)</label><input type="text" required value={formData.projectName || ""} onChange={e => setFormData(p => ({ ...p, projectName: e.target.value }))} className="w-full px-4 py-2 border rounded-lg text-sm" /></div>
                                    <div><label className="block text-xs font-semibold text-slate-700 mb-1">Project Title (Full)</label><input type="text" required value={formData.projectTitle || ""} onChange={e => setFormData(p => ({ ...p, projectTitle: e.target.value }))} className="w-full px-4 py-2 border rounded-lg text-sm" /></div>
                                </div>
                            </div>
                        )}

                        {activeTab === "intro" && (() => {
                            const cfg = getIntroConfig();
                            const preview = buildIntroPreview(cfg);
                            return (
                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 mb-1">Salutation</label>
                                        <input type="text" value={cfg.salutation} onChange={e => updateIntroConfig("salutation", e.target.value)} className="w-full px-4 py-2 border rounded-lg text-sm" placeholder="e.g. Respected Sir," />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 mb-1">Project Type Description</label>
                                        <input type="text" value={cfg.projectType || ""} onChange={e => updateIntroConfig("projectType", e.target.value)} className="w-full px-4 py-2 border rounded-lg text-sm" placeholder="e.g. Net-Metering based Rooftop PV Solar Power Plant" />
                                    </div>
                                    <div>
                                        <div className="flex items-center justify-between mb-3">
                                            <div>
                                                <label className="block text-sm font-bold text-slate-700">Solar Capacities</label>
                                                <p className="text-xs text-slate-400 mt-0.5">Formula: 1 KW × 4 units/day × 365 days = <strong>1,460 units/year</strong></p>
                                            </div>
                                            <button type="button" onClick={addCapacity} className="text-xs flex items-center gap-1 text-orange-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-orange-100 font-semibold">
                                                <Plus size={12} /> Add Capacity
                                            </button>
                                        </div>
                                        <div className="space-y-2">
                                            {cfg.capacities.map((cap, i) => {
                                                const units = Math.round(cap.kw * UNITS_PER_KW_PER_YEAR);
                                                return (
                                                    <div key={i} className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-4 py-3">
                                                        <div className="flex items-center gap-2 flex-1">
                                                            <input type="number" min="0.5" step="0.5" value={cap.kw} onChange={e => updateCapacity(i, e.target.value)} className="w-24 px-3 py-1.5 border border-slate-200 rounded-lg text-sm font-mono text-center outline-none focus:border-orange-400" />
                                                            <span className="text-sm font-semibold text-slate-600">KW DC</span>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs text-slate-400">≈</span>
                                                            <span className="text-sm font-bold text-emerald-600">{units.toLocaleString("en-IN")}</span>
                                                            <span className="text-xs text-slate-400">AC units/year</span>
                                                        </div>
                                                        <button type="button" onClick={() => removeCapacity(i)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={14} /></button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        {cfg.capacities.length === 0 && (
                                            <div className="text-center py-6 border-2 border-dashed border-slate-200 rounded-xl">
                                                <p className="text-sm text-slate-400">No capacities added. Click "+ Add Capacity".</p>
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 mb-1">Closing Sentence</label>
                                        <textarea rows={3} value={cfg.closing || ""} onChange={e => updateIntroConfig("closing", e.target.value)} className="w-full px-4 py-2 border rounded-lg text-sm" placeholder="This proposal has been designed as per..." />
                                    </div>
                                    <div className="bg-blue-50 border border-orange-100 rounded-xl p-4">
                                        <p className="text-[10px] font-bold text-orange-500 uppercase tracking-wider mb-2">Live Preview — PDF Page 2</p>
                                        <p className="text-xs text-slate-500 mb-2 font-semibold">{cfg.salutation}</p>
                                        <p className="text-sm text-slate-700 leading-relaxed">{preview || <span className="italic text-slate-400">Preview will appear here...</span>}</p>
                                    </div>
                                </div>
                            );
                        })()}


                        {activeTab === "howItWorks" && (
                            <div className="space-y-5">
                                {/* ── How It Works ── */}
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-3">How It Works</label>
                                    <div className="space-y-3">
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-600 mb-1">Paragraph 1 (System Operation)</label>
                                            <textarea rows={3} value={formData.howItWorksText1 || ""} onChange={e => setFormData(p => ({ ...p, howItWorksText1: e.target.value }))} className="w-full px-4 py-2 border rounded-lg text-sm" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-600 mb-1">Paragraph 2 (Power Utilization)</label>
                                            <textarea rows={3} value={formData.howItWorksText2 || ""} onChange={e => setFormData(p => ({ ...p, howItWorksText2: e.target.value }))} className="w-full px-4 py-2 border rounded-lg text-sm" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-600 mb-1">Paragraph 3 (Testing & Handover)</label>
                                            <textarea rows={2} value={formData.howItWorksText3 || ""} onChange={e => setFormData(p => ({ ...p, howItWorksText3: e.target.value }))} className="w-full px-4 py-2 border rounded-lg text-sm" />
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Diagram Image <span className="text-xs font-normal text-slate-400">(appears on this page)</span></label>
                                    <input type="text" placeholder="Diagram Title" value={formData.diagramTitle || ""} onChange={e => setFormData(p => ({ ...p, diagramTitle: e.target.value }))} className="w-full px-4 py-2 border rounded-lg text-sm mb-3" />
                                    <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 flex flex-col items-center justify-center text-center hover:bg-slate-50 transition-colors relative h-40">
                                        {formData.diagramImage ? (
                                            <img src={formData.diagramImage} alt="Diagram" className="max-h-full max-w-full object-contain" />
                                        ) : (
                                            <><UploadCloud size={28} className="text-slate-400 mb-2" /><span className="text-sm text-slate-500 font-medium">Click to upload diagram</span></>
                                        )}
                                        <input type="file" accept="image/*" onChange={(e) => handleUpload(e.target.files[0], "diagramImage")} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                                        {uploadingImage === "diagramImage" && <div className="absolute inset-0 bg-white/80 flex items-center justify-center"><Loader2 className="animate-spin text-orange-500" /></div>}
                                    </div>
                                </div>

                                <hr className="border-slate-200" />

                                {/* ── Benefits ── */}
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-3">Benefits & Single Line Diagram</label>
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">Single Line Diagram <span className="text-xs font-normal text-slate-400">(appears on this page)</span></label>
                                        <div className="border-2 border-dashed border-slate-300 rounded-xl p-4 flex flex-col items-center justify-center text-center hover:bg-slate-50 transition-colors relative h-36">
                                            {formData.singleLineImage ? (
                                                <img src={formData.singleLineImage} alt="Single Line" className="max-h-full max-w-full object-contain" />
                                            ) : (
                                                <><UploadCloud size={28} className="text-slate-400 mb-2" /><span className="text-sm text-slate-500 font-medium">Click to upload single line diagram</span></>
                                            )}
                                            <input type="file" accept="image/*" onChange={(e) => handleUpload(e.target.files[0], "singleLineImage")} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                                            {uploadingImage === "singleLineImage" && <div className="absolute inset-0 bg-white/80 flex items-center justify-center rounded-xl"><Loader2 className="animate-spin text-orange-500" /></div>}
                                        </div>
                                    </div>
                                    <div className="mt-4">
                                        <div className="flex justify-between items-center mb-2">
                                            <label className="block text-sm font-bold text-slate-700">Benefits ({formData.benefitsTitle || "Benefits Title"})</label>
                                            <button type="button" onClick={() => addArrayItem("benefits")} className="text-xs flex items-center gap-1 text-orange-600 bg-blue-50 px-2 py-1 rounded hover:bg-orange-100"><Plus size={12} /> Add Item</button>
                                        </div>
                                        <input type="text" value={formData.benefitsTitle || ""} onChange={e => setFormData(p => ({ ...p, benefitsTitle: e.target.value }))} placeholder="Benefits Title" className="w-full px-4 py-2 border rounded-lg text-sm mb-2 font-semibold" />
                                        <div className="space-y-2">
                                            {(formData.benefits || []).map((item, i) => (
                                                <div key={i} className="flex gap-2">
                                                    <input type="text" value={item} onChange={e => handleArrayChange("benefits", i, e.target.value)} className="flex-1 px-3 py-1.5 border rounded-lg text-sm" />
                                                    <button type="button" onClick={() => removeArrayItem("benefits", i)} className="p-1.5 text-red-400 hover:text-red-600 bg-white rounded border border-slate-200"><Trash2 size={16} /></button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}


                        {activeTab === "warrantee" && (
                            <div className="space-y-5">
                                <div><label className="block text-xs font-semibold text-slate-700 mb-1">Panels Warranty</label><textarea rows={5} value={formData.warranteePanels || ""} onChange={e => setFormData(p => ({ ...p, warranteePanels: e.target.value }))} className="w-full px-4 py-2 border rounded-lg text-sm" /></div>
                                <div><label className="block text-xs font-semibold text-slate-700 mb-1">Performance Warranty</label><textarea rows={2} value={formData.warranteePerformance || ""} onChange={e => setFormData(p => ({ ...p, warranteePerformance: e.target.value }))} className="w-full px-4 py-2 border rounded-lg text-sm" /></div>
                                <div><label className="block text-xs font-semibold text-slate-700 mb-1">Inverter / Equipment</label><textarea rows={3} value={formData.warranteeInverter || ""} onChange={e => setFormData(p => ({ ...p, warranteeInverter: e.target.value }))} className="w-full px-4 py-2 border rounded-lg text-sm" /></div>
                                <div><label className="block text-xs font-semibold text-slate-700 mb-1">Balance of the Systems</label><textarea rows={3} value={formData.warranteeBos || ""} onChange={e => setFormData(p => ({ ...p, warranteeBos: e.target.value }))} className="w-full px-4 py-2 border rounded-lg text-sm" /></div>

                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="block text-sm font-bold text-slate-700">Warrantee Notes</label>
                                        <button type="button" onClick={() => addArrayItem("warranteeNotes")} className="text-xs flex items-center gap-1 text-orange-600 bg-blue-50 px-2 py-1 rounded hover:bg-orange-100"><Plus size={12} /> Add Note</button>
                                    </div>
                                    <div className="space-y-2">
                                        {(formData.warranteeNotes || []).map((item, i) => (
                                            <div key={i} className="flex gap-2">
                                                <input type="text" value={item} onChange={e => handleArrayChange("warranteeNotes", i, e.target.value)} className="flex-1 px-3 py-1.5 border rounded-lg text-sm" />
                                                <button type="button" onClick={() => removeArrayItem("warranteeNotes", i)} className="p-1.5 text-red-400 hover:text-red-600 bg-white rounded border border-slate-200"><Trash2 size={16} /></button>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Warrantee Page Image (Optional)</label>
                                    <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 flex flex-col items-center justify-center text-center hover:bg-slate-50 transition-colors relative h-40">
                                        {formData.warranteeImage ? (
                                            <img src={formData.warranteeImage} alt="Warrantee Image" className="max-h-full max-w-full object-contain" />
                                        ) : (
                                            <><UploadCloud size={32} className="text-slate-400 mb-2" /><span className="text-sm text-slate-500 font-medium">Click to upload warrantee diagram</span></>
                                        )}
                                        <input type="file" accept="image/*" onChange={(e) => handleUpload(e.target.files[0], "warranteeImage")} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                                        {uploadingImage === "warranteeImage" && <div className="absolute inset-0 bg-white/80 flex items-center justify-center"><Loader2 className="animate-spin text-orange-500" /></div>}
                                    </div>
                                </div>
                            </div>
                        )}



                        {activeTab === "scope" && (
                            <div className="space-y-4">
                                <p className="text-xs text-slate-400">Client responsibilities listed on Page 7 of the PDF.</p>
                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="block text-sm font-bold text-slate-700">Client Scope</label>
                                        <button type="button" onClick={() => addArrayItem("clientScope")} className="text-xs flex items-center gap-1 text-orange-600 bg-blue-50 px-2 py-1 rounded hover:bg-orange-100"><Plus size={12} /> Add Item</button>
                                    </div>
                                    <div className="space-y-2">
                                        {(formData.clientScope || []).map((item, i) => (
                                            <div key={i} className="flex gap-2">
                                                <input type="text" value={item} onChange={e => handleArrayChange("clientScope", i, e.target.value)} className="flex-1 px-3 py-1.5 border rounded-lg text-sm" />
                                                <button type="button" onClick={() => removeArrayItem("clientScope", i)} className="p-1.5 text-red-400 hover:text-red-600 bg-white rounded border border-slate-200"><Trash2 size={16} /></button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="mt-6 border-t border-slate-200 pt-6">
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="block text-sm font-bold text-slate-700">Company Scope</label>
                                        <button type="button" onClick={() => addArrayItem("companyScope")} className="text-xs flex items-center gap-1 text-orange-600 bg-blue-50 px-2 py-1 rounded hover:bg-orange-100"><Plus size={12} /> Add Item</button>
                                    </div>
                                    <div className="space-y-2">
                                        {(formData.companyScope || []).map((item, i) => (
                                            <div key={i} className="flex gap-2">
                                                <input type="text" value={item} onChange={e => handleArrayChange("companyScope", i, e.target.value)} className="flex-1 px-3 py-1.5 border rounded-lg text-sm" />
                                                <button type="button" onClick={() => removeArrayItem("companyScope", i)} className="p-1.5 text-red-400 hover:text-red-600 bg-white rounded border border-slate-200"><Trash2 size={16} /></button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === "terms" && (
                            <div className="space-y-6">
                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="block text-sm font-bold text-slate-700">Payment Terms</label>
                                        <button type="button" onClick={() => addArrayItem("paymentTerms")} className="text-xs flex items-center gap-1 text-orange-600 bg-blue-50 px-2 py-1 rounded hover:bg-orange-100"><Plus size={12} /> Add Item</button>
                                    </div>
                                    <div className="space-y-2">
                                        {(formData.paymentTerms || []).map((item, i) => (
                                            <div key={i} className="flex gap-2">
                                                <input type="text" value={item} onChange={e => handleArrayChange("paymentTerms", i, e.target.value)} className="flex-1 px-3 py-1.5 border rounded-lg text-sm" />
                                                <button type="button" onClick={() => removeArrayItem("paymentTerms", i)} className="p-1.5 text-red-400 hover:text-red-600 bg-white rounded border border-slate-200"><Trash2 size={16} /></button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div><label className="block text-xs font-semibold text-slate-700 mb-1">Delivery Info</label><input type="text" value={formData.delivery || ""} onChange={e => setFormData(p => ({ ...p, delivery: e.target.value }))} className="w-full px-4 py-2 border rounded-lg text-sm" /></div>
                            </div>
                        )}

                        <div className="mt-8 flex justify-end gap-3 pt-6 border-t border-slate-200">
                            <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-100 transition-colors">Cancel</button>
                            <button type="submit" disabled={loading} className="px-6 py-2.5 rounded-xl bg-orange-600 text-white font-semibold text-sm hover:bg-orange-700 transition-all flex items-center gap-2 disabled:opacity-70">
                                {loading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                                {formData.id ? "Save Changes" : "Create Template"}
                            </button>
                        </div>
                    </form>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
