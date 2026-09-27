import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { X, Download, MessageCircle, Loader2, FileText, Plus, Minus, Eye, Edit, Zap, UploadCloud, CheckCircle2, RotateCcw } from "lucide-react";
import { collection, doc as firestoreDoc, getDoc, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "../../firebase";
import { createQuotationFile, createQuotationPreviewUrl, downloadQuotationPdf, numberToWords } from "../utils/quotationPdf";
import toast from "react-hot-toast";

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

function formatPreviewDate(date = new Date()) {
    return date.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

function getPreviewQuotationNo(lead, type) {
    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    const phone = String(lead?.phone || "").replace(/\D/g, "");
    const suffix = phone.slice(-4) || String(Date.now()).slice(-4);
    return `Q${yy}${suffix}-${type?.id ? type.id.toUpperCase().slice(0, 3) : "NEW"}`;
}

function cleanList(items) {
    return Array.isArray(items) ? items.map(item => String(item || "").trim()).filter(Boolean) : [];
}

export default function QuotationPreviewModal({ isOpen, lead, onClose, onActivity }) {
    const [templates, setTemplates] = useState([]);
    const [settings, setSettings] = useState({});
    const [fetching, setFetching] = useState(true);
    const [selectedTypeId, setSelectedTypeId] = useState(null);
    const [previewUrl, setPreviewUrl] = useState("");
    const [previewLoading, setPreviewLoading] = useState(false);
    const [previewError, setPreviewError] = useState("");
    const [action, setAction] = useState(null);
    const [activeTab, setActiveTab] = useState("form");
    const [formTab, setFormTab] = useState("details");
    const [uploadingImage, setUploadingImage] = useState(false);
    // Track which templateId formData was last initialized for
    // to avoid wiping user edits when the templates array reference updates
    const initializedForId = useRef(null);
    // Ref to hold the debounce timer for preview generation
    const previewDebounceTimer = useRef(null);

    const FORM_TABS = [
        { id: "details", label: " 1 · Cover" },
        { id: "intro", label: " 2 · Intro / About" },
        { id: "howItWorks", label: " 3 · How It Works & Benefits" },
        { id: "specification", label: " 4 · Materials & Financials" },
        { id: "roi", label: " 5 · ROI & SIP" },
        { id: "warrantee", label: " 6 · Warrantee" },
        { id: "scope", label: " 7 · Scope" },
        { id: "terms", label: " 8 · Terms" },
    ];

    // ── Intro helpers ─────────────────────────────────────────────
    const UNITS_PER_KW_PER_YEAR = 4 * 365; // 1460

    function getIntroConfig() {
        return formData.introConfig || {
            salutation: "Respected Sir,",
            capacities: [{}],
            closing: "This proposal has been designed as per the detailed analysis of the site and is based on your electricity bill calculation and the space available.",
            projectType: "Net-Metering based Rooftop PV Solar Power Plant"
        };
    }

    function updateIntroConfig(field, value) {
        setFormData(p => ({ ...p, introConfig: { ...getIntroConfig(), [field]: value } }));
    }

    function addIntroCapacity() {
        const cfg = getIntroConfig();
        updateIntroConfig("capacities", [...cfg.capacities, { kw: 1 }]);
    }

    function updateIntroCapacity(i, kw) {
        const cfg = getIntroConfig();
        updateIntroConfig("capacities", cfg.capacities.map((c, idx) => idx === i ? { kw: Number(kw) || 0 } : c));
    }

    function removeIntroCapacity(i) {
        const cfg = getIntroConfig();
        updateIntroConfig("capacities", cfg.capacities.filter((_, idx) => idx !== i));
    }

    function buildIntroPreview(cfg) {
        if (!cfg || !cfg.capacities || cfg.capacities.length === 0) return "";
        const capParts = cfg.capacities.map(c => {
            const units = Math.round(c.kw * UNITS_PER_KW_PER_YEAR);
            return `(${c.kw} KW DC capacities to generate approx. ${units.toLocaleString("en-IN")} AC units respectively annually.)`;
        }).join(" ");
        return `We are delighted to present to you the quotation/proposal for a ${cfg.projectType || "Net-Metering based Rooftop PV Solar Power Plant"} of ${capParts} ${cfg.closing || ""}`.trim();
    }
    // ──────────────────────────────────────────────────────────

    const selectedType = useMemo(
        () => templates.find((type) => type.id === selectedTypeId) || templates[0] || {},
        [selectedTypeId, templates]
    );

    const [formData, setFormData] = useState({});
    const includeRoiInPdf = formData.includeRoiInPdf !== false;

    const toggleRoiInPdf = () => {
        setFormData((prev) => ({
            ...prev,
            includeRoiInPdf: !(prev.includeRoiInPdf !== false),
        }));
    };

    useEffect(() => {
        if (!isOpen) return;
        let isMounted = true;
        setFetching(true);
        getDocs(query(collection(db, "quotationTemplates"), orderBy("createdAt", "desc")))
            .then(snap => {
                if (!isMounted) return;
                const data = snap.docs.map(d => {
                    const docData = d.data();
                    return {
                        ...docData,
                        id: d.id,
                        materialRows: typeof docData.materialRows === 'string' ? JSON.parse(docData.materialRows) : (docData.materialRows || []),
                        financialRows: typeof docData.financialRows === 'string' ? JSON.parse(docData.financialRows) : (docData.financialRows || [])
                    };
                });
                setTemplates(data);
                setSelectedTypeId((prev) => {
                    if (data.length > 0 && (!prev || !data.find(d => d.id === prev))) {
                        return data[0].id;
                    }
                    return prev;
                });
            })
            .catch(err => {
                console.error(err);
                if (isMounted) toast.error("Failed to load templates");
            })
            .finally(() => {
                if (isMounted) setFetching(false);
            });

        return () => { isMounted = false; };
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        let isMounted = true;

        getDoc(firestoreDoc(db, "settings", "branding"))
            .then((snap) => {
                if (isMounted && snap.exists()) setSettings(snap.data());
            })
            .catch((err) => {
                console.error("Failed to load quotation settings:", err);
                if (isMounted) setSettings({});
            });

        return () => { isMounted = false; };
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) {
            setSelectedTypeId(null);
            setActiveTab("form");
            setFormTab("details");
            initializedForId.current = null;
        }
    }, [isOpen]);

    useEffect(() => {
        // Only initialize formData when the selected template ID actually changes
        // (not just when templates array reference updates after a re-fetch)
        if (
            isOpen &&
            lead &&
            selectedType &&
            Object.keys(selectedType).length > 0 &&
            initializedForId.current !== selectedType.id
        ) {
            initializedForId.current = selectedType.id;
            const initialData = JSON.parse(JSON.stringify(selectedType));
            // Do not pull Material & Financial from DB. Start fresh every time.
            initialData.materialRows = [["", "", ""]];
            initialData.financialRows = [["", "", "", "", ""]];
            initialData.amountLabel = "";
            initialData.amountWords = "";
            initialData.monthlyBill = "";
            initialData.govtSubsidy = "";
            setFormData(initialData);
            // Reset sub-tab when template changes so user lands on Cover tab
            setFormTab("details");
        }
    }, [isOpen, lead, selectedType]);

    // Whenever formData or activeTab changes to preview, regenerate preview (debounced)
    useEffect(() => {
        if (!isOpen || !lead || activeTab !== "preview" || !formData.id) return;

        // Clear any pending debounce
        if (previewDebounceTimer.current) clearTimeout(previewDebounceTimer.current);

        let cancelled = false;
        setPreviewLoading(true);
        setPreviewError("");

        previewDebounceTimer.current = setTimeout(() => {
            setPreviewUrl("");
            createQuotationPreviewUrl(lead, formData)
                .then((url) => {
                    if (cancelled) {
                        URL.revokeObjectURL(url);
                        return;
                    }
                    setPreviewUrl(url);
                })
                .catch((err) => {
                    console.error("Failed to create quotation preview:", err);
                    if (!cancelled) setPreviewError("Preview unavailable");
                })
                .finally(() => {
                    if (!cancelled) setPreviewLoading(false);
                });
        }, 400); // 400ms debounce — avoids thrashing on rapid state changes

        return () => {
            cancelled = true;
            if (previewDebounceTimer.current) clearTimeout(previewDebounceTimer.current);
        };
    }, [isOpen, lead, formData, activeTab]);

    useEffect(() => {
        return () => {
            if (previewUrl) URL.revokeObjectURL(previewUrl);
        };
    }, [previewUrl]);

    if (!isOpen || !lead) return null;

    async function handleDownload() {
        setAction("download");
        try {
            const type = await downloadQuotationPdf(lead, formData);
            await onActivity?.(`Quotation PDF downloaded - ${type.name}`, "quotation");
        } catch (err) {
            console.error("Failed to download quotation:", err);
            toast.error("Failed to download quotation PDF. Please try again.");
        } finally {
            setAction(null);
        }
    }

    async function handleWhatsApp() {
        setAction("whatsapp");

        const number = lead?.phone ? lead.phone.replace(/\D/g, "") : "";

        // Copy to clipboard if available
        if (number) {
            try {
                await navigator.clipboard.writeText(number);
            } catch (e) {
                console.warn("Could not copy to clipboard", e);
            }
        }

        try {
            const { file } = await createQuotationFile(lead, formData);

            // Attempt to use Web Share API (auto-attaches the file on supported devices)
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                try {
                    await navigator.share({
                        title: "Quotation",
                        files: [file]
                    });
                    return; // Successfully shared, we can return early
                } catch (shareErr) {
                    console.log("Share failed or user cancelled, falling back...", shareErr);
                }
            }

            // Fallback: Download file and open WhatsApp Web directly to the chat
            const pdfUrl = URL.createObjectURL(file);
            const link = document.createElement("a");
            link.href = pdfUrl;
            link.download = file.name || "quotation.pdf";
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            let waUrl = "https://web.whatsapp.com/";
            if (number) {
                const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
                if (isMobile) {
                    waUrl = `https://api.whatsapp.com/send?phone=${number}`;
                } else {
                    waUrl = `https://web.whatsapp.com/send?phone=${number}`;
                }
            }
            window.open(waUrl, "_blank");

            setTimeout(() => {
                URL.revokeObjectURL(pdfUrl);
            }, 3000);
        } catch (err) {
            console.error(err);
            if (err?.name !== "AbortError") {
                toast.error("Failed to prepare quotation PDF.");
            }
        } finally {
            setAction(null);
        }
    }

    const handleFormChange = (e, field) => {
        setFormData({ ...formData, [field]: e.target.value });
    };

    const updateArrayRow = (arrayName, rowIndex, colIndex, value) => {
        const newArray = Array.isArray(formData[arrayName]) ? [...formData[arrayName]] : [];
        if (colIndex !== null) {
            const row = Array.isArray(newArray[rowIndex]) ? [...newArray[rowIndex]] : [];
            row[colIndex] = value;
            newArray[rowIndex] = row;
        } else {
            newArray[rowIndex] = value;
        }
        setFormData({ ...formData, [arrayName]: newArray });
    };

    const addArrayRow = (arrayName, template) => {
        const currentArray = Array.isArray(formData[arrayName]) ? formData[arrayName] : [];
        setFormData({ ...formData, [arrayName]: [...currentArray, template] });
    };

    const removeArrayRow = (arrayName, rowIndex) => {
        const newArray = Array.isArray(formData[arrayName]) ? [...formData[arrayName]] : [];
        newArray.splice(rowIndex, 1);
        setFormData({ ...formData, [arrayName]: newArray });
    };

    const handleUpload = async (file, field) => {
        if (!file) return;
        setUploadingImage(field);
        try {
            const data = new FormData();
            data.append("file", file);
            data.append("upload_preset", UPLOAD_PRESET);
            data.append("cloud_name", CLOUD_NAME);
            const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, { method: "POST", body: data });
            const result = await res.json();
            if (result.secure_url) {
                setFormData(p => ({ ...p, [field]: result.secure_url }));
                toast.success("Image uploaded!");
            } else throw new Error("Upload failed");
        } catch (err) {
            console.error(err);
            toast.error("Failed to upload image");
        } finally {
            setUploadingImage(false);
        }
    };

    function renderRoiPdfButton(compact = false) {
        const label = includeRoiInPdf
            ? (compact ? "ROI On" : "Include ROI in PDF")
            : (compact ? "ROI Off" : "Skip ROI in PDF");
        const title = includeRoiInPdf
            ? "ROI table will be included in the PDF"
            : "ROI table will be skipped from the PDF";

        return (
            <button
                type="button"
                onClick={toggleRoiInPdf}
                aria-pressed={includeRoiInPdf}
                title={title}
                className={`flex items-center gap-1.5 rounded-xl border text-sm font-semibold cursor-pointer transition-all ${compact ? "min-w-[86px] justify-center px-3 py-2" : "px-3.5 py-2"} ${includeRoiInPdf
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                    : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                    }`}
            >
                {includeRoiInPdf ? <CheckCircle2 size={14} /> : <FileText size={14} />}
                {label}
            </button>
        );
    }

    const companyName = settings.companyName || "our company";
    const preparedBy = settings.companyName || "";
    const customerName = lead.name || "Customer";
    const customerPlace = lead.company || lead.source || "";
    const customerLine = customerPlace ? `${customerName}, ${customerPlace}` : customerName;
    const todayLabel = formatPreviewDate();
    const confidentialityText = `These documents contain proprietary trade secret and confidential information to be used solely for evaluating ${companyName}. The information contained herein is to be considered confidential. Customer, by receiving these documents agrees that neither this document nor the information disclosed herein, nor any part thereof, shall be reproduced or transferred to other documents or used or disclosed to others for any purpose except as specifically authorized in writing by ${companyName}.`;
    const expertiseList = cleanList(settings.expertiseList);
    const clientScopeItems = cleanList(formData.clientScope);

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 " onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
                {/* ── Header ── */}
                <div className="flex items-center justify-between px-6 py-3.5 border-b border-slate-100 bg-white shrink-0">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-purple-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-orange-500/30">
                            <Zap size={16} />
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-sm font-bold text-slate-800">Quotation Generator</h2>
                            <p className="text-xs text-slate-400 truncate max-w-[220px]">{lead.name} · {lead.phone || "No phone"}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="flex bg-slate-100 p-0.5 rounded-lg gap-0.5">
                            <button onClick={() => setActiveTab("form")} className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-md transition-all ${activeTab === "form" ? "bg-white text-orange-600 shadow-sm" : "text-slate-500 hover:text-slate-700 bg-transparent border-none"}`}>
                                <Edit size={12} /> Edit
                            </button>
                            <button onClick={() => setActiveTab("preview")} className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-md transition-all ${activeTab === "preview" ? "bg-white text-orange-600 shadow-sm" : "text-slate-500 hover:text-slate-700 bg-transparent border-none"}`}>
                                <Eye size={12} /> Preview
                            </button>
                        </div>
                        {activeTab === "form" && Object.keys(formData).length > 0 && (
                            <button
                                type="button"
                                title="Reset this template's edits back to saved defaults"
                                onClick={() => {
                                    if (!window.confirm("Reset all edits for this template back to defaults? Your changes will be lost.")) return;
                                    initializedForId.current = null; // force re-init
                                    setFormTab("details");
                                    // trigger the init effect
                                    setFormData({});
                                }}
                                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 text-slate-400 hover:text-orange-600 hover:border-orange-200 hover:bg-orange-50 bg-white transition-all"
                            >
                                <RotateCcw size={12} /> Reset
                            </button>
                        )}
                        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 border-none bg-transparent cursor-pointer transition-all">
                            <X size={18} />
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-[180px_1fr] max-lg:grid-cols-1 flex-1 min-h-0">
                    {/* ── Template Sidebar ── */}
                    <aside className="border-r border-slate-100 max-lg:border-r-0 max-lg:border-b max-lg:max-h-48 overflow-y-auto p-3 bg-slate-50">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">Templates</p>
                        {fetching ? (
                            <div className="flex justify-center py-6"><Loader2 size={18} className="animate-spin text-orange-400" /></div>
                        ) : templates.length === 0 ? (
                            <div className="text-xs text-slate-400 text-center py-4 px-1">No templates found.</div>
                        ) : (
                            <div className="flex flex-col gap-1.5">
                                {templates.map((type) => {
                                    const isSelected = selectedTypeId === type.id;
                                    return (
                                        <button key={type.id} type="button" onClick={() => setSelectedTypeId(type.id)}
                                            className={`flex items-center gap-2.5 w-full text-left rounded-lg px-2 py-1.5 cursor-pointer transition-all duration-150 ${isSelected
                                                ? "bg-blue-50 ring-1 ring-orange-400"
                                                : "hover:bg-slate-100"
                                                }`}
                                        >

                                            {/* Info */}
                                            <div className="min-w-0">
                                                <p className={`text-xs font-semibold leading-tight truncate ${isSelected ? "text-orange-700" : "text-slate-700"}`}>{type.name}</p>
                                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full mt-0.5 inline-block ${isSelected ? "bg-orange-100 text-orange-600" : "bg-slate-200 text-slate-500"
                                                    }`}>{type.badge || "Template"}</span>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </aside>

                    {/* ── Main Content ── */}
                    <section className="min-h-0 min-w-0 flex flex-col bg-slate-50/50">
                        {activeTab === "form" ? (
                            <div className="flex-1 flex flex-col min-h-0 min-w-0">
                                {/* Sub-tab bar */}
                                <div className="border-b border-slate-100 bg-white px-5 flex gap-1 overflow-x-auto overflow-y-hidden scrollbar-hide shrink-0 max-w-full">
                                    {FORM_TABS.map((tab) => (
                                        <button key={tab.id} onClick={() => setFormTab(tab.id)}
                                            className={`whitespace-nowrap px-3 py-3 text-[13px] font-semibold border-b-2 transition-all ${formTab === tab.id ? "border-orange-500 text-orange-600" : "border-transparent text-slate-400 hover:text-slate-600"
                                                }`}
                                        >{tab.label}</button>
                                    ))}
                                </div>
                                <div className="flex-1 overflow-y-auto p-5">
                                    <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
                                        {formTab === "details" && (
                                            <div className="space-y-5">
                                                <div>
                                                    <h3 className="font-semibold text-slate-800 mb-2 border-b pb-2">PDF Page 1 · Cover Details</h3>
                                                    <div className="grid grid-cols-2 max-md:grid-cols-1 gap-4">
                                                        <div>
                                                            <label className="block text-xs text-slate-500 mb-1">Customer Name</label>
                                                            <input type="text" value={formData.customerName !== undefined ? formData.customerName : customerName} onChange={e => handleFormChange(e, "customerName")} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-orange-500" />
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs text-slate-500 mb-1">Mobile Number</label>
                                                            <input type="text" value={formData.customerMobile !== undefined ? formData.customerMobile : (lead.phone || "No phone")} onChange={e => handleFormChange(e, "customerMobile")} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-orange-500" />
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs text-slate-500 mb-1">Quotation Number</label>
                                                            <input type="text" value={formData.quotationNumber !== undefined ? formData.quotationNumber : `Quotation - ${getPreviewQuotationNo(lead, formData)}`} onChange={e => handleFormChange(e, "quotationNumber")} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-orange-500" />
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs text-slate-500 mb-1">Preparation Date</label>
                                                            <input type="text" value={formData.preparationDate !== undefined ? formData.preparationDate : todayLabel} onChange={e => handleFormChange(e, "preparationDate")} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-orange-500" />
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs text-slate-500 mb-1">To</label>
                                                            <input type="text" value={formData.customerTo !== undefined ? formData.customerTo : customerLine} onChange={e => handleFormChange(e, "customerTo")} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-orange-500" />
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs text-slate-500 mb-1">Issue Version</label>
                                                            <input type="text" value={formData.issueVersion !== undefined ? formData.issueVersion : "V.1"} onChange={e => handleFormChange(e, "issueVersion")} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-orange-500" />
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-2 max-md:grid-cols-1 gap-4">
                                                    <div>
                                                        <label className="block text-xs text-slate-500 mb-1">Project Title</label>
                                                        <input type="text" value={formData.projectTitle || ""} onChange={(e) => handleFormChange(e, "projectTitle")} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-orange-500" />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs text-slate-500 mb-1">Project Name</label>
                                                        <input type="text" value={formData.projectName || ""} onChange={(e) => handleFormChange(e, "projectName")} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-orange-500" />
                                                    </div>
                                                </div>

                                                <div>
                                                    <label className="block text-xs font-semibold text-slate-700 mb-1">Statement of Confidentiality</label>
                                                    <textarea rows={4} value={formData.confidentialityText !== undefined ? formData.confidentialityText : confidentialityText} onChange={e => handleFormChange(e, "confidentialityText")} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-orange-500 resize-none leading-relaxed" />
                                                </div>

                                                <div>
                                                    <h3 className="font-semibold text-slate-800 mb-2 border-b pb-2">Project Summary Table</h3>
                                                    <div className="grid grid-cols-2 max-md:grid-cols-1 gap-3 text-sm">
                                                        <div className="rounded-lg border border-slate-200 p-3 bg-slate-50">
                                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Project</p>
                                                            <p className="mt-1 font-semibold text-slate-700">{formData.projectName || "Not set"}</p>
                                                        </div>
                                                        <div className="rounded-lg border border-slate-200 p-3 bg-white">
                                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Prepared By</p>
                                                            <input type="text" value={formData.preparedBy !== undefined ? formData.preparedBy : (preparedBy || "Not set")} onChange={e => handleFormChange(e, "preparedBy")} className="w-full text-sm border border-slate-200 rounded px-2 py-1 outline-none focus:border-orange-500" />
                                                        </div>
                                                        <div className="rounded-lg border border-slate-200 p-3 bg-slate-50">
                                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Preparation Date</p>
                                                            <p className="mt-1 font-semibold text-slate-700">{todayLabel}</p>
                                                        </div>
                                                        <div className="rounded-lg border border-slate-200 p-3 bg-slate-50">
                                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Quotation Type</p>
                                                            <p className="mt-1 font-semibold text-slate-700">{formData.name || "Template"}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {formTab === "intro" && (() => {
                                            const cfg = getIntroConfig();
                                            const preview = buildIntroPreview(cfg);
                                            return (
                                                <div className="space-y-5">
                                                    <div>
                                                        <label className="block text-xs font-semibold text-slate-700 mb-1">Salutation</label>
                                                        <input type="text" value={cfg.salutation} onChange={e => updateIntroConfig("salutation", e.target.value)} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-orange-500" placeholder="e.g. Respected Sir," />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-semibold text-slate-700 mb-1">Project Type Description</label>
                                                        <input type="text" value={cfg.projectType || ""} onChange={e => updateIntroConfig("projectType", e.target.value)} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-orange-500" placeholder="e.g. Net-Metering based Rooftop PV Solar Power Plant" />
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center justify-between mb-3">
                                                            <div>
                                                                <label className="block text-sm font-bold text-slate-700">Solar Capacities</label>
                                                                <p className="text-xs text-slate-400 mt-0.5">1 KW × 4 units/day × 365 days = <strong>1,460 units/year</strong></p>
                                                            </div>
                                                            <button type="button" onClick={addIntroCapacity} className="text-xs flex items-center gap-1 text-orange-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-orange-100 font-semibold">
                                                                <Plus size={12} /> Add Capacity
                                                            </button>
                                                        </div>
                                                        <div className="space-y-2">
                                                            {cfg.capacities.map((cap, i) => {
                                                                const units = Math.round(cap.kw * UNITS_PER_KW_PER_YEAR);
                                                                return (
                                                                    <div key={i} className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                                                                        <div className="flex items-center gap-2 flex-1">
                                                                            <input type="number" min="0.5" step="0.5" value={cap.kw} onChange={e => updateIntroCapacity(i, e.target.value)} className="w-20 px-2 py-1.5 border border-slate-200 rounded-lg text-sm font-mono text-center outline-none focus:border-orange-400" />
                                                                            <span className="text-sm font-semibold text-slate-600">KW DC</span>
                                                                        </div>
                                                                        <div className="flex items-center gap-1.5">
                                                                            <span className="text-xs text-slate-400">≈</span>
                                                                            <span className="text-sm font-bold text-emerald-600">{units.toLocaleString("en-IN")}</span>
                                                                            <span className="text-xs text-slate-400">units/yr</span>
                                                                        </div>
                                                                        <button type="button" onClick={() => removeIntroCapacity(i)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Minus size={14} /></button>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                        {cfg.capacities.length === 0 && (
                                                            <div className="text-center py-5 border-2 border-dashed border-slate-200 rounded-xl">
                                                                <p className="text-sm text-slate-400">No capacities. Click "+ Add Capacity".</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-semibold text-slate-700 mb-1">Closing Sentence</label>
                                                        <textarea rows={3} value={cfg.closing || ""} onChange={e => updateIntroConfig("closing", e.target.value)} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-orange-500" />
                                                    </div>
                                                    <div className="bg-blue-50 border border-orange-100 rounded-xl p-4">
                                                        <p className="text-[10px] font-bold text-orange-500 uppercase tracking-wider mb-2">Live Preview — PDF Page 2</p>
                                                        <p className="text-xs text-slate-500 mb-2 font-semibold">{cfg.salutation}</p>
                                                        <p className="text-sm text-slate-700 leading-relaxed">{preview || <span className="italic text-slate-400">Preview will appear here...</span>}</p>
                                                    </div>

                                                    <div className="border-t border-slate-200 pt-5 space-y-4">
                                                        <div>
                                                            <h3 className="font-semibold text-slate-800 mb-2">About us:-</h3>
                                                            <textarea rows={4} value={formData.aboutText !== undefined ? formData.aboutText : (settings.aboutText || "About us content is printed from Settings. Add it in Settings to show it in the PDF.")} onChange={e => handleFormChange(e, "aboutText")} className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-orange-500 leading-relaxed"></textarea>
                                                        </div>

                                                        <div>
                                                            <h3 className="font-semibold text-slate-800 mb-2">Our areas of expertise include the following:</h3>
                                                            <div className="space-y-2">
                                                                {(formData.expertiseList !== undefined ? formData.expertiseList : expertiseList).map((item, i) => (
                                                                    <div key={i} className="flex gap-2">
                                                                        <input type="text" value={item} onChange={(e) => {
                                                                            const newArr = [...(formData.expertiseList !== undefined ? formData.expertiseList : expertiseList)];
                                                                            newArr[i] = e.target.value;
                                                                            setFormData({ ...formData, expertiseList: newArr });
                                                                        }} className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-orange-500" />
                                                                        <button onClick={() => {
                                                                            const newArr = [...(formData.expertiseList !== undefined ? formData.expertiseList : expertiseList)];
                                                                            newArr.splice(i, 1);
                                                                            setFormData({ ...formData, expertiseList: newArr });
                                                                        }} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Minus size={16} /></button>
                                                                    </div>
                                                                ))}
                                                                <button onClick={() => {
                                                                    const newArr = [...(formData.expertiseList !== undefined ? formData.expertiseList : expertiseList), ""];
                                                                    setFormData({ ...formData, expertiseList: newArr });
                                                                }} className="self-start flex items-center gap-1 text-sm text-orange-600 hover:text-orange-700 font-medium px-2 py-1 bg-blue-50 rounded-lg"><Plus size={16} /> Add Expertise</button>
                                                            </div>
                                                        </div>

                                                        <div>
                                                            <h3 className="font-semibold text-slate-800 mb-2 mt-4">Why us:-</h3>
                                                            <div className="space-y-3">
                                                                <input type="text" placeholder="Title (e.g. Why us:-)" value={formData.whyUsTitle !== undefined ? formData.whyUsTitle : "Why us:-"} onChange={e => handleFormChange(e, "whyUsTitle")} className="w-full font-semibold text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-orange-500 bg-slate-50" />
                                                                <textarea rows={2} value={formData.whyUsText1 !== undefined ? formData.whyUsText1 : "Top quality, maximum performance, and custom-made design."} onChange={e => handleFormChange(e, "whyUsText1")} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-orange-500" />
                                                                <textarea rows={3} value={formData.whyUsText2 !== undefined ? formData.whyUsText2 : `All components of a ${settings.companyName || "company"} power plant are subject to the strictest testing requirements. The solar panels, invertors, and associated components are tested to withstand extreme environmental conditions to ensure reliability and maximum power output.`} onChange={e => handleFormChange(e, "whyUsText2")} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-orange-500" />
                                                                <input type="text" value={formData.whyUsText3 !== undefined ? formData.whyUsText3 : "Solar energy helps the country for better environment with Green Energy."} onChange={e => handleFormChange(e, "whyUsText3")} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-orange-500" />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })()}

                                        {formTab === "howItWorks" && (
                                            <div className="flex flex-col gap-5">
                                                <h3 className="font-semibold text-slate-800 border-b pb-2">PDF Page 3 · How It Works</h3>
                                                <div>
                                                    <label className="block text-xs text-slate-500 mb-1">Paragraph 1 (System Operation)</label>
                                                    <textarea value={formData.howItWorksText1 || ""} onChange={(e) => handleFormChange(e, "howItWorksText1")} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-orange-500 min-h-[80px]" />
                                                </div>
                                                <div>
                                                    <label className="block text-xs text-slate-500 mb-1">Paragraph 2 (Power Utilization)</label>
                                                    <textarea value={formData.howItWorksText2 || ""} onChange={(e) => handleFormChange(e, "howItWorksText2")} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-orange-500 min-h-[80px]" />
                                                </div>
                                                <div>
                                                    <label className="block text-xs text-slate-500 mb-1">Paragraph 3 (Testing & Handover)</label>
                                                    <textarea value={formData.howItWorksText3 || ""} onChange={(e) => handleFormChange(e, "howItWorksText3")} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-orange-500 min-h-[60px]" />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Diagram Image <span className="text-xs font-normal text-slate-400">(PDF Page 3)</span></label>
                                                    <input type="text" placeholder="Diagram Title" value={formData.diagramTitle || ""} onChange={(e) => handleFormChange(e, "diagramTitle")} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-orange-500 mb-3" />
                                                    <div className="border-2 border-dashed border-slate-300 rounded-xl p-4 flex flex-col items-center justify-center text-center hover:bg-slate-50 transition-colors relative h-36">
                                                        {formData.diagramImage ? (<img src={formData.diagramImage} alt="Diagram" className="max-h-full max-w-full object-contain" />) : (<><UploadCloud size={28} className="text-slate-400 mb-2" /><span className="text-sm text-slate-500">Click to upload diagram</span></>)}
                                                        <input type="file" accept="image/*" onChange={(e) => handleUpload(e.target.files[0], "diagramImage")} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                                                        {uploadingImage === "diagramImage" && <div className="absolute inset-0 bg-white/80 flex items-center justify-center rounded-xl"><Loader2 className="animate-spin text-orange-500" /></div>}
                                                    </div>
                                                </div>

                                                <hr className="border-slate-200" />
                                                <h3 className="font-semibold text-slate-800 border-b pb-2">Benefits & Single Line Diagram</h3>

                                                <div>
                                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Single Line Diagram <span className="text-xs font-normal text-slate-400">(PDF Page 3)</span></label>
                                                    <div className="border-2 border-dashed border-slate-300 rounded-xl p-4 flex flex-col items-center justify-center text-center hover:bg-slate-50 transition-colors relative h-36">
                                                        {formData.singleLineImage ? (<img src={formData.singleLineImage} alt="Single Line" className="max-h-full max-w-full object-contain" />) : (<><UploadCloud size={28} className="text-slate-400 mb-2" /><span className="text-sm text-slate-500">Click to upload single line diagram</span></>)}
                                                        <input type="file" accept="image/*" onChange={(e) => handleUpload(e.target.files[0], "singleLineImage")} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                                                        {uploadingImage === "singleLineImage" && <div className="absolute inset-0 bg-white/80 flex items-center justify-center rounded-xl"><Loader2 className="animate-spin text-orange-500" /></div>}
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="block text-xs text-slate-500 mb-1">Benefits Title</label>
                                                    <input type="text" value={formData.benefitsTitle || ""} onChange={(e) => handleFormChange(e, "benefitsTitle")} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-orange-500 mb-2" />
                                                </div>
                                                <div className="flex flex-col gap-2">
                                                    {formData.benefits?.map((benefit, i) => (
                                                        <div key={i} className="flex gap-2">
                                                            <input type="text" value={benefit} onChange={(e) => updateArrayRow("benefits", i, null, e.target.value)} className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-orange-500" />
                                                            <button onClick={() => removeArrayRow("benefits", i)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Minus size={16} /></button>
                                                        </div>
                                                    ))}
                                                    <button onClick={() => addArrayRow("benefits", "")} className="self-start flex items-center gap-1 text-sm text-orange-600 hover:text-orange-700 font-medium px-2 py-1"><Plus size={16} /> Add Benefit</button>
                                                </div>
                                            </div>
                                        )}

                                        {formTab === "warrantee" && (
                                            <div className="flex flex-col gap-4">
                                                <h3 className="font-semibold text-slate-800 mb-2 border-b pb-2">Warrantee Details</h3>
                                                <div>
                                                    <label className="block text-xs text-slate-500 mb-1">Panels Warranty</label>
                                                    <textarea value={formData.warranteePanels || ""} onChange={(e) => handleFormChange(e, "warranteePanels")} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-orange-500 min-h-[100px]" />
                                                </div>
                                                <div>
                                                    <label className="block text-xs text-slate-500 mb-1">Performance Warranty</label>
                                                    <textarea value={formData.warranteePerformance || ""} onChange={(e) => handleFormChange(e, "warranteePerformance")} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-orange-500 min-h-[60px]" />
                                                </div>
                                                <div>
                                                    <label className="block text-xs text-slate-500 mb-1">Inverter / Equipment</label>
                                                    <textarea value={formData.warranteeInverter || ""} onChange={(e) => handleFormChange(e, "warranteeInverter")} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-orange-500 min-h-[60px]" />
                                                </div>
                                                <div>
                                                    <label className="block text-xs text-slate-500 mb-1">Balance of Systems (BOS)</label>
                                                    <textarea value={formData.warranteeBos || ""} onChange={(e) => handleFormChange(e, "warranteeBos")} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-orange-500 min-h-[60px]" />
                                                </div>
                                                <div>
                                                    <label className="block text-xs text-slate-500 mb-1 font-semibold">Warrantee Notes</label>
                                                    {formData.warranteeNotes?.map((note, i) => (
                                                        <div key={i} className="flex gap-2 mb-2">
                                                            <input type="text" value={note} onChange={(e) => updateArrayRow("warranteeNotes", i, null, e.target.value)} className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-orange-500" />
                                                            <button onClick={() => removeArrayRow("warranteeNotes", i)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Minus size={16} /></button>
                                                        </div>
                                                    ))}
                                                    <button onClick={() => addArrayRow("warranteeNotes", "")} className="self-start flex items-center gap-1 text-sm text-orange-600 hover:text-orange-700 font-medium px-2 py-1"><Plus size={16} /> Add Note</button>
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Warrantee Page Image (Optional)</label>
                                                    <div className="border-2 border-dashed border-slate-300 rounded-xl p-4 flex flex-col items-center justify-center text-center hover:bg-slate-50 transition-colors relative h-36">
                                                        {formData.warranteeImage ? (
                                                            <img src={formData.warranteeImage} alt="Warrantee" className="max-h-full max-w-full object-contain" />
                                                        ) : (
                                                            <><UploadCloud size={28} className="text-slate-400 mb-2" /><span className="text-sm text-slate-500">Click to upload warrantee image</span></>
                                                        )}
                                                        <input type="file" accept="image/*" onChange={(e) => handleUpload(e.target.files[0], "warranteeImage")} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                                                        {uploadingImage === "warranteeImage" && <div className="absolute inset-0 bg-white/80 flex items-center justify-center rounded-xl"><Loader2 className="animate-spin text-orange-500" /></div>}
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {formTab === "specification" && (
                                            <div className="flex flex-col gap-6">
                                                {/* Material Rows */}
                                                <div>
                                                    <div className="flex justify-between items-center mb-2">
                                                        <h3 className="font-semibold text-slate-800">Material Rows</h3>
                                                        <button onClick={() => addArrayRow("materialRows", ["", "", ""])} className="text-xs flex items-center gap-1 text-orange-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-orange-100 font-semibold"><Plus size={12} /> Add Row</button>
                                                    </div>
                                                    <div className="grid grid-cols-[1fr_1fr_1.5fr_auto] gap-2 mb-1 px-1">
                                                        {["Parts / Material", "Make", "Specification", ""].map((h, i) => <span key={i} className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{h}</span>)}
                                                    </div>
                                                    <div className="flex flex-col gap-2">
                                                        {formData.materialRows?.map((row, i) => (
                                                            <div key={i} className="grid grid-cols-[1fr_1fr_1.5fr_auto] gap-2 items-start">
                                                                <textarea value={row[0]} onChange={(e) => updateArrayRow("materialRows", i, 0, e.target.value)} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-orange-500 min-h-[52px]" />
                                                                <textarea value={row[1]} onChange={(e) => updateArrayRow("materialRows", i, 1, e.target.value)} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-orange-500 min-h-[52px]" />
                                                                <textarea value={row[2]} onChange={(e) => updateArrayRow("materialRows", i, 2, e.target.value)} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-orange-500 min-h-[52px]" />
                                                                <button onClick={() => removeArrayRow("materialRows", i)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg mt-1"><Minus size={18} /></button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* Financial Rows (merged into Page 4) */}
                                                {(() => {
                                                    // Uses the shared numberToWords imported from quotationPdf.js
                                                    function toNum(v) { return parseFloat(String(v || "").replace(/,/g, "")) || 0; }
                                                    const rows = formData.financialRows || [];
                                                    const computedRows = rows.map(row => { const rate = toNum(row[1]); const disc = toNum(row[3]); return { rate, disc, total: rate, final_: rate - disc }; });
                                                    const grandTotal = computedRows.reduce((s, r) => s + r.final_, 0);
                                                    const autoLabel = grandTotal > 0 ? `Rs. ${grandTotal.toLocaleString("en-IN")}/-` : "";
                                                    const autoWords = numberToWords(grandTotal);
                                                    function updateFinRow(rIdx, cIdx, val) {
                                                        const updated = (formData.financialRows || []).map((r, i) => {
                                                            if (i !== rIdx) return r;
                                                            const copy = [...r]; copy[cIdx] = val;
                                                            const rate = toNum(cIdx === 1 ? val : copy[1]); const disc = toNum(cIdx === 3 ? val : copy[3]);
                                                            copy[2] = rate > 0 ? rate.toLocaleString("en-IN") : copy[2];
                                                            copy[4] = (rate - disc) >= 0 ? (rate - disc).toLocaleString("en-IN") : "";
                                                            return copy;
                                                        });
                                                        setFormData(p => ({ ...p, financialRows: updated }));
                                                    }
                                                    const COLS = [
                                                        { label: "Description", flex: "flex-[3]", cIdx: 0, editable: true, type: "text" },
                                                        { label: "Rate (₹)", flex: "flex-[2]", cIdx: 1, editable: true, type: "number" },
                                                        { label: "Total", flex: "flex-[2]", cIdx: 2, editable: false },
                                                        { label: "Discount", flex: "flex-[2]", cIdx: 3, editable: true, type: "number" },
                                                        { label: "Final (₹)", flex: "flex-[2]", cIdx: 4, editable: false },
                                                    ];
                                                    return (
                                                        <div className="space-y-3">
                                                            <div className="flex justify-between items-center">
                                                                <div>
                                                                    <p className="text-sm font-bold text-slate-700">Financial Rows</p>
                                                                    <p className="text-xs text-slate-400">Total = Rate · Final = Total − Discount</p>
                                                                </div>
                                                                <button onClick={() => addArrayRow("financialRows", ["", "", "", "", ""])} className="text-xs flex items-center gap-1 text-orange-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-orange-100 font-semibold"><Plus size={12} /> Add Row</button>
                                                            </div>
                                                            <div className="flex gap-2 px-1">
                                                                {COLS.map(c => <span key={c.cIdx} className={`${c.flex} text-[10px] font-bold text-slate-400 uppercase tracking-wide`}>{c.label}</span>)}
                                                                <span className="w-8" />
                                                            </div>
                                                            <div className="space-y-2">
                                                                {rows.length === 0 && <div className="text-center py-4 border-2 border-dashed border-slate-200 rounded-xl"><p className="text-sm text-slate-400">No rows. Click "+ Add Row".</p></div>}
                                                                {rows.map((row, rIdx) => {
                                                                    const r = computedRows[rIdx];
                                                                    return (
                                                                        <div key={rIdx} className="flex gap-2 items-center bg-white border border-slate-100 rounded-xl px-2 py-1.5">
                                                                            {COLS.map(col => col.editable ? (
                                                                                <input key={col.cIdx} type={col.type} value={row[col.cIdx] || ""} onChange={e => updateFinRow(rIdx, col.cIdx, e.target.value)} className={`${col.flex} px-2 py-1.5 border border-slate-200 rounded-lg text-sm outline-none focus:border-orange-400`} placeholder={col.label} />
                                                                            ) : (
                                                                                <div key={col.cIdx} className={`${col.flex} px-2 py-1.5 rounded-lg text-sm font-semibold text-right ${col.cIdx === 4 ? "text-emerald-600 bg-emerald-50" : "text-slate-500 bg-slate-50"}`}>
                                                                                    {col.cIdx === 2 ? (r.total > 0 ? r.total.toLocaleString("en-IN") : "—") : (r.final_ >= 0 ? r.final_.toLocaleString("en-IN") : "—")}
                                                                                </div>
                                                                            ))}
                                                                            <button onClick={() => removeArrayRow("financialRows", rIdx)} className="w-8 h-8 flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Minus size={15} /></button>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                            {rows.length > 0 && (
                                                                <div className="flex justify-end">
                                                                    <div className="bg-orange-600 text-white rounded-xl px-5 py-2.5 flex items-center gap-4">
                                                                        <span className="text-xs font-semibold opacity-80">Grand Total</span>
                                                                        <span className="text-lg font-bold">₹ {grandTotal.toLocaleString("en-IN")}</span>
                                                                    </div>
                                                                </div>
                                                            )}
                                                            <div className="grid grid-cols-2 gap-4">
                                                                <div>
                                                                    <label className="block text-xs font-semibold text-slate-700 mb-1">Amount Label <span className="font-normal text-slate-400">(auto-filled no need change it )</span></label>
                                                                    <input type="text" value={formData.amountLabel !== undefined ? formData.amountLabel : autoLabel} onChange={e => handleFormChange(e, "amountLabel")} placeholder={autoLabel || "Rs. 1,20,000/-"} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-orange-500" />
                                                                </div>
                                                                <div>
                                                                    <label className="block text-xs font-semibold text-slate-700 mb-1">Amount in Words <span className="font-normal text-slate-400">(auto-filled no need change it )</span></label>
                                                                    <input type="text" value={formData.amountWords !== undefined ? formData.amountWords : autoWords} onChange={e => handleFormChange(e, "amountWords")} placeholder={autoWords || "One Lakh..."} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-orange-500" />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                        )}

                                        {formTab === "roi" && (() => {
                                            function toNum(v) { return parseFloat(String(v || "").replace(/,/g, "")) || 0; }
                                            const rows = formData.financialRows || [];
                                            const quotedAmount = rows.reduce((s, r) => { const rt = toNum(r[1]); const d = toNum(r[3]); return s + (rt - d); }, 0);
                                            const govtSubsidy = toNum(formData.govtSubsidy);
                                            const actualInvest = Math.max(0, quotedAmount - govtSubsidy);
                                            const monthlyBill = toNum(formData.monthlyBill);
                                            const annualSavings = monthlyBill * 12;
                                            const paybackYears = annualSavings > 0 ? actualInvest / annualSavings : 0;
                                            const pwY = Math.floor(paybackYears);
                                            const pwM = Math.round((paybackYears - pwY) * 12);
                                            const total25 = annualSavings * 25;
                                            const systemInfo = formData.name || formData.projectName || "Solar Power System";
                                            const fmt = n => Math.round(n).toLocaleString("en-IN");
                                            function toLakhs(n) {
                                                if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)} Crore`;
                                                if (n >= 100000) return `₹${(n / 100000).toFixed(1)} Lakhs`;
                                                return `₹${fmt(n)}`;
                                            }

                                            return (
                                                <div className="space-y-5">
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div>
                                                            <h3 className="text-sm font-bold text-slate-800">ROI & SIP Analysis</h3>
                                                            <p className="text-xs text-slate-400 mt-0.5">Professional client-facing summary · Auto-calculated from financials</p>
                                                        </div>
                                                        {renderRoiPdfButton()}
                                                    </div>

                                                    {/* Inputs */}
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                                                            <label className="block text-xs font-bold text-amber-800 mb-1.5">📋 Monthly Electricity Bill (₹)</label>
                                                            <input type="number" min="0" value={formData.monthlyBill || ""} onChange={e => setFormData(p => ({ ...p, monthlyBill: e.target.value }))} placeholder="e.g. 4000" className="w-full text-sm font-bold border border-amber-300 rounded-lg px-3 py-2 outline-none focus:border-amber-500 bg-white" />
                                                        </div>
                                                        <div className="bg-green-50 border border-green-200 rounded-xl p-3">
                                                            <label className="block text-xs font-bold text-green-800 mb-1.5">🏛️ Govt. Subsidy Amount (₹)</label>
                                                            <input type="number" min="0" value={formData.govtSubsidy || ""} onChange={e => setFormData(p => ({ ...p, govtSubsidy: e.target.value }))} placeholder="e.g. 78000" className="w-full text-sm font-bold border border-green-300 rounded-lg px-3 py-2 outline-none focus:border-green-500 bg-white" />
                                                        </div>
                                                    </div>

                                                    {/* Professional Summary Table */}
                                                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                                                        <table className="w-full text-sm">
                                                            <thead>
                                                                <tr className="bg-orange-600 text-white text-xs">
                                                                    {["System Info", "Monthly Bill", "Quoted Amount", "Govt. Subsidy", "Actual Investment", "Estimated ROI"].map(h => (
                                                                        <th key={h} className="px-3 py-2.5 text-left font-semibold whitespace-nowrap">{h}</th>
                                                                    ))}
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                <tr className="bg-slate-50 border-t border-slate-200">
                                                                    <td className="px-3 py-3 font-semibold text-slate-800 whitespace-nowrap">{systemInfo}</td>
                                                                    <td className="px-3 py-3 text-orange-700 font-bold">{monthlyBill > 0 ? `₹${fmt(monthlyBill)}/month` : "—"}</td>
                                                                    <td className="px-3 py-3 text-slate-700 font-semibold">{quotedAmount > 0 ? `₹${fmt(quotedAmount)}` : "—"}</td>
                                                                    <td className="px-3 py-3 text-emerald-700 font-bold">{govtSubsidy > 0 ? `₹${fmt(govtSubsidy)}` : "—"}</td>
                                                                    <td className="px-3 py-3 text-orange-700 font-bold">{actualInvest > 0 ? `₹${fmt(actualInvest)}` : "—"}</td>
                                                                    <td className="px-3 py-3 font-bold text-orange-700">{annualSavings > 0 && actualInvest > 0 ? `${pwY} Yr${pwY !== 1 ? "s" : ""} ${pwM} Mo` : "—"}</td>
                                                                </tr>
                                                            </tbody>
                                                        </table>
                                                    </div>

                                                    {monthlyBill > 0 && actualInvest > 0 && (
                                                        <div className="space-y-3">
                                                            {/* Professional Savings Text */}
                                                            <div className="bg-blue-50 border border-orange-100 rounded-xl p-4">
                                                                <p className="text-xs font-bold text-orange-800 mb-1.5">📊 Professional Savings Summary</p>
                                                                <p className="text-sm text-slate-700 leading-relaxed">
                                                                    After approximately <strong>{pwY} Year{pwY !== 1 ? "s" : ""} {pwM} Month{pwM !== 1 ? "s" : ""}</strong>, your solar system can recover its installation cost and start generating estimated savings of around <strong>₹{fmt(monthlyBill)} per month</strong> for the remaining lifespan of the system.
                                                                </p>
                                                                <p className="text-sm text-slate-700 leading-relaxed mt-2">
                                                                    Over 25 years, this may result in an estimated direct electricity bill saving of approximately <strong>{toLakhs(total25)}</strong>.*
                                                                </p>
                                                            </div>

                                                            {/* SIP Line */}
                                                            <div className="bg-purple-50 border border-purple-100 rounded-xl px-4 py-3">
                                                                <p className="text-xs font-bold text-purple-800 mb-1">📈 Investment Comparison</p>
                                                                <p className="text-sm text-slate-600 leading-relaxed italic">
                                                                    If the equivalent monthly savings are invested through SIPs with an assumed average annual return of 12%, the long-term value may become significantly higher over 25 years.*
                                                                </p>
                                                            </div>

                                                            {/* Disclaimer Footer */}
                                                            <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5">
                                                                <p className="text-[11px] text-slate-500 leading-relaxed">
                                                                    * Savings are estimated values based on current electricity tariffs, sunlight conditions, and system performance. Actual results may vary.
                                                                </p>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })()}


                                        {formTab === "scope" && (
                                            <div className="flex flex-col gap-5">
                                                <div>
                                                    <div className="flex justify-between items-center mb-2 border-b pb-2">
                                                        <h3 className="font-semibold text-slate-800">PDF Page 7 · {settings.companyName || "Company"} Scope of work:-</h3>
                                                        <button onClick={() => {
                                                            const current = formData.companyScope !== undefined ? formData.companyScope : [
                                                                "Prepare a full system design to include civil, structural, electrical, and mechanical components, with construction drawings and specifications.",
                                                                "Procure equipment and materials and deliver to site.",
                                                                "Perform complete system installation.",
                                                                "Test all electrical components in accordance with manufacturer instructions.",
                                                                "Commission the system to full operability.",
                                                            ];
                                                            setFormData({ ...formData, companyScope: [...current, ""] });
                                                        }} className="text-xs flex items-center gap-1 text-orange-600 bg-blue-50 px-2 py-1 rounded hover:bg-orange-100 font-semibold"><Plus size={12} /> Add</button>
                                                    </div>
                                                    <div className="grid grid-cols-1 gap-2 text-sm text-slate-600">
                                                        {(formData.companyScope !== undefined ? formData.companyScope : [
                                                            "Prepare a full system design to include civil, structural, electrical, and mechanical components, with construction drawings and specifications.",
                                                            "Procure equipment and materials and deliver to site.",
                                                            "Perform complete system installation.",
                                                            "Test all electrical components in accordance with manufacturer instructions.",
                                                            "Commission the system to full operability.",
                                                        ]).map((item, i) => (
                                                            <div key={i} className="flex gap-2">
                                                                <input type="text" value={item} onChange={e => {
                                                                    const current = formData.companyScope !== undefined ? formData.companyScope : [
                                                                        "Prepare a full system design to include civil, structural, electrical, and mechanical components, with construction drawings and specifications.",
                                                                        "Procure equipment and materials and deliver to site.",
                                                                        "Perform complete system installation.",
                                                                        "Test all electrical components in accordance with manufacturer instructions.",
                                                                        "Commission the system to full operability.",
                                                                    ];
                                                                    const newScope = [...current];
                                                                    newScope[i] = e.target.value;
                                                                    setFormData({ ...formData, companyScope: newScope });
                                                                }} className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 outline-none focus:border-orange-500" />
                                                                <button onClick={() => {
                                                                    const current = formData.companyScope !== undefined ? formData.companyScope : [
                                                                        "Prepare a full system design to include civil, structural, electrical, and mechanical components, with construction drawings and specifications.",
                                                                        "Procure equipment and materials and deliver to site.",
                                                                        "Perform complete system installation.",
                                                                        "Test all electrical components in accordance with manufacturer instructions.",
                                                                        "Commission the system to full operability.",
                                                                    ];
                                                                    const newScope = [...current];
                                                                    newScope.splice(i, 1);
                                                                    setFormData({ ...formData, companyScope: newScope });
                                                                }} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Minus size={18} /></button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div className="flex flex-col gap-3">
                                                    <h3 className="font-semibold text-slate-800 mb-1 border-b pb-2">Client scope:-</h3>
                                                    {clientScopeItems.length === 0 && (
                                                        <p className="text-sm text-slate-400 italic">No custom client scope points added. The PDF will use its default client scope list.</p>
                                                    )}
                                                    {formData.clientScope?.map((scope, i) => (
                                                        <div key={i} className="flex gap-2">
                                                            <input type="text" value={scope} onChange={(e) => updateArrayRow("clientScope", i, null, e.target.value)} className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-orange-500" />
                                                            <button onClick={() => removeArrayRow("clientScope", i)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Minus size={18} /></button>
                                                        </div>
                                                    ))}
                                                    <button onClick={() => addArrayRow("clientScope", "")} className="self-start flex items-center gap-1 text-sm text-orange-600 hover:text-orange-700 font-medium px-2 py-1 bg-blue-50 rounded-lg"><Plus size={16} /> Add Scope</button>
                                                </div>
                                            </div>
                                        )}

                                        {formTab === "terms" && (
                                            <div className="flex flex-col gap-4">
                                                <h3 className="font-semibold text-slate-800 mb-2 border-b pb-2">Payment Terms</h3>
                                                {formData.paymentTerms?.map((term, i) => (
                                                    <div key={i} className="flex gap-2">
                                                        <input type="text" value={term} onChange={(e) => updateArrayRow("paymentTerms", i, null, e.target.value)} className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-orange-500" />
                                                        <button onClick={() => removeArrayRow("paymentTerms", i)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Minus size={18} /></button>
                                                    </div>
                                                ))}
                                                <button onClick={() => addArrayRow("paymentTerms", "")} className="self-start flex items-center gap-1 text-sm text-orange-600 hover:text-orange-700 font-medium px-2 py-1 bg-blue-50 rounded-lg mb-4"><Plus size={16} /> Add Term</button>

                                                <div className="mt-2">
                                                    <label className="block text-xs font-semibold text-slate-800 mb-1">Delivery Info</label>
                                                    <textarea value={formData.delivery || ""} onChange={(e) => handleFormChange(e, "delivery")} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-orange-500 min-h-[80px]" />
                                                </div>

                                                <h3 className="font-semibold text-slate-800 mb-2 border-b pb-2 mt-4">Bank Details</h3>
                                                <div className="flex flex-col gap-3">
                                                    {(() => {
                                                        const banks = formData.bankAccounts !== undefined ? formData.bankAccounts : (settings.bankAccounts || [{
                                                            bankName: settings.bankName || "",
                                                            accountName: settings.accountName || "",
                                                            accountNumber: settings.accountNumber || "",
                                                            ifscCode: settings.ifscCode || "",
                                                            branch: settings.branch || "",
                                                        }]);
                                                        return (
                                                            <>
                                                                {banks.map((acc, i) => (
                                                                    <div key={i} className="grid grid-cols-2 gap-3 bg-white border border-slate-200 p-4 rounded-xl relative">
                                                                        <button onClick={() => {
                                                                            const newBanks = [...banks];
                                                                            newBanks.splice(i, 1);
                                                                            setFormData({ ...formData, bankAccounts: newBanks });
                                                                        }} className="absolute -top-2 -right-2 bg-red-100 text-red-600 rounded-full p-1 hover:bg-red-200 shadow-sm"><X size={14} /></button>

                                                                        <div><label className="text-[10px] text-slate-500 font-bold uppercase mb-1 block">Bank Name</label><input type="text" value={acc.bankName} onChange={e => { const nb = [...banks]; nb[i] = { ...nb[i], bankName: e.target.value }; setFormData({ ...formData, bankAccounts: nb }); }} className="w-full text-sm border border-slate-200 rounded px-2 py-1.5 outline-none" /></div>
                                                                        <div><label className="text-[10px] text-slate-500 font-bold uppercase mb-1 block">Account Name</label><input type="text" value={acc.accountName} onChange={e => { const nb = [...banks]; nb[i] = { ...nb[i], accountName: e.target.value }; setFormData({ ...formData, bankAccounts: nb }); }} className="w-full text-sm border border-slate-200 rounded px-2 py-1.5 outline-none" /></div>
                                                                        <div><label className="text-[10px] text-slate-500 font-bold uppercase mb-1 block">Account Number</label><input type="text" value={acc.accountNumber} onChange={e => { const nb = [...banks]; nb[i] = { ...nb[i], accountNumber: e.target.value }; setFormData({ ...formData, bankAccounts: nb }); }} className="w-full text-sm border border-slate-200 rounded px-2 py-1.5 outline-none" /></div>
                                                                        <div><label className="text-[10px] text-slate-500 font-bold uppercase mb-1 block">IFSC Code</label><input type="text" value={acc.ifscCode} onChange={e => { const nb = [...banks]; nb[i] = { ...nb[i], ifscCode: e.target.value }; setFormData({ ...formData, bankAccounts: nb }); }} className="w-full text-sm border border-slate-200 rounded px-2 py-1.5 outline-none" /></div>
                                                                        <div className="col-span-2"><label className="text-[10px] text-slate-500 font-bold uppercase mb-1 block">Branch</label><input type="text" value={acc.branch} onChange={e => { const nb = [...banks]; nb[i] = { ...nb[i], branch: e.target.value }; setFormData({ ...formData, bankAccounts: nb }); }} className="w-full text-sm border border-slate-200 rounded px-2 py-1.5 outline-none" /></div>
                                                                    </div>
                                                                ))}
                                                                <button onClick={() => {
                                                                    setFormData({ ...formData, bankAccounts: [...banks, { bankName: "", accountName: "", accountNumber: "", ifscCode: "", branch: "" }] });
                                                                }} className="self-start flex items-center gap-1 text-sm text-orange-600 hover:text-orange-700 font-medium px-3 py-1.5 bg-blue-50 rounded-lg"><Plus size={16} /> Add Bank Account</button>
                                                            </>
                                                        );
                                                    })()}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 min-h-0 p-4 relative">
                                <div className="w-full h-full rounded-xl overflow-hidden border border-slate-200 bg-white relative">
                                    {previewLoading ? (
                                        <div className="w-full h-full flex items-center justify-center text-slate-400">
                                            <Loader2 size={24} className="animate-spin" />
                                            <span className="ml-2">Generating PDF Preview...</span>
                                        </div>
                                    ) : previewError ? (
                                        <div className="w-full h-full flex items-center justify-center text-sm text-red-500">{previewError}</div>
                                    ) : previewUrl ? (
                                        <iframe title="Quotation preview" src={previewUrl} className="w-full h-full border-0" />
                                    ) : null}
                                </div>
                            </div>
                        )}
                    </section>
                </div>

                {/* ── Footer ── */}
                <div className="px-6 py-3.5 border-t border-slate-100 flex items-center justify-between gap-3 flex-wrap shrink-0 bg-white">
                    <button onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-200 text-slate-500 text-sm font-semibold cursor-pointer hover:bg-slate-50 bg-white transition-all">
                        Close
                    </button>
                    {activeTab === "form" ? (
                        <div className="flex items-center justify-end gap-3 flex-wrap">
                            <p className="text-xs text-slate-400 hidden sm:block">Fill in the form, then preview to generate</p>
                            <button onClick={() => setActiveTab("preview")} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-purple-600 text-white text-sm font-bold border-none cursor-pointer hover:-translate-y-0.5 hover:shadow-lg hover:shadow-orange-500/30 transition-all">
                                <Eye size={15} /> Review &amp; Generate
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center justify-end gap-2 flex-wrap">
                            <button onClick={() => setActiveTab("form")} className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 text-slate-500 text-sm font-semibold bg-white cursor-pointer hover:bg-slate-50 transition-all">
                                <Edit size={14} /> Edit
                            </button>
                            <button onClick={handleDownload} disabled={previewLoading || action !== null} className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-sm font-semibold bg-white cursor-pointer hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                                {action === "download" ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />} Download PDF
                            </button>
                            <button onClick={handleWhatsApp} disabled={previewLoading || action !== null} className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-500 text-white text-sm font-bold border-none cursor-pointer hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-emerald-500/20 hover:-translate-y-0.5 transition-all">
                                {action === "whatsapp" ? <Loader2 size={15} className="animate-spin" /> : <MessageCircle size={15} />} WhatsApp
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
