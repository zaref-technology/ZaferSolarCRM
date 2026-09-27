import { useState, useEffect } from "react";
import { collection, query, orderBy, onSnapshot, serverTimestamp, runTransaction, doc } from "firebase/firestore";
import { db } from "../../firebase";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2 } from "lucide-react";
import toast from "react-hot-toast";

export default function PaymentModal({ isOpen, onClose, client, onPaymentAdded }) {
    const [payments, setPayments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [amount, setAmount] = useState("");
    const [notes, setNotes] = useState("");
    const [adding, setAdding] = useState(false);

    useEffect(() => {
        if (!isOpen || !client?.id) return;
        setLoading(true);
        const q = query(collection(db, "clients", client.id, "payments"), orderBy("date", "desc"));
        const unsub = onSnapshot(q, (snap) => {
            setPayments(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            setLoading(false);
        });
        return () => unsub();
    }, [isOpen, client?.id]);

    async function handleAddPayment(e) {
        e.preventDefault();
        const paymentAmount = Number(amount);
        const pendingAmount = (client?.projectPrice || 0) - (client?.advanceReceived || 0);

        if (!paymentAmount || isNaN(paymentAmount) || paymentAmount <= 0) {
            toast.error("Please enter a valid positive amount.");
            return;
        }
        if (paymentAmount > pendingAmount) {
            toast.error(`Payment cannot exceed the pending amount of ₹${pendingAmount.toLocaleString()}`);
            return;
        }

        setAdding(true);
        try {
            const clientRef = doc(db, "clients", client.id);
            await runTransaction(db, async (transaction) => {
                const clientDoc = await transaction.get(clientRef);
                if (!clientDoc.exists()) {
                    throw new Error("Client does not exist!");
                }

                const currentAdvance = clientDoc.data().advanceReceived || 0;
                const newTotal = currentAdvance + paymentAmount;
                const projectPrice = clientDoc.data().projectPrice || 0;

                if (newTotal > projectPrice) {
                    throw new Error(`Payment exceeds project price. Pending amount is ₹${(projectPrice - currentAdvance).toLocaleString()}`);
                }

                transaction.update(clientRef, {
                    advanceReceived: newTotal,
                    updatedAt: serverTimestamp()
                });

                const paymentRef = doc(collection(db, "clients", client.id, "payments"));
                transaction.set(paymentRef, {
                    amount: paymentAmount,
                    date: serverTimestamp(),
                    mode: "Manual",
                    notes: notes,
                    createdAt: serverTimestamp()
                });

                const activityRef = doc(collection(db, "client_activity"));
                const clientKey = clientDoc.data().phone || clientDoc.data().name;
                transaction.set(activityRef, {
                    clientKey,
                    message: `Payment received: ₹${paymentAmount.toLocaleString()} for project "${clientDoc.data().projectName}" ${notes ? `- ${notes}` : ""}`,
                    type: "payment",
                    timestamp: serverTimestamp()
                });
            });

            setAmount("");
            setNotes("");
            toast.success("Payment added successfully");
            if (onPaymentAdded) onPaymentAdded();
        } catch (error) {
            console.error("Failed to add payment:", error);
            toast.error("Failed to add payment.");
        } finally {
            setAdding(false);
        }
    }

    if (!isOpen || !client) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
                <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-xl bg-white sm:rounded-2xl rounded-t-2xl shadow-2xl overflow-hidden z-10 flex flex-col max-h-[95dvh] sm:max-h-[90vh]">
                    <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-emerald-50">
                        <div>
                            <h2 className="text-lg font-bold text-slate-800">Manage Payments</h2>
                            <p className="text-sm text-slate-600">{client.name} - {client.projectName}</p>
                        </div>
                        <button onClick={onClose} className="p-2 text-slate-400 hover:bg-emerald-100/50 rounded-xl"><X size={20} /></button>
                    </div>

                    <div className="p-6 overflow-y-auto space-y-6">
                        {/* Add Payment Form */}
                        <form onSubmit={handleAddPayment} className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                            <h3 className="font-semibold text-slate-800 mb-3 text-sm">Record New Payment</h3>
                            <div className="flex gap-3 max-sm:flex-col">
                                <div className="flex-1">
                                    <input type="number" required value={amount} onChange={e => setAmount(e.target.value)} placeholder="Amount (₹)" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-emerald-500 transition-all" />
                                </div>
                                <div className="flex-2">
                                    <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes (e.g. Bank Transfer, Cash)" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-emerald-500 transition-all" />
                                </div>
                                <button type="submit" disabled={adding} className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600 disabled:opacity-50 flex items-center justify-center gap-2">
                                    {adding ? <Loader2 size={16} className="animate-spin" /> : "Add"}
                                </button>
                            </div>
                        </form>

                        {/* Payment History */}
                        <div>
                            <h3 className="font-semibold text-slate-800 mb-3 text-sm">Payment History</h3>
                            {loading ? (
                                <div className="flex justify-center py-4"><Loader2 className="animate-spin text-emerald-500" /></div>
                            ) : payments.length === 0 ? (
                                <p className="text-sm text-slate-500 text-center py-4">No payments recorded yet.</p>
                            ) : (
                                <div className="space-y-2">
                                    {payments.map(p => (
                                        <div key={p.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-white">
                                            <div>
                                                <p className="font-medium text-slate-800 text-sm">₹{p.amount?.toLocaleString()}</p>
                                                <p className="text-xs text-slate-500 mt-0.5">{p.notes || p.mode}</p>
                                            </div>
                                            <span className="text-xs text-slate-400">
                                                {p.date?.toDate ? p.date.toDate().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : ""}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
