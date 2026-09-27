import { useState, useEffect } from "react";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase";
import { motion } from "framer-motion";
import { Loader2, Save, Trash2, Image as ImageIcon, Building, Phone, MapPin, FileText, Settings as SettingsIcon, Plus, CreditCard, ChevronDown, ChevronUp } from "lucide-react";
import toast from "react-hot-toast";

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

export default function Settings() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploadingImage, setUploadingImage] = useState(false);

    const [bankAccounts, setBankAccounts] = useState([]);
    const [expandedBank, setExpandedBank] = useState(0);

    const [formData, setFormData] = useState({
        companyName: "",
        companyAddress1: "",
        companyAddress2: "",
        gstin: "",
        udyam: "",
        websiteUrl: "",
        contact1Name: "",
        contact1Phone: "",
        contact2Name: "",
        contact2Phone: "",
        aboutText: "",
        logoImage: "",
        expertiseList: []
    });

    useEffect(() => {
        async function fetchSettings() {
            setLoading(true);
            try {
                const docRef = doc(db, "settings", "branding");
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    // Migrate old flat bank fields → array if no bankAccounts yet
                    if (Array.isArray(data.bankAccounts) && data.bankAccounts.length > 0) {
                        setBankAccounts(data.bankAccounts);
                    } else if (data.bankName || data.accountNumber) {
                        setBankAccounts([{
                            bankName: data.bankName || "",
                            accountName: data.accountName || "",
                            accountNumber: data.accountNumber || "",
                            ifscCode: data.ifscCode || "",
                            branch: data.branch || "",
                        }]);
                    }
                    // Strip old flat bank fields before loading into formData.
                    const rest = { ...data };
                    delete rest.bankName;
                    delete rest.accountName;
                    delete rest.accountNumber;
                    delete rest.ifscCode;
                    delete rest.branch;
                    delete rest.bankAccounts;
                    setFormData(prev => ({ ...prev, ...rest }));
                }
            } catch (error) {
                console.error("Failed to load settings:", error);
                toast.error("Failed to load global settings");
            } finally {
                setLoading(false);
            }
        }
        fetchSettings();
    }, []);

    const handleUpload = async (file) => {
        if (!file) return;
        setUploadingImage(true);
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
                setFormData(p => ({ ...p, logoImage: result.secure_url }));
                toast.success("Logo uploaded!");
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

    const addExpertise = () => {
        setFormData(p => ({ ...p, expertiseList: [...(p.expertiseList || []), ""] }));
    };

    const removeExpertise = (index) => {
        setFormData(p => ({ ...p, expertiseList: p.expertiseList.filter((_, i) => i !== index) }));
    };

    const updateExpertise = (index, value) => {
        const newArray = [...(formData.expertiseList || [])];
        newArray[index] = value;
        setFormData(p => ({ ...p, expertiseList: newArray }));
    };

    // ── Bank account helpers ───────────────────────────────────────
    const EMPTY_BANK = { bankName: "", accountName: "", accountNumber: "", ifscCode: "", branch: "" };

    function addBankAccount() {
        setBankAccounts(p => [...p, { ...EMPTY_BANK }]);
        setExpandedBank(bankAccounts.length); // expand the new card
    }

    function removeBankAccount(i) {
        setBankAccounts(p => p.filter((_, idx) => idx !== i));
        setExpandedBank(prev => (prev >= i ? Math.max(0, prev - 1) : prev));
    }

    function updateBankField(i, field, value) {
        setBankAccounts(p => p.map((acc, idx) => idx === i ? { ...acc, [field]: value } : acc));
    }
    // ──────────────────────────────────────────────────────────────

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await setDoc(doc(db, "settings", "branding"), {
                ...formData,
                bankAccounts,
                updatedAt: serverTimestamp()
            }, { merge: true });
            toast.success("Settings saved successfully!");
        } catch (error) {
            console.error("Failed to save settings:", error);
            toast.error("Failed to save settings");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full min-h-[400px]">
                <Loader2 size={32} className="animate-spin text-orange-500" />
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto pb-12">
            <div className="flex items-center gap-3 mb-8 border-b border-slate-200 pb-5">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-purple-500 flex items-center justify-center text-white shadow-lg shadow-orange-500/20">
                    <SettingsIcon size={24} />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Global Settings</h1>
                    <p className="text-sm text-slate-500 mt-1">Manage your company branding and PDF content</p>
                </div>
            </div>


            <motion.form initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} onSubmit={handleSave} className="space-y-8 bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">

                {/* Branding Section */}
                <div>
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-6">
                        <Building size={20} className="text-orange-500" /> Company Identity
                    </h2>

                    <div className="grid grid-cols-[240px_1fr] max-md:grid-cols-1 gap-8">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-3">Company Logo</label>
                            <div className="border-2 border-dashed border-slate-300 rounded-xl p-4 flex flex-col items-center justify-center text-center hover:bg-slate-50 transition-colors relative h-48 bg-slate-50/50">
                                {formData.logoImage ? (
                                    <img src={formData.logoImage} alt="Logo" className="max-h-full max-w-full object-contain" />
                                ) : (
                                    <>
                                        <ImageIcon size={40} className="text-slate-300 mb-3" />
                                        <span className="text-xs text-slate-500 font-medium">Click to upload logo</span>
                                    </>
                                )}
                                <input type="file" accept="image/*" onChange={(e) => handleUpload(e.target.files[0])} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                                {uploadingImage && <div className="absolute inset-0 bg-white/80 flex items-center justify-center rounded-xl"><Loader2 className="animate-spin text-orange-500" /></div>}
                            </div>
                        </div>

                        <div className="space-y-5">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Company Name</label>
                                <input type="text" placeholder="e.g. Zaref Solar" value={formData.companyName} onChange={e => setFormData(p => ({ ...p, companyName: e.target.value }))} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-amber-500 focus:bg-white transition-all" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Website URL <span className="text-xs font-normal text-slate-400">(shown in PDF footer)</span></label>
                                <input type="url" placeholder="e.g. https://www.vrsolartech.in/" value={formData.websiteUrl} onChange={e => setFormData(p => ({ ...p, websiteUrl: e.target.value }))} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-orange-500 focus:bg-white transition-all font-mono" />
                            </div>
                            <div className="grid grid-cols-2 gap-5">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">GSTIN</label>
                                    <input type="text" value={formData.gstin} onChange={e => setFormData(p => ({ ...p, gstin: e.target.value }))} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-orange-500 focus:bg-white transition-all" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">UDYAM</label>
                                    <input type="text" value={formData.udyam} onChange={e => setFormData(p => ({ ...p, udyam: e.target.value }))} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-orange-500 focus:bg-white transition-all" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <hr className="border-slate-100" />

                {/* Location Section */}
                <div>
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-6">
                        <MapPin size={20} className="text-emerald-500" /> Addresses & Locations
                    </h2>
                    <div className="grid grid-cols-2 max-md:grid-cols-1 gap-5">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Address Line 1</label>
                            <textarea rows={2} value={formData.companyAddress1} onChange={e => setFormData(p => ({ ...p, companyAddress1: e.target.value }))} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-orange-500 focus:bg-white transition-all resize-none" />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Address Line 2 (Optional)</label>
                            <textarea rows={2} value={formData.companyAddress2} onChange={e => setFormData(p => ({ ...p, companyAddress2: e.target.value }))} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-orange-500 focus:bg-white transition-all resize-none" />
                        </div>
                    </div>
                </div>

                <hr className="border-slate-100" />

                {/* Contacts Section */}
                <div>
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-6">
                        <Phone size={20} className="text-purple-500" /> Contact Persons
                    </h2>
                    <div className="grid grid-cols-2 max-md:grid-cols-1 gap-8">
                        <div className="space-y-5 p-5 bg-slate-50 rounded-xl border border-slate-100">
                            <h3 className="text-sm font-bold text-slate-800 border-b border-slate-200 pb-2">Primary Contact</h3>
                            <div><label className="block text-xs font-semibold text-slate-600 mb-1.5">Name</label><input type="text" value={formData.contact1Name} onChange={e => setFormData(p => ({ ...p, contact1Name: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" /></div>
                            <div><label className="block text-xs font-semibold text-slate-600 mb-1.5">Phone</label><input type="text" value={formData.contact1Phone} onChange={e => setFormData(p => ({ ...p, contact1Phone: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" /></div>
                        </div>
                        <div className="space-y-5 p-5 bg-slate-50 rounded-xl border border-slate-100">
                            <h3 className="text-sm font-bold text-slate-800 border-b border-slate-200 pb-2">Secondary Contact</h3>
                            <div><label className="block text-xs font-semibold text-slate-600 mb-1.5">Name</label><input type="text" value={formData.contact2Name} onChange={e => setFormData(p => ({ ...p, contact2Name: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" /></div>
                            <div><label className="block text-xs font-semibold text-slate-600 mb-1.5">Phone</label><input type="text" value={formData.contact2Phone} onChange={e => setFormData(p => ({ ...p, contact2Phone: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" /></div>
                        </div>
                    </div>
                </div>

                <hr className="border-slate-100" />

                {/* About Us Content */}
                <div>
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-6">
                        <FileText size={20} className="text-orange-500" /> Custom "About Us" PDF Content
                    </h2>
                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">About Us Paragraph</label>
                            <textarea rows={4} placeholder="We at Zaref Solar are energy consultants..." value={formData.aboutText} onChange={e => setFormData(p => ({ ...p, aboutText: e.target.value }))} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-amber-500 focus:bg-white transition-all resize-y" />
                            <p className="text-xs text-slate-500 mt-2">This text replaces the default 'About us' section printed on page 2 of your quotations.</p>
                        </div>

                        <div>
                            <div className="flex justify-between items-center mb-3">
                                <label className="block text-sm font-semibold text-slate-700">Our Areas of Expertise</label>
                                <button type="button" onClick={addExpertise} className="text-xs flex items-center gap-1 text-orange-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-orange-100 transition-colors font-semibold">
                                    + Add Point
                                </button>
                            </div>
                            <div className="space-y-2">
                                {(formData.expertiseList || []).map((item, i) => (
                                    <div key={i} className="flex gap-2">
                                        <input type="text" value={item} onChange={e => updateExpertise(i, e.target.value)} className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-orange-500 focus:bg-white transition-all" placeholder={`Expertise point ${i + 1}`} />
                                        <button type="button" onClick={() => removeExpertise(i)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 bg-white rounded-lg border border-slate-200 transition-colors"><Trash2 size={16} /></button>
                                    </div>
                                ))}
                                {(!formData.expertiseList || formData.expertiseList.length === 0) && (
                                    <p className="text-xs text-slate-400 italic">No expertise points added. Click "+ Add Point" to create a list.</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <hr className="border-slate-100" />

                {/* Bank Details Section — multi-account */}
                <div>
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                            <CreditCard size={20} className="text-amber-500" /> Bank Accounts
                        </h2>
                        <button
                            type="button"
                            onClick={addBankAccount}
                            className="flex items-center gap-1.5 text-sm font-semibold text-amber-600 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-4 py-2 rounded-xl transition-all cursor-pointer"
                        >
                            <Plus size={15} /> Add Account
                        </button>
                    </div>

                    {bankAccounts.length === 0 && (
                        <div className="text-center py-10 border-2 border-dashed border-slate-200 rounded-xl">
                            <CreditCard size={32} className="text-slate-300 mx-auto mb-2" />
                            <p className="text-sm text-slate-400 font-medium">No bank accounts added yet</p>
                            <p className="text-xs text-slate-300 mt-1">Click "+ Add Account" to add one</p>
                        </div>
                    )}

                    <div className="space-y-3">
                        {bankAccounts.map((acc, i) => (
                            <div key={i} className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                                {/* Accordion header */}
                                <button
                                    type="button"
                                    onClick={() => setExpandedBank(expandedBank === i ? -1 : i)}
                                    className="w-full flex items-center justify-between px-5 py-3.5 bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer border-none text-left"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                                            <CreditCard size={15} className="text-amber-600" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-slate-800">
                                                {acc.bankName || `Bank Account ${i + 1}`}
                                            </p>
                                            {acc.accountNumber && (
                                                <p className="text-xs text-slate-400 font-mono">
                                                    ••••&nbsp;{acc.accountNumber.slice(-4)}
                                                    {acc.ifscCode && <span className="ml-2 not-italic font-sans">{acc.ifscCode}</span>}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); removeBankAccount(i); }}
                                            className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                                            title="Remove account"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                        {expandedBank === i
                                            ? <ChevronUp size={16} className="text-slate-400" />
                                            : <ChevronDown size={16} className="text-slate-400" />}
                                    </div>
                                </button>

                                {/* Accordion body */}
                                {expandedBank === i && (
                                    <div className="px-5 py-5 grid grid-cols-2 max-md:grid-cols-1 gap-4 bg-white">
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Bank Name</label>
                                            <input
                                                type="text"
                                                placeholder="e.g. Canara Bank"
                                                value={acc.bankName}
                                                onChange={e => updateBankField(i, "bankName", e.target.value)}
                                                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-400/15 transition-all"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Account Holder Name</label>
                                            <input
                                                type="text"
                                                placeholder="e.g. Zaref Solar"
                                                value={acc.accountName}
                                                onChange={e => updateBankField(i, "accountName", e.target.value)}
                                                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-400/15 transition-all"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Account Number</label>
                                            <input
                                                type="text"
                                                placeholder="e.g. 120036111454"
                                                value={acc.accountNumber}
                                                onChange={e => updateBankField(i, "accountNumber", e.target.value)}
                                                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-400/15 transition-all font-mono"
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-xs font-semibold text-slate-600 mb-1.5">IFSC Code</label>
                                                <input
                                                    type="text"
                                                    placeholder="e.g. CNRB0008172"
                                                    value={acc.ifscCode}
                                                    onChange={e => updateBankField(i, "ifscCode", e.target.value)}
                                                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-400/15 transition-all font-mono"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Branch</label>
                                                <input
                                                    type="text"
                                                    placeholder="e.g. Karjat"
                                                    value={acc.branch}
                                                    onChange={e => updateBankField(i, "branch", e.target.value)}
                                                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-400/15 transition-all"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="pt-6 border-t border-slate-200 flex justify-end">
                    <button type="submit" disabled={saving} className="px-8 py-3 rounded-xl bg-orange-600 text-white font-bold text-sm hover:bg-orange-700 hover:-translate-y-0.5 shadow-lg shadow-orange-500/30 transition-all flex items-center gap-2 disabled:opacity-70 disabled:hover:translate-y-0">
                        {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                        {saving ? "Saving Changes..." : "Save Settings"}
                    </button>
                </div>
            </motion.form>
        </div>
    );
}
