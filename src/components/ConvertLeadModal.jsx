import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCircle, Loader2, IndianRupee, Briefcase, FileText } from "lucide-react";
import { collection, writeBatch, doc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase";
import toast from "react-hot-toast";

export default function ConvertLeadModal({ isOpen, onClose, lead, onConverted }) {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        projectName: "",
        projectPrice: "",
        advanceReceived: "",
        notes: ""
    });
    const [loading, setLoading] = useState(false);

    if (!isOpen || !lead) return null;

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
                leadId: lead.id,
                name: lead.name || "",
                phone: lead.phone || "",
                email: lead.email || "",
                company: lead.company || "",
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
                    notes: "Advance payment received upon conversion",
                    createdAt: serverTimestamp()
                });
            }

            const leadRef = doc(db, "leads", lead.id);
            batch.update(leadRef, {
                status: "Converted",
                clientId: clientRef.id,
                updatedAt: serverTimestamp()
            });

            const leadActivityRef = doc(collection(db, "leads", lead.id, "activity"));
            batch.set(leadActivityRef, {
                message: `Lead converted to Client. Project: ${formData.projectName}`,
                type: "status_change",
                timestamp: serverTimestamp()
            });

            const clientKey = lead.phone || lead.name;
            const clientActivityRef1 = doc(collection(db, "client_activity"));
            batch.set(clientActivityRef1, {
                clientKey,
                message: `Lead converted to Client. Initial Project: "${formData.projectName}"`,
                type: "status_change",
                timestamp: serverTimestamp()
            });

            if (advanceReceivedNum > 0) {
                const clientActivityRef2 = doc(collection(db, "client_activity"));
                batch.set(clientActivityRef2, {
                    clientKey,
                    message: `Payment received: ₹${advanceReceivedNum.toLocaleString()} for project "${formData.projectName}" - Advance payment upon conversion`,
                    type: "payment",
                    timestamp: serverTimestamp()
                });
            }

            await batch.commit();

            onConverted(); // Refresh parent
            onClose();
            toast.success("Lead successfully converted to Client");
            navigate("/clients");
        } catch (error) {
            console.error("Error converting lead:", error);
            toast.error("Failed to convert lead. Please try again.");
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
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="relative w-full max-w-lg bg-white sm:rounded-2xl rounded-t-2xl shadow-2xl overflow-hidden z-10 flex flex-col max-h-[95dvh] sm:max-h-[90vh]"
                >
                    {/* Header */}
                    <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-emerald-50">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                                <CheckCircle size={20} />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-slate-800">Convert to Client</h2>
                                <p className="text-sm text-slate-600">Enter project details for {lead.name}</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-emerald-100/50 rounded-xl transition-colors">
                            <X size={20} />
                        </button>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="p-6 overflow-y-auto">
                        <div className="space-y-4">
                            {/* Project Name */}
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Project Name / Scope</label>
                                <div className="relative">
                                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><Briefcase size={18} /></div>
                                    <input 
                                        type="text" 
                                        required
                                        value={formData.projectName}
                                        onChange={e => setFormData(p => ({...p, projectName: e.target.value}))}
                                        placeholder="e.g. 5KW On-Grid Solar Setup"
                                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-emerald-500 focus:bg-white transition-all"
                                    />
                                </div>
                            </div>

                            {/* Project Price */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Total Project Price</label>
                                    <div className="relative">
                                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><IndianRupee size={18} /></div>
                                        <input 
                                            type="number" 
                                            required
                                            value={formData.projectPrice}
                                            onChange={e => setFormData(p => ({...p, projectPrice: e.target.value}))}
                                            placeholder="0.00"
                                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-emerald-500 focus:bg-white transition-all"
                                        />
                                    </div>
                                </div>

                                {/* Advance Received */}
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Advance Received</label>
                                    <div className="relative">
                                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><IndianRupee size={18} /></div>
                                        <input 
                                            type="number" 
                                            value={formData.advanceReceived}
                                            onChange={e => setFormData(p => ({...p, advanceReceived: e.target.value}))}
                                            placeholder="0.00"
                                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-emerald-500 focus:bg-white transition-all"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Additional Notes */}
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Initial Notes</label>
                                <div className="relative">
                                    <div className="absolute left-3 top-3 text-slate-400"><FileText size={18} /></div>
                                    <textarea 
                                        rows={3}
                                        value={formData.notes}
                                        onChange={e => setFormData(p => ({...p, notes: e.target.value}))}
                                        placeholder="Any specific client requirements or details..."
                                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-emerald-500 focus:bg-white transition-all resize-none"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="mt-8 flex gap-3">
                            <button 
                                type="button" 
                                onClick={onClose}
                                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button 
                                type="submit" 
                                disabled={loading}
                                className="flex-2 px-4 py-2.5 rounded-xl bg-emerald-500 text-white font-semibold text-sm hover:bg-emerald-600 hover:-translate-y-0.5 shadow-lg shadow-emerald-500/30 transition-all disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:translate-y-0 flex items-center justify-center gap-2"
                            >
                                {loading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                                {loading ? "Converting..." : "Convert to Client"}
                            </button>
                        </div>
                    </form>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
