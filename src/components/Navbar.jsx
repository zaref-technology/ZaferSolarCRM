import { useAuth } from "../context/auth";
import { useNavigate } from "react-router-dom";
import { LogOut, Search, Menu, Users, Briefcase, Loader2, X, FileText, Command } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { collection, query, getDocs, limit, orderBy } from "firebase/firestore";
import { db } from "../../firebase";

export default function Navbar({ onMenuClick }) {
    const { currentUser, logout } = useAuth();
    const navigate = useNavigate();
    const [showDropdown, setShowDropdown] = useState(false);

    // Search State
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState({ leads: [], clients: [], templates: [] });
    const [isSearching, setIsSearching] = useState(false);
    const [showResults, setShowResults] = useState(false);
    const searchRef = useRef(null);

    useEffect(() => {
        function handleClickOutside(event) {
            if (searchRef.current && !searchRef.current.contains(event.target)) {
                setShowResults(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        const delayDebounceFn = setTimeout(async () => {
            if (!searchQuery.trim()) {
                setSearchResults({ leads: [], clients: [], templates: [] });
                setIsSearching(false);
                return;
            }

            setIsSearching(true);
            try {
                // To simulate a global search without external indexers (like Algolia), 
                // we'll fetch recently updated leads/clients and filter them in memory
                // or use a simple prefix query if we only care about exact starts.
                // We'll just fetch the top 50 active leads and clients to search against them for simplicity and cost.

                const leadsSnap = await getDocs(query(collection(db, "leads"), orderBy("createdAt", "desc"), limit(100)));
                const clientsSnap = await getDocs(query(collection(db, "clients"), orderBy("createdAt", "desc"), limit(100)));
                const templatesSnap = await getDocs(query(collection(db, "quotationTemplates"), orderBy("createdAt", "desc"), limit(100)));

                const queryLower = searchQuery.toLowerCase();

                const filteredLeads = leadsSnap.docs
                    .map(d => ({ id: d.id, ...d.data() }))
                    .filter(l => l.name?.toLowerCase().includes(queryLower) || l.phone?.includes(queryLower))
                    .slice(0, 4);

                const filteredClients = clientsSnap.docs
                    .map(d => ({ id: d.id, ...d.data() }))
                    .filter(c => c.name?.toLowerCase().includes(queryLower) || c.phone?.includes(queryLower) || c.projectName?.toLowerCase().includes(queryLower))
                    .slice(0, 4);

                const filteredTemplates = templatesSnap.docs
                    .map(d => ({ id: d.id, ...d.data() }))
                    .filter(t => t.name?.toLowerCase().includes(queryLower) || t.projectName?.toLowerCase().includes(queryLower) || t.badge?.toLowerCase().includes(queryLower))
                    .slice(0, 4);

                setSearchResults({ leads: filteredLeads, clients: filteredClients, templates: filteredTemplates });
                setShowResults(true);
            } catch (err) {
                console.error("Search failed:", err);
            } finally {
                setIsSearching(false);
            }
        }, 500); // 500ms debounce

        return () => clearTimeout(delayDebounceFn);
    }, [searchQuery]);

    async function handleLogout() {
        try {
            await logout();
            navigate("/login");
        } catch (err) {
            console.error("Logout failed:", err);
        }
    }

    const initials = currentUser?.email
        ? currentUser.email.charAt(0).toUpperCase()
        : "U";

    return (
        <header className="h-14 min-h-14 flex items-center justify-between px-3 sm:px-6 bg-white border-b border-slate-200 gap-3">
            {/* Left side */}
            <div className="flex items-center gap-2 sm:gap-4 flex-1">
                <button
                    onClick={onMenuClick}
                    className="p-2 -ml-1 text-slate-500 hover:bg-slate-100 rounded-xl transition-colors shrink-0"
                    aria-label="Open menu"
                >
                    <Menu size={22} />
                </button>

                <div ref={searchRef} className="relative flex items-center gap-2.5 bg-slate-100/70 hover:bg-slate-100 border border-transparent rounded-xl px-4 py-2 max-w-md w-full focus-within:bg-white focus-within:border-amber-500 focus-within:ring-4 focus-within:ring-amber-500/10 transition-all duration-200 max-md:hidden group">
                    <Search size={18} className="text-slate-400 group-focus-within:text-amber-500 shrink-0 transition-colors" />
                    <input
                        type="text"
                        placeholder="Search leads, clients, or templates..."
                        value={searchQuery}
                        onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setShowResults(true);
                        }}
                        onFocus={() => { if (searchQuery) setShowResults(true); }}
                        className="border-none outline-none bg-transparent text-slate-700 font-medium text-sm w-full placeholder:text-slate-400 placeholder:font-normal"
                    />
                    {isSearching ? (
                        <Loader2 size={16} className="animate-spin text-amber-500 shrink-0" />
                    ) : searchQuery ? (
                        <button onClick={() => { setSearchQuery(""); setShowResults(false); }} className="text-slate-400 hover:text-slate-600 bg-slate-200 hover:bg-slate-300 rounded-full p-0.5 transition-colors">
                            <X size={14} />
                        </button>
                    ) : (
                        <div className="flex items-center justify-center w-6 h-6 rounded bg-slate-200/60 text-slate-400 text-[10px] font-bold shrink-0">
                            <Command size={12} className="mr-0.5" />K
                        </div>
                    )}

                    {/* Search Dropdown */}
                    {showResults && searchQuery && (
                        <div className="absolute top-[calc(100%+8px)] left-0 w-full bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden z-50 max-h-[450px] overflow-y-auto ring-1 ring-black/5">
                            {searchResults.leads.length === 0 && searchResults.clients.length === 0 && searchResults.templates?.length === 0 && !isSearching ? (
                                <div className="p-8 flex flex-col items-center text-center">
                                    <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-3">
                                        <Search size={20} className="text-slate-300" />
                                    </div>
                                    <p className="text-sm font-semibold text-slate-700">No results found</p>
                                    <p className="text-xs text-slate-400 mt-1">We couldn't find anything matching "{searchQuery}"</p>
                                </div>
                            ) : (
                                <div className="p-2 space-y-1">
                                    {searchResults.leads.length > 0 && (
                                        <div>
                                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 px-2 mt-1">Leads</h4>
                                            {searchResults.leads.map(lead => (
                                                <div
                                                    key={lead.id}
                                                    onClick={() => { setShowResults(false); navigate(`/leads?lead=${lead.id}`); }}
                                                    className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-xl cursor-pointer transition-colors group/item"
                                                >
                                                    <div className="w-9 h-9 rounded-xl bg-blue-50 text-orange-600 flex items-center justify-center shrink-0 group-hover/item:bg-orange-100 transition-colors"><Users size={16} /></div>
                                                    <div className="overflow-hidden flex-1">
                                                        <p className="text-sm font-bold text-slate-800 truncate">{lead.name}</p>
                                                        <p className="text-[11px] text-slate-500 truncate font-medium mt-0.5">{lead.phone} <span className="mx-1 text-slate-300">•</span> <span className="text-orange-600">{lead.status}</span></p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {searchResults.clients.length > 0 && (
                                        <div>
                                            {searchResults.leads.length > 0 && <div className="h-px bg-slate-100 mx-2 my-2" />}
                                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 px-2 mt-1">Clients</h4>
                                            {searchResults.clients.map(client => (
                                                <div
                                                    key={client.id}
                                                    onClick={() => { setShowResults(false); navigate(`/clients?client=${client.id}`); }}
                                                    className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-xl cursor-pointer transition-colors group/item"
                                                >
                                                    <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 group-hover/item:bg-purple-100 transition-colors"><Briefcase size={16} /></div>
                                                    <div className="overflow-hidden flex-1">
                                                        <p className="text-sm font-bold text-slate-800 truncate">{client.name}</p>
                                                        <p className="text-[11px] text-slate-500 truncate font-medium mt-0.5">{client.phone} <span className="mx-1 text-slate-300">•</span> {client.projectName}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {searchResults.templates?.length > 0 && (
                                        <div>
                                            {(searchResults.leads.length > 0 || searchResults.clients.length > 0) && <div className="h-px bg-slate-100 mx-2 my-2" />}
                                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 px-2 mt-1">Quotation Templates</h4>
                                            {searchResults.templates.map(template => (
                                                <div
                                                    key={template.id}
                                                    onClick={() => { setShowResults(false); navigate(`/templates`); }}
                                                    className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-xl cursor-pointer transition-colors group/item"
                                                >
                                                    <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 group-hover/item:bg-emerald-100 transition-colors"><FileText size={16} /></div>
                                                    <div className="overflow-hidden flex-1">
                                                        <p className="text-sm font-bold text-slate-800 truncate">{template.name}</p>
                                                        <p className="text-[11px] text-slate-500 truncate font-medium mt-0.5">{template.badge || "Template"} <span className="mx-1 text-slate-300">•</span> {template.projectName || "General"}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Right side */}
            <div className="flex items-center gap-3">

                <div className="relative">
                    <button
                        className="w-[38px] h-[38px] rounded-full bg-gradient-to-br from-amber-500 to-orange-500 text-white font-bold text-sm flex items-center justify-center border-2 border-slate-200 cursor-pointer hover:border-amber-500 hover:ring-2 hover:ring-amber-500/15 transition-all"
                        onClick={() => setShowDropdown(!showDropdown)}
                    >
                        {initials}
                    </button>

                    {showDropdown && (
                        <div className="absolute top-[calc(100%+8px)] right-0 w-56 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden z-50 animate-dropdown">
                            <div className="px-4 py-3 border-b border-slate-200">
                                <p className="text-xs text-slate-500 truncate">{currentUser?.email}</p>
                            </div>
                            <button
                                className="flex items-center gap-2.5 w-full px-4 py-2.5 border-none bg-transparent text-slate-500 text-sm cursor-pointer hover:bg-slate-50 hover:text-red-500 transition-all"
                                onClick={handleLogout}
                            >
                                <LogOut size={16} />
                                <span>Sign Out</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}
