import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCircle, Loader2, IndianRupee, Briefcase, FileText, User, Phone, Mail, Building } from "lucide-react";
import { collection, writeBatch, doc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase";
import toast from "react-hot-toast";
// new 
export default function AddClientModal({ isOpen, onClose, onClientAdded, prefillData }) {
    const [formData, setFormData] = useState({
        name: "",
        phone: "",
        email: "",
        company: "",
        projectName: "",
        projectPrice: "",
        advanceReceived: "",
        notes: ""
    });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen && prefillData) {
            setFormData(prev => ({
                ...prev,
                name: prefillData.name || "",
                phone: prefillData.phone || "",
                email: prefillData.email || "",
                company: prefillData.company || "",
                projectName: "",
                projectPrice: "",
                advanceReceived: "",
                notes: ""
            }));
        } else if (isOpen && !prefillData) {
            setFormData({
                name: "", phone: "", email: "", company: "",
                projectName: "", projectPrice: "", advanceReceived: "", notes: ""
            });
        }
    }, [isOpen, prefillData]);

    if (!isOpen) return null;

    async function handleSubmit(e) {
        e.preventDefault();
        setLoading(true);

        const projectPriceNum = Number(formData.projectPrice) || 0;
        const advanceReceivedNum = Number(formData.advanceReceived) || 0;

        if (projectPriceNum < 0 || advanceReceivedNum < 0) {
            toast.error("Values cannot be negative.");
            setLoading(false);
            return;
        }
        if (advanceReceivedNum > projectPriceNum) {
            toast.error("Advance cannot be greater than the project price.");
            setLoading(false);
            return;
        }

        try {
            const batch = writeBatch(db);
            const clientRef = doc(collection(db, "clients"));

            const clientData = {
                name: formData.name,
                phone: formData.phone,
                email: formData.email,
                company: formData.company,
                projectName: formData.projectName,
                projectPrice: projectPriceNum,
                advanceReceived: advanceReceivedNum,
                notes: formData.notes,
                status: "In Progress",
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            };

            batch.set(clientRef, clientData);

            if (advanceReceivedNum > 0) {
                const paymentRef = doc(collection(db, "clients", clientRef.id, "payments"));
                batch.set(paymentRef, {
                    amount: advanceReceivedNum,
                    date: serverTimestamp(),
                    mode: "Advance",
                    notes: "Advance payment received upon creation",
                    createdAt: serverTimestamp()
                });
            }

            const clientKey = formData.phone || formData.name;
            const activityRef1 = doc(collection(db, "client_activity"));
            batch.set(activityRef1, {
                clientKey,
                message: `Client created manually. Project: "${formData.projectName}"`,
                type: "status_change",
                timestamp: serverTimestamp()
            });

            if (advanceReceivedNum > 0) {
                const activityRef2 = doc(collection(db, "client_activity"));
                batch.set(activityRef2, {
                    clientKey,
                    message: `Payment received: ₹${advanceReceivedNum.toLocaleString()} for project "${formData.projectName}" - Advance payment upon creation`,
                    type: "payment",
                    timestamp: serverTimestamp()
                });
            }

            await batch.commit();

            setFormData({
                name: "", phone: "", email: "", company: "",
                projectName: "", projectPrice: "", advanceReceived: "", notes: ""
            });

            onClientAdded(); // Refresh parent
            onClose();
            toast.success("Client added successfully");
        } catch (error) {
            console.error("Error creating client:", error);
            toast.error("Failed to add client. Please try again.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
                />

                <motion.div
                    initial={{ opacity: 0, scale: 0.97, y: 30 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.97, y: 30 }}
                    className="relative w-full max-w-2xl bg-white sm:rounded-2xl rounded-t-2xl shadow-2xl overflow-hidden z-10 flex flex-col max-h-[95dvh] sm:max-h-[90vh]"
                >
                    {/* Header */}
                    <div className="px-4 sm:px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-orange-50">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600">
                                <User size={20} />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-slate-800">Add New Client</h2>
                                <p className="text-sm text-slate-600">Manually add a client and their project</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-orange-100/50 rounded-xl transition-colors">
                            <X size={20} />
                        </button>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="p-6 overflow-y-auto">
                        <div className="space-y-6">

                            {/* Client Details Section */}
                            <div>
                                <h3 className="text-sm font-bold text-slate-800 mb-3 border-b pb-2">Client Details</h3>
                                <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">Full Name</label>
                                        <div className="relative">
                                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><User size={16} /></div>
                                            <input type="text" required readOnly={!!prefillData} value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} placeholder="John Doe" className={`w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-orange-500 focus:bg-white transition-all ${prefillData ? 'opacity-70 cursor-not-allowed' : ''}`} />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">Phone Number</label>
                                        <div className="relative">
                                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><Phone size={16} /></div>
                                            <input type="text" required readOnly={!!prefillData} value={formData.phone} onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))} placeholder="+91 9876543210" className={`w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-orange-500 focus:bg-white transition-all ${prefillData ? 'opacity-70 cursor-not-allowed' : ''}`} />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">Email Address</label>
                                        <div className="relative">
                                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><Mail size={16} /></div>
                                            <input type="email" readOnly={!!prefillData} value={formData.email} onChange={e => setFormData(p => ({ ...p, email: e.target.value }))} placeholder="john@example.com" className={`w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-orange-500 focus:bg-white transition-all ${prefillData ? 'opacity-70 cursor-not-allowed' : ''}`} />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">Company Name</label>
                                        <div className="relative">
                                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><Building size={16} /></div>
                                            <input type="text" readOnly={!!prefillData} value={formData.company} onChange={e => setFormData(p => ({ ...p, company: e.target.value }))} placeholder="Doe Industries" className={`w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-orange-500 focus:bg-white transition-all ${prefillData ? 'opacity-70 cursor-not-allowed' : ''}`} />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Project Details Section */}
                            <div>
                                <h3 className="text-sm font-bold text-slate-800 mb-3 border-b pb-2">Project Details</h3>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">Project Name / Scope</label>
                                        <div className="relative">
                                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><Briefcase size={16} /></div>
                                            <input type="text" required value={formData.projectName} onChange={e => setFormData(p => ({ ...p, projectName: e.target.value }))} placeholder="e.g. 5KW On-Grid Solar Setup" className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-orange-500 focus:bg-white transition-all" />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Total Project Price</label>
                                            <div className="relative">
                                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><IndianRupee size={16} /></div>
                                                <input type="number" required value={formData.projectPrice} onChange={e => setFormData(p => ({ ...p, projectPrice: e.target.value }))} placeholder="0.00" className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-orange-500 focus:bg-white transition-all" />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Advance Received</label>
                                            <div className="relative">
                                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><IndianRupee size={16} /></div>
                                                <input type="number" value={formData.advanceReceived} onChange={e => setFormData(p => ({ ...p, advanceReceived: e.target.value }))} placeholder="0.00" className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-orange-500 focus:bg-white transition-all" />
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">Initial Notes</label>
                                        <div className="relative">
                                            <div className="absolute left-3 top-3 text-slate-400"><FileText size={16} /></div>
                                            <textarea rows={2} value={formData.notes} onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))} placeholder="Any specific requirements or details..." className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-orange-500 focus:bg-white transition-all resize-none" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                        </div>

                        <div className="mt-8 flex gap-3">
                            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-50 transition-colors">
                                Cancel
                            </button>
                            <button type="submit" disabled={loading} className="flex-2 px-4 py-2.5 rounded-xl bg-orange-600 text-white font-semibold text-sm hover:bg-orange-700 hover:-translate-y-0.5 shadow-lg shadow-orange-500/30 transition-all disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:translate-y-0 flex items-center justify-center gap-2">
                                {loading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                                {loading ? "Adding..." : "Add Client"}
                            </button>
                        </div>
                    </form>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
