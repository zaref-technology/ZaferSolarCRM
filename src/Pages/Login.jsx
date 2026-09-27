import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../../firebase";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Eye, EyeOff, Lock, Mail, Loader2 } from "lucide-react";

export default function Login() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const navigate = useNavigate();

    async function handleSubmit(e) {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            await signInWithEmailAndPassword(auth, email, password);
            navigate("/");
        } catch (err) {
            const code = err.code;
            if (code === "auth/user-not-found") {
                setError("No account found with this email.");
            } else if (code === "auth/wrong-password" || code === "auth/invalid-credential") {
                setError("Invalid email or password.");
            } else if (code === "auth/too-many-requests") {
                setError("Too many attempts. Please try again later.");
            } else {
                setError("Login failed. Please try again.");
            }
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-100 relative overflow-hidden p-6">
            {/* Animated background blobs */}
            <div className="absolute w-96 h-96 bg-amber-400 rounded-full blur-[100px] opacity-30 -top-24 -left-24 animate-blob" />
            <div className="absolute w-80 h-80 bg-orange-400 rounded-full blur-[100px] opacity-30 -bottom-20 -right-20 animate-blob animate-blob-delay-2" />
            <div className="absolute w-64 h-64 bg-yellow-400 rounded-full blur-[100px] opacity-30 top-1/2 left-[60%] animate-blob animate-blob-delay-4" />

            <motion.div
                className="relative w-full max-w-md bg-white/85 backdrop-blur-2xl border border-slate-200 rounded-2xl p-10 shadow-lg"
                initial={{ opacity: 0, y: 40, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            >
                {/* Logo */}
                <div className="flex justify-center mb-6">
                    <img src="/logo.png" alt="Zaref Solar CRM Logo" className="w-16 h-16 rounded-2xl object-contain shadow-md" />
                </div>

                <h1 className="text-center text-2xl font-bold text-slate-800 mb-1">Welcome Back</h1>
                <p className="text-center text-sm text-slate-500 mb-7">Sign in to your CRM dashboard</p>

                {error && (
                    <motion.div
                        className="bg-red-50 border border-red-200 text-red-600 px-4 py-2.5 rounded-lg text-sm mb-5 text-center"
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                    >
                        {error}
                    </motion.div>
                )}

                <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                    {/* Email Field */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider" htmlFor="email">
                            Email Address
                        </label>
                        <div className="flex items-center gap-2.5 bg-white border border-slate-200 rounded-lg px-3.5 py-2.5 focus-within:border-amber-500 focus-within:ring-2 focus-within:ring-amber-500/15 transition-all">
                            <Mail className="text-slate-400 shrink-0" size={18} />
                            <input
                                id="email"
                                type="email"
                                placeholder="you@company.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="flex-1 border-none outline-none bg-transparent text-slate-800 text-sm"
                                required
                                autoComplete="email"
                            />
                        </div>
                    </div>

                    {/* Password Field */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider" htmlFor="password">
                            Password
                        </label>
                        <div className="flex items-center gap-2.5 bg-white border border-slate-200 rounded-lg px-3.5 py-2.5 focus-within:border-amber-500 focus-within:ring-2 focus-within:ring-amber-500/15 transition-all">
                            <Lock className="text-slate-400 shrink-0" size={18} />
                            <input
                                id="password"
                                type={showPassword ? "text" : "password"}
                                placeholder="Enter your password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="flex-1 border-none outline-none bg-transparent text-slate-800 text-sm"
                                required
                                autoComplete="current-password"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="text-slate-400 hover:text-slate-600 transition-colors bg-transparent border-none cursor-pointer"
                                tabIndex={-1}
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>

                    {/* Submit Button */}
                    <motion.button
                        type="submit"
                        className="w-full py-3 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold text-sm cursor-pointer shadow-md shadow-amber-500/20 disabled:opacity-70 disabled:cursor-not-allowed border-none"
                        disabled={loading}
                        whileHover={{ scale: loading ? 1 : 1.02 }}
                        whileTap={{ scale: loading ? 1 : 0.98 }}
                    >
                        {loading ? (
                            <span className="flex items-center justify-center gap-2">
                                <Loader2 className="animate-spin" size={20} />
                                Signing in...
                            </span>
                        ) : (
                            "Sign In"
                        )}
                    </motion.button>
                </form>

                <p className="text-center text-xs text-slate-400 mt-6">
                    Zaref Solar CRM &copy; {new Date().getFullYear()}
                </p>
            </motion.div>
        </div>
    );
}
