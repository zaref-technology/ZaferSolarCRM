import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
    Briefcase,
    CalendarDays,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    ClipboardList,
    Clock3,
    Loader2,
    Plus,
    Search,
    Trash2,
    UserRound,
    XCircle,
} from "lucide-react";
import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDocs,
    serverTimestamp,
    updateDoc,
} from "firebase/firestore";
import toast from "react-hot-toast";
import { db } from "../../firebase";
import { useAuth } from "../context/auth";

const taskTypes = [
    { key: "plain", label: "Plain Text", icon: ClipboardList },
    { key: "lead", label: "Lead", icon: UserRound },
    { key: "client", label: "Client", icon: Briefcase },
];

const statuses = [
    { key: "Pending", label: "Pending", icon: Clock3, badge: "bg-amber-100 text-amber-700", select: "bg-amber-50 text-amber-700 border-amber-200" },
    { key: "In Progress", label: "In Progress", icon: ClipboardList, badge: "bg-orange-100 text-orange-700", select: "bg-blue-50 text-orange-700 border-orange-200" },
    { key: "Completed", label: "Completed", icon: CheckCircle2, badge: "bg-emerald-100 text-emerald-700", select: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    { key: "Cancelled", label: "Cancelled", icon: XCircle, badge: "bg-slate-100 text-slate-600", select: "bg-slate-50 text-slate-600 border-slate-200" },
];

const unfinishedStatuses = new Set(["Pending", "In Progress"]);

const emptyForm = {
    text: "",
    type: "plain",
    relationId: "",
};

function pad(value) {
    return String(value).padStart(2, "0");
}

function toDateKey(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function fromDateKey(key) {
    const [year, month, day] = key.split("-").map(Number);
    return new Date(year, month - 1, day);
}

function shiftDate(date, days) {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
}

function formatDisplayDate(date) {
    return date.toLocaleDateString("en-IN", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
    });
}

function formatDateKey(dateKey) {
    if (!dateKey) return "";
    const date = fromDateKey(dateKey);
    if (Number.isNaN(date.getTime())) return "";
    return formatDisplayDate(date);
}

function getCreatedMillis(value) {
    if (!value) return 0;
    if (value.toDate) return value.toDate().getTime();
    if (value.seconds) return value.seconds * 1000;
    return new Date(value).getTime() || 0;
}

function normalizeLead(docSnap) {
    const data = docSnap.data();
    return {
        id: docSnap.id,
        type: "lead",
        name: data.name || "Unnamed lead",
        phone: data.phone || "",
        meta: data.company || data.status || "Lead",
    };
}

function normalizeClient(docSnap) {
    const data = docSnap.data();
    return {
        id: docSnap.id,
        type: "client",
        name: data.name || "Unnamed client",
        phone: data.phone || "",
        meta: data.projectName || data.company || "Client",
    };
}

function relationMatches(item, search) {
    const needle = search.trim().toLowerCase();
    if (!needle) return true;
    return [item.name, item.phone, item.meta].some((value) => value?.toLowerCase().includes(needle));
}

function StatusPill({ status }) {
    const config = statuses.find((item) => item.key === status) || statuses[0];
    const Icon = config.icon;
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${config.badge}`}>
            <Icon size={13} />
            {config.label}
        </span>
    );
}

export default function TodayTask() {
    const { currentUser } = useAuth();
    const [selectedDate, setSelectedDate] = useState(() => new Date());
    const selectedDateKey = useMemo(() => toDateKey(selectedDate), [selectedDate]);
    const [tasks, setTasks] = useState([]);
    const [loadingTasks, setLoadingTasks] = useState(true);
    const [savingTask, setSavingTask] = useState(false);
    const [statusUpdating, setStatusUpdating] = useState(null);
    const [deletingTask, setDeletingTask] = useState(null);
    const [form, setForm] = useState(emptyForm);
    const [relationSearch, setRelationSearch] = useState("");
    const [leads, setLeads] = useState([]);
    const [clients, setClients] = useState([]);
    const [loadingRelations, setLoadingRelations] = useState(true);

    const selectedType = taskTypes.find((type) => type.key === form.type) || taskTypes[0];
    const relationOptions = form.type === "lead" ? leads : form.type === "client" ? clients : [];
    const selectedRelation = relationOptions.find((item) => item.id === form.relationId);
    const filteredRelations = relationOptions
        .filter((item) => relationMatches(item, relationSearch))
        .slice(0, 8);
    const todayKey = toDateKey(new Date());
    const isToday = selectedDateKey === todayKey;

    const completedCount = tasks.filter((task) => task.status === "Completed").length;
    const pendingCount = tasks.filter((task) => task.status !== "Completed" && task.status !== "Cancelled").length;
    const overdueCount = tasks.filter((task) => task.isPastPending).length;
    const selectedDateTaskCount = tasks.length - overdueCount;
    const taskSummary = isToday && overdueCount > 0
        ? `${selectedDateTaskCount} task${selectedDateTaskCount === 1 ? "" : "s"} today + ${overdueCount} past pending`
        : `${tasks.length} task${tasks.length === 1 ? "" : "s"} on ${formatDisplayDate(selectedDate)}`;

    const fetchTasks = useCallback(async () => {
        setLoadingTasks(true);
        try {
            const snap = await getDocs(collection(db, "todayTasks"));
            const data = snap.docs
                .map((taskDoc) => ({ id: taskDoc.id, ...taskDoc.data() }))
                .filter((task) => {
                    if (task.taskDate === selectedDateKey) return true;
                    return isToday && task.taskDate < todayKey && unfinishedStatuses.has(task.status || "Pending");
                })
                .map((task) => ({
                    ...task,
                    isPastPending: isToday && task.taskDate < todayKey && unfinishedStatuses.has(task.status || "Pending"),
                }))
                .sort((a, b) => {
                    if (a.isPastPending !== b.isPastPending) return a.isPastPending ? -1 : 1;
                    if (a.isPastPending && b.isPastPending) return (a.taskDate || "").localeCompare(b.taskDate || "");
                    return getCreatedMillis(b.createdAt) - getCreatedMillis(a.createdAt);
                });
            setTasks(data);
        } catch (error) {
            console.error("Failed to fetch today tasks:", error);
            toast.error("Failed to load tasks");
        } finally {
            setLoadingTasks(false);
        }
    }, [isToday, selectedDateKey, todayKey]);

    useEffect(() => {
        fetchTasks();
    }, [fetchTasks]);

    useEffect(() => {
        let ignore = false;

        async function fetchRelations() {
            setLoadingRelations(true);
            try {
                const [leadSnap, clientSnap] = await Promise.all([
                    getDocs(collection(db, "leads")),
                    getDocs(collection(db, "clients")),
                ]);

                if (ignore) return;

                const leadData = leadSnap.docs.map(normalizeLead).sort((a, b) => a.name.localeCompare(b.name));
                const clientData = clientSnap.docs.map(normalizeClient).sort((a, b) => a.name.localeCompare(b.name));
                setLeads(leadData);
                setClients(clientData);
            } catch (error) {
                console.error("Failed to fetch leads and clients:", error);
                toast.error("Failed to load leads and clients");
            } finally {
                if (!ignore) setLoadingRelations(false);
            }
        }

        fetchRelations();

        return () => {
            ignore = true;
        };
    }, []);

    function handleTypeChange(type) {
        setForm((prev) => ({ ...prev, type, relationId: "" }));
        setRelationSearch("");
    }

    function moveDay(days) {
        setSelectedDate((date) => shiftDate(date, days));
    }

    function resetToday() {
        setSelectedDate(new Date());
    }

    function handleDateChange(dateKey) {
        if (!dateKey) return;
        const nextDate = fromDateKey(dateKey);
        if (!Number.isNaN(nextDate.getTime())) {
            setSelectedDate(nextDate);
        }
    }

    async function handleAddTask(event) {
        event.preventDefault();

        const text = form.text.trim();
        if (!text) {
            toast.error("Task text is required");
            return;
        }

        if (form.type !== "plain" && !selectedRelation) {
            toast.error(`Select a ${form.type} for this task`);
            return;
        }

        setSavingTask(true);
        try {
            const taskDate = selectedDateKey;
            await addDoc(collection(db, "todayTasks"), {
                text,
                type: form.type,
                taskDate,
                status: "Pending",
                relation: selectedRelation
                    ? {
                        id: selectedRelation.id,
                        type: selectedRelation.type,
                        name: selectedRelation.name,
                        phone: selectedRelation.phone,
                        meta: selectedRelation.meta,
                    }
                    : null,
                createdBy: currentUser?.email || "",
                createdByUid: currentUser?.uid || "",
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });

            setForm(emptyForm);
            setRelationSearch("");
            toast.success(`Task added for ${formatDisplayDate(fromDateKey(taskDate))}`);
            await fetchTasks();
        } catch (error) {
            console.error("Failed to add task:", error);
            toast.error("Failed to add task");
        } finally {
            setSavingTask(false);
        }
    }

    async function handleStatusChange(task, nextStatus) {
        if (task.status === nextStatus) return;

        const previousTasks = tasks;
        setStatusUpdating(task.id);
        setTasks((prev) => prev
            .map((item) => item.id === task.id ? { ...item, status: nextStatus } : item)
            .filter((item) => !item.isPastPending || unfinishedStatuses.has(item.status || "Pending")));

        try {
            await updateDoc(doc(db, "todayTasks", task.id), {
                status: nextStatus,
                updatedAt: serverTimestamp(),
            });
        } catch (error) {
            console.error("Failed to update task status:", error);
            setTasks(previousTasks);
            toast.error("Failed to update status");
        } finally {
            setStatusUpdating(null);
        }
    }

    async function handleDeleteTask(taskId) {
        if (!confirm("Delete this task?")) return;

        setDeletingTask(taskId);
        try {
            await deleteDoc(doc(db, "todayTasks", taskId));
            setTasks((prev) => prev.filter((task) => task.id !== taskId));
            toast.success("Task deleted");
        } catch (error) {
            console.error("Failed to delete task:", error);
            toast.error("Failed to delete task");
        } finally {
            setDeletingTask(null);
        }
    }

    function renderRelationPicker() {
        if (form.type === "plain") return null;

        const RelationIcon = form.type === "lead" ? UserRound : Briefcase;

        return (
            <div className="space-y-3">
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus-within:border-orange-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-orange-500/15 transition-all">
                    <Search size={16} className="text-slate-400" />
                    <input
                        type="text"
                        value={relationSearch}
                        onChange={(event) => setRelationSearch(event.target.value)}
                        placeholder={`Search ${form.type}`}
                        className="w-full border-none outline-none bg-transparent text-sm text-slate-700 placeholder:text-slate-400"
                    />
                    {loadingRelations && <Loader2 size={16} className="animate-spin text-orange-500" />}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
                    {filteredRelations.length === 0 ? (
                        <div className="sm:col-span-2 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-center text-sm font-medium text-slate-400">
                            No {form.type} found
                        </div>
                    ) : filteredRelations.map((item) => (
                        <button
                            type="button"
                            key={item.id}
                            onClick={() => setForm((prev) => ({ ...prev, relationId: item.id }))}
                            className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left cursor-pointer transition-all ${form.relationId === item.id
                                ? "border-orange-300 bg-blue-50 ring-2 ring-orange-500/10"
                                : "border-slate-200 bg-white hover:border-orange-200 hover:bg-slate-50"
                                }`}
                        >
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                                <RelationIcon size={16} />
                            </span>
                            <span className="min-w-0">
                                <span className="block truncate text-sm font-bold text-slate-800">{item.name}</span>
                                <span className="block truncate text-xs font-medium text-slate-500">
                                    {item.phone || "No phone"} - {item.meta}
                                </span>
                            </span>
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto pb-8">
            <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Today Task</h1>
                    <p className="text-sm text-slate-500 mt-1">{taskSummary}</p>
                </div>

                <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl p-1 shadow-sm flex-wrap">
                    <button
                        type="button"
                        onClick={() => moveDay(-1)}
                        className="h-9 w-9 flex items-center justify-center rounded-lg border-none bg-transparent text-slate-500 cursor-pointer hover:bg-slate-100 hover:text-slate-800 transition-all"
                        aria-label="Previous day"
                    >
                        <ChevronLeft size={18} />
                    </button>
                    <button
                        type="button"
                        onClick={resetToday}
                        className={`h-9 px-4 rounded-lg border-none text-sm font-bold cursor-pointer transition-all ${isToday ? "bg-orange-500 text-white shadow-sm shadow-orange-500/20" : "bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-orange-600"
                            }`}
                    >
                        Today
                    </button>
                    <button
                        type="button"
                        onClick={() => moveDay(1)}
                        className="h-9 w-9 flex items-center justify-center rounded-lg border-none bg-transparent text-slate-500 cursor-pointer hover:bg-slate-100 hover:text-slate-800 transition-all"
                        aria-label="Next day"
                    >
                        <ChevronRight size={18} />
                    </button>
                    <div className="h-8 w-px bg-slate-200 max-sm:hidden" />
                    <label className="flex h-9 items-center gap-2 rounded-lg bg-slate-50 px-3 text-slate-500">
                        <CalendarDays size={16} />
                        <input
                            type="date"
                            value={selectedDateKey}
                            onChange={(event) => handleDateChange(event.target.value)}
                            className="border-none bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer"
                            aria-label="Select date"
                        />
                    </label>
                </div>
            </div>

            <div className="grid grid-cols-[360px_1fr] max-lg:grid-cols-1 gap-5">
                <motion.form
                    initial={{ opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    onSubmit={handleAddTask}
                    className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 h-fit"
                >
                    <div className="flex items-center gap-3 mb-5">
                        <div className="w-11 h-11 rounded-xl bg-blue-50 text-orange-600 flex items-center justify-center">
                            <Plus size={21} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-800">Add Task</h2>
                            <p className="text-xs font-medium text-slate-500">{formatDisplayDate(selectedDate)}</p>
                        </div>
                    </div>

                    <div className="space-y-5">
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Task Date</label>
                            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus-within:border-orange-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-orange-500/15 transition-all">
                                <CalendarDays size={16} className="text-slate-400" />
                                <input
                                    type="date"
                                    value={selectedDateKey}
                                    onChange={(event) => handleDateChange(event.target.value)}
                                    className="w-full border-none outline-none bg-transparent text-sm font-bold text-slate-700 cursor-pointer"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Task Type</label>
                            <div className="grid grid-cols-3 gap-2">
                                {taskTypes.map((type) => {
                                    const Icon = type.icon;
                                    return (
                                        <button
                                            type="button"
                                            key={type.key}
                                            onClick={() => handleTypeChange(type.key)}
                                            className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border px-2 py-3 text-xs font-bold cursor-pointer transition-all ${form.type === type.key
                                                ? "border-orange-300 bg-blue-50 text-orange-600 ring-2 ring-orange-500/10"
                                                : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                                                }`}
                                        >
                                            <Icon size={18} />
                                            <span>{type.label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Task Text</label>
                            <textarea
                                value={form.text}
                                onChange={(event) => setForm((prev) => ({ ...prev, text: event.target.value }))}
                                rows={4}
                                placeholder={form.type === "plain" ? "Add follow-up task..." : `Task note for selected ${selectedType.label.toLowerCase()}...`}
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 outline-none focus:border-orange-500 focus:bg-white focus:ring-2 focus:ring-orange-500/15 transition-all resize-none"
                            />
                        </div>

                        {renderRelationPicker()}

                        <button
                            type="submit"
                            disabled={savingTask}
                            className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-purple-500 text-white text-sm font-bold border-none cursor-pointer shadow-md shadow-orange-500/20 hover:-translate-y-0.5 transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                        >
                            {savingTask ? <Loader2 size={17} className="animate-spin" /> : <Plus size={17} />}
                            {savingTask ? "Adding..." : "Add Task"}
                        </button>
                    </div>
                </motion.form>

                <motion.div
                    initial={{ opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden"
                >
                    <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-slate-100 bg-slate-50/70 flex-wrap">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 text-orange-600 flex items-center justify-center">
                                <CalendarDays size={19} />
                            </div>
                            <div>
                                <h2 className="text-base font-bold text-slate-800">{isToday ? "Today" : formatDisplayDate(selectedDate)}</h2>
                                <p className="text-xs font-medium text-slate-500">
                                    {pendingCount} pending - {completedCount} completed{overdueCount > 0 ? ` - ${overdueCount} past pending` : ""}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {statuses.map((status) => (
                                <span key={status.key} className={`hidden sm:inline-flex px-2.5 py-1 rounded-full text-[11px] font-bold ${status.badge}`}>
                                    {tasks.filter((task) => task.status === status.key).length} {status.label}
                                </span>
                            ))}
                        </div>
                    </div>

                    {loadingTasks ? (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 size={28} className="animate-spin text-orange-500" />
                        </div>
                    ) : tasks.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 px-5 text-center">
                            <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-300 flex items-center justify-center mb-3">
                                <ClipboardList size={25} />
                            </div>
                            <p className="text-base font-bold text-slate-700">No tasks for this date</p>
                            <p className="text-sm text-slate-400 mt-1">{isToday ? "No today or past pending tasks." : "Add a task from the left panel."}</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {tasks.map((task) => {
                                const currentStatus = statuses.find((status) => status.key === task.status) || statuses[0];
                                const RelationIcon = task.relation?.type === "lead" ? UserRound : Briefcase;
                                const relationUrl = task.relation?.type === "lead"
                                    ? `/leads?lead=${task.relation.id}`
                                    : task.relation?.type === "client"
                                        ? `/clients?client=${task.relation.id}`
                                        : null;

                                return (
                                    <div key={task.id} className="p-5 hover:bg-slate-50/70 transition-colors">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2 mb-2 flex-wrap">
                                                    {task.isPastPending && (
                                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-50 text-red-600 text-xs font-bold">
                                                            <Clock3 size={13} />
                                                            Past pending - {formatDateKey(task.taskDate)}
                                                        </span>
                                                    )}
                                                    <StatusPill status={task.status} />
                                                    {task.relation ? (
                                                        <Link
                                                            to={relationUrl}
                                                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-bold no-underline hover:bg-blue-50 hover:text-orange-600 transition-colors"
                                                        >
                                                            <RelationIcon size={13} />
                                                            {task.relation.name}
                                                        </Link>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 text-xs font-bold">
                                                            <ClipboardList size={13} />
                                                            Plain text
                                                        </span>
                                                    )}
                                                </div>

                                                <p className="text-sm font-semibold text-slate-800 leading-6 whitespace-pre-wrap break-words">{task.text}</p>

                                                {task.relation && (
                                                    <p className="text-xs font-medium text-slate-400 mt-2">
                                                        {task.relation.phone || "No phone"} - {task.relation.meta || task.relation.type}
                                                    </p>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-2 shrink-0">
                                                <select
                                                    value={task.status || "Pending"}
                                                    onChange={(event) => handleStatusChange(task, event.target.value)}
                                                    disabled={statusUpdating === task.id}
                                                    className={`min-w-32 px-3 py-2 rounded-lg border text-xs font-bold outline-none cursor-pointer disabled:opacity-60 ${currentStatus.select}`}
                                                >
                                                    {statuses.map((status) => (
                                                        <option key={status.key} value={status.key} className="bg-white text-slate-800">{status.label}</option>
                                                    ))}
                                                </select>

                                                <button
                                                    type="button"
                                                    onClick={() => handleDeleteTask(task.id)}
                                                    disabled={deletingTask === task.id}
                                                    className="h-9 w-9 flex items-center justify-center rounded-lg border-none bg-transparent text-slate-400 cursor-pointer hover:bg-red-50 hover:text-red-500 transition-all disabled:opacity-60"
                                                    title="Delete task"
                                                >
                                                    {deletingTask === task.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </motion.div>
            </div>
        </div>
    );
}
