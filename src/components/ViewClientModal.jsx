import { useState, useEffect, useRef } from "react";
import { collection, query, onSnapshot, addDoc, serverTimestamp, where } from "firebase/firestore";
import { db } from "../../firebase";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, Send, Image as ImageIcon, IndianRupee, FileText, CheckCircle, Paperclip } from "lucide-react";

export default function ViewClientModal({ isOpen, onClose, client }) {
    const [activities, setActivities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [note, setNote] = useState("");
    const [adding, setAdding] = useState(false);

    const [attachmentFile, setAttachmentFile] = useState(null);
    const [filter, setFilter] = useState('all');
    const fileInputRef = useRef(null);

    useEffect(() => {
        if (!isOpen || !client) return;
        setLoading(true);
        const clientKey = client.phone || client.name;
        const q = query(collection(db, "client_activity"), where("clientKey", "==", clientKey));
        const unsub = onSnapshot(q, (snap) => {
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            data.sort((a, b) => {
                const timeA = a.timestamp?.toMillis ? a.timestamp.toMillis() : 0;
                const timeB = b.timestamp?.toMillis ? b.timestamp.toMillis() : 0;
                return timeB - timeA; // newest first
            });
            setActivities(data);
            setLoading(false);
        });
        return () => unsub();
    }, [isOpen, client]);

    async function handleAddNote(e) {
        e.preventDefault();
        if (!note.trim() && !attachmentFile) return;
        setAdding(true);
        try {
            let fileUrl = null;
            let fileType = null;
            if (attachmentFile) {
                const formData = new FormData();
                formData.append("file", attachmentFile);
                formData.append("upload_preset", import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET);

                const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/auto/upload`, {
                    method: "POST",
                    body: formData
                });

                if (!uploadRes.ok) throw new Error("Failed to upload file");
                const uploadData = await uploadRes.json();
                fileUrl = uploadData.secure_url;
                fileType = attachmentFile.type.startsWith('image/') ? 'image' : 'file';
            }

            const clientKey = client.phone || client.name;
            await addDoc(collection(db, "client_activity"), {
                clientKey,
                message: note || (fileUrl ? (fileType === 'image' ? "Shared an image" : "Shared a file") : ""),
                type: fileType || "note",
                imageUrl: fileUrl,
                timestamp: serverTimestamp()
            });
            setNote("");
            setAttachmentFile(null);
        } catch (error) {
            console.error("Failed to add note:", error);
        } finally {
            setAdding(false);
        }
    }

    if (!isOpen || !client) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
                <motion.div initial={{ opacity: 0, scale: 0.95, y: 30 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 30 }} className="relative w-full max-w-md max-h-[95dvh] sm:max-h-[90vh] bg-white sm:rounded-2xl rounded-t-2xl shadow-2xl overflow-hidden z-10 flex flex-col">
                    <div className="px-4 sm:px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-orange-50">
                        <div>
                            <h2 className="text-lg font-bold text-slate-800">Client Logs</h2>
                            <p className="text-sm text-slate-600 truncate">{client.name} {client.phone ? `(${client.phone})` : ""}</p>
                        </div>
                        <button onClick={onClose} className="p-2 text-slate-400 hover:bg-orange-100/50 rounded-xl"><X size={20} /></button>
                    </div>

                    <div className="bg-white border-b border-slate-100 p-2 flex items-center gap-2 overflow-x-auto">
                        {['all', 'photos', 'documents', 'payments'].map((f) => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`px-4 py-1.5 rounded-full text-xs font-medium capitalize whitespace-nowrap transition-colors ${filter === f
                                    ? "bg-slate-800 text-white"
                                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                    }`}
                            >
                                {f}
                            </button>
                        ))}
                    </div>

                    <div className="flex-1 overflow-y-auto p-5 bg-slate-50/50">
                        {loading ? (
                            <div className="flex justify-center py-10"><Loader2 className="animate-spin text-orange-500" /></div>
                        ) : activities.filter(act => {
                            if (filter === 'photos') return act.type === 'image' || (!!act.imageUrl && act.type !== 'file');
                            if (filter === 'documents') return act.type === 'file';
                            if (filter === 'payments') return act.type === 'payment';
                            return true;
                        }).length === 0 ? (
                            <p className="text-sm text-slate-400 text-center py-10">No logs found.</p>
                        ) : (
                            <div className="space-y-4">
                                {activities.filter(act => {
                                    if (filter === 'photos') return act.type === 'image' || (!!act.imageUrl && act.type !== 'file');
                                    if (filter === 'documents') return act.type === 'file';
                                    if (filter === 'payments') return act.type === 'payment';
                                    return true;
                                }).map(act => {
                                    const isPayment = act.type === "payment";
                                    const isStatus = act.type === "status_change";
                                    const isImage = act.type === "image" || (!!act.imageUrl && act.type !== 'file');
                                    const isFile = act.type === "file";

                                    return (
                                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} key={act.id} className={`p-4 rounded-2xl border shadow-sm ${isPayment ? "bg-emerald-50/50 border-emerald-100" :
                                            isStatus ? "bg-slate-50 border-slate-200 border-dashed" :
                                                "bg-white border-slate-100"
                                            }`}>
                                            <div className="flex items-start gap-3">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${isPayment ? "bg-emerald-100 text-emerald-600" :
                                                    isStatus ? "bg-slate-200 text-slate-500" :
                                                        "bg-orange-100 text-orange-500"
                                                    }`}>
                                                    {isPayment ? <IndianRupee size={14} /> :
                                                        isStatus ? <CheckCircle size={14} /> :
                                                            isImage ? <ImageIcon size={14} /> :
                                                                isFile ? <Paperclip size={14} /> :
                                                                    <FileText size={14} />}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className={`text-sm break-words ${isPayment ? "text-emerald-800 font-semibold" :
                                                        isStatus ? "text-slate-600 italic" :
                                                            "text-slate-700"
                                                        }`}>{act.message}</p>

                                                    {act.imageUrl && (
                                                        <div className="mt-3 rounded-xl overflow-hidden border border-slate-100 shadow-sm cursor-pointer hover:opacity-90 transition-opacity">
                                                            {isImage ? (
                                                                <img src={act.imageUrl} alt="Log attachment" className="w-full max-h-60 object-cover" onClick={() => window.open(act.imageUrl, '_blank')} />
                                                            ) : (
                                                                <div className="p-3 bg-slate-50 flex items-center gap-2" onClick={() => window.open(act.imageUrl, '_blank')}>
                                                                    <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center shrink-0">
                                                                        <FileText size={20} className="text-orange-500" />
                                                                    </div>
                                                                    <div className="flex-1 min-w-0">
                                                                        <span className="text-sm font-medium text-slate-700 block truncate">Document Attachment</span>
                                                                        <span className="text-xs text-orange-500 font-medium hover:underline">Click to view</span>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}

                                                    <p className="text-[10px] text-slate-400 mt-2 font-medium">
                                                        {act.timestamp?.toDate ? act.timestamp.toDate().toLocaleString('en-IN', {
                                                            day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                                                        }) : "Just now"}
                                                    </p>
                                                </div>
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <div className="p-4 bg-white border-t border-slate-100 flex flex-col gap-2">
                        {attachmentFile && (
                            <div className="flex items-center justify-between bg-slate-50 p-2 rounded-lg border border-slate-200">
                                <span className="text-xs text-slate-600 truncate">{attachmentFile.name}</span>
                                <button type="button" onClick={() => setAttachmentFile(null)} className="text-red-500 hover:bg-red-50 p-1 rounded"><X size={14} /></button>
                            </div>
                        )}
                        <form onSubmit={handleAddNote} className="flex items-center gap-2">
                            <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2.5 text-slate-400 hover:text-orange-500 hover:bg-blue-50 rounded-xl transition-colors border border-slate-200" title="Attach file">
                                <Paperclip size={18} />
                            </button>
                            <input type="file" accept="*/*" ref={fileInputRef} onChange={e => setAttachmentFile(e.target.files[0])} className="hidden" />
                            <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="Add a log note..." className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-orange-500 transition-all" />
                            <button type="submit" disabled={adding || (!note.trim() && !attachmentFile)} className="w-10 h-10 flex items-center justify-center bg-orange-500 text-white rounded-xl disabled:opacity-50 hover:bg-orange-600 transition-colors">
                                {adding ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                            </button>
                        </form>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
