"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type Rider = {
  id: string;
  name: string;
  phone: string;
  zone: string | null;
  is_active: boolean | null;
  created_at: string;
};

export default function RidersPage() {
  const [riders, setRiders] = useState<Rider[]>([]);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [zone, setZone] = useState("");

  useEffect(() => {
    fetchRiders();
  }, []);

  async function fetchRiders() {
    setLoading(true);
    const { data, error } = await supabase
      .from("riders")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) console.error(error);
    setRiders(data || []);
    setLoading(false);
  }

  async function addRider(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("riders").insert({
      name,
      phone,
      zone: zone || null,
    });
    if (error) {
      console.error(error);
      return;
    }
    setName("");
    setPhone("");
    setZone("");
    fetchRiders();
  }

  async function toggleActive(rider: Rider) {
    const { error } = await supabase
      .from("riders")
      .update({ is_active: !rider.is_active })
      .eq("id", rider.id);
    if (error) return console.error(error);
    fetchRiders();
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6 space-y-6 text-black">
      {/* Header */}
      <div className="rounded bg-white p-4 shadow">
        <h2 className="text-lg font-semibold text-black">Riders</h2>
        <div className="text-sm text-black">
          {loading ? "Loading..." : `${riders.length} total`}
        </div>
      </div>

      {/* Two-column grid */}
      <div className="grid grid-cols-2 gap-6">
        {/* Add Rider */}
        <div className="rounded bg-white p-4 shadow">
          <h3 className="font-medium mb-3 text-black">Add Rider</h3>
          <form onSubmit={addRider} className="space-y-3">
            <div>
              <label className="block text-sm text-black mb-1">Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border rounded px-3 py-2 text-black"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-black mb-1">Phone</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full border rounded px-3 py-2 text-black"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-black mb-1">Zone</label>
              <input
                value={zone}
                onChange={(e) => setZone(e.target.value)}
                className="w-full border rounded px-3 py-2 text-black"
              />
            </div>
            <button
              type="submit"
              className="rounded bg-emerald-700 text-white px-4 py-2"
            >
              Create
            </button>
          </form>
        </div>

        {/* Rider List */}
        <div className="rounded bg-white p-4 shadow">
          <h3 className="font-medium mb-3 text-black">Rider List</h3>
          <div className="divide-y">
            {riders.map((r) => (
              <div
                key={r.id}
                className="py-3 flex items-center justify-between"
              >
                <div>
                  <div className="font-medium text-black">{r.name}</div>
                  <div className="text-xs text-black">
                    {r.phone} {r.zone ? `• ${r.zone}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      r.is_active
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-gray-200 text-black"
                    }`}
                  >
                    {r.is_active ? "Active" : "Inactive"}
                  </span>
                  <button
                    onClick={() => toggleActive(r)}
                    className="text-xs rounded border px-2 py-1 text-black"
                  >
                    Toggle
                  </button>
                </div>
              </div>
            ))}
            {riders.length === 0 && (
              <div className="text-sm text-black">No riders yet</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
