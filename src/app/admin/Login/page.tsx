"use client";

import React, { useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    type CheckAdminLoginResponse = { success: boolean };

    const isCheckAdminLoginResponse = (
      value: unknown
    ): value is CheckAdminLoginResponse => {
      if (typeof value !== "object" || value === null) return false;
      const record = value as Record<string, unknown>;
      return typeof record.success === "boolean";
    };

    try {
      const result = await supabase.rpc(
        "check_admin_login",
        {
          p_username: username,
          p_password: password,
        }
      );

      if (result.error) {
        setError(result.error.message || "Login failed. Try again.");
        return;
      }

      if (isCheckAdminLoginResponse(result.data) && result.data.success) {
        localStorage.setItem("admin_logged_in", "true");
        router.push("/admin");
      } else {
        setError("Invalid credentials");
      }
    } catch (rpcErr: unknown) {
      const message = rpcErr instanceof Error
        ? rpcErr.message
        : "Login failed due to a network error.";
      setError(message);
      return;
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-900">
      <div className="bg-gray-800 text-white rounded-2xl shadow-2xl w-[420px] p-8 relative">
        {/* Logo / Heading */}
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-2">
            <div className="w-8 h-8 rounded-full bg-emerald-600"></div>
            <h1 className="text-2xl font-bold">Shoe Cleaning Services</h1>
          </div>
          <p className="text-gray-400 text-sm mt-1">Welcome Back!</p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-sm font-medium mb-1">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-lg bg-gray-700 border border-gray-600 px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              placeholder="Enter username"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg bg-gray-700 border border-gray-600 px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              placeholder="Enter password"
              required
            />
          </div>

          {error && <div className="text-sm text-red-500">{error}</div>}

          <button
            type="submit"
            className="w-full rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 transition"
          >
            Sign In
          </button>
        </form>

        {/* Footer */}
        <div className="mt-6 text-center text-xs text-gray-500">
          <p>© 2025 OneShop. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
