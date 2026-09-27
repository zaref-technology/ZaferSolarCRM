import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";
import { Toaster } from "react-hot-toast";
import Login from "./Pages/Login";
import DashboardHome from "./Pages/Home";
import Leads from "./Pages/Leads";
import Clients from "./Pages/Clients";
import QuotationTemplates from "./Pages/QuotationTemplates";
import Settings from "./Pages/Settings";
import TodayTask from "./Pages/TodayTask";
import WhatsAppTemplates from "./Pages/WhatsAppTemplates";

function App() {
    return (
        <AuthProvider>
            <BrowserRouter>
                <Toaster position="top-right" />
                <Routes>
                    {/* Public route */}
                    <Route path="/login" element={<Login />} />

                    {/* Protected routes with layout */}
                    <Route
                        element={
                            <ProtectedRoute>
                                <Layout />
                            </ProtectedRoute>
                        }
                    >
                        <Route path="/" element={<DashboardHome />} />
                        <Route path="/todaytask" element={<TodayTask />} />
                        <Route path="/today-task" element={<Navigate to="/todaytask" replace />} />
                        <Route path="/calls-today-task" element={<Navigate to="/todaytask" replace />} />
                        <Route path="/leads" element={<Leads />} />
                        <Route path="/clients" element={<Clients />} />
                        <Route path="/templates" element={<QuotationTemplates />} />
                        <Route path="/whatsapp-templates" element={<WhatsAppTemplates />} />
                        <Route path="/settings" element={<Settings />} />
                    </Route>

                    {/* Catch-all redirect */}
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </BrowserRouter>
        </AuthProvider>
    );
}

export default App;
