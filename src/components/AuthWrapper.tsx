"use client";

import React, { useState, useEffect } from "react";

export default function AuthWrapper({ children }: { children: React.ReactNode }) {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const authSession = sessionStorage.getItem("app_unlocked");
        if (authSession === "true") {
            setIsAuthenticated(true);
        }
        setLoading(false);
    }, []);

    const handleUnlock = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        try {
            const res = await fetch("/api/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password }),
            });

            const data = await res.json();

            if (res.ok && data.success) {
                setIsAuthenticated(true);
                sessionStorage.setItem("app_unlocked", "true");
            } else {
                setError(data.message || "Incorrect password.");
            }
        } catch (err) {
            setError("Failed to verify password.");
        }
    };

    const handleLock = () => {
        sessionStorage.removeItem("app_unlocked");
        setIsAuthenticated(false);
    };

    if (loading) return null;

    if (!isAuthenticated) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950 text-white p-4">
                <div className="w-full max-w-md bg-gray-900 border border-gray-800 p-8 rounded-2xl shadow-2xl">
                    <div className="text-center mb-6">
                        <div className="inline-flex p-1 bg-gray-800/60 rounded-2xl mb-3 border border-#feb026">
                            <img
                                src="/logo.png"
                                alt="Company Logo"
                                className="w-12 h-12 object-contain"
                            />
                        </div>
                        <h1 className="text-2xl font-bold text-white">LAIL-W-NAHAR</h1>
                        <p className="text-gray-400 text-sm mt-1">
                            Enter your master password to access application data.
                        </p>
                    </div>

                    <form onSubmit={handleUnlock} className="space-y-4">
                        <div>
                            <input
                                type="password"
                                placeholder="Enter Master Password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-4 py-3 bg-gray-950 border border-gray-800 rounded-xl text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                                required
                                autoFocus
                            />
                        </div>

                        {error && (
                            <p className="text-red-400 text-sm font-medium text-center">{error}</p>
                        )}

                        <button
                            type="submit"
                            className="w-full py-3 bg-blue-600 hover:bg-blue-500 font-semibold rounded-xl transition duration-200 shadow-lg shadow-blue-600/20"
                        >
                            Unlock Application
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="relative">
            <div className="fixed top-4 right-4 z-40">
                <button
                    onClick={handleLock}
                    className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-medium rounded-lg border border-gray-700 transition"
                >
                    🔒 Lock App
                </button>
            </div>
            {children}
        </div>
    );
}