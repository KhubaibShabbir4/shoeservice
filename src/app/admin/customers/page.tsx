"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type Customer = {
  id: string;
  name: string;
  phone: string;
  whatsapp_id: string | null;
  created_at: string;
};

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsappId, setWhatsappId] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchCustomers();
  }, []);

  async function fetchCustomers() {
    setLoading(true);
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) console.error(error);
    setCustomers(data || []);
    setLoading(false);
  }

  async function addCustomer(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("customers").insert({
      name,
      phone,
      whatsapp_id: whatsappId || null,
    });
    if (error) {
      console.error(error);
      return;
    }
    setName("");
    setPhone("");
    setWhatsappId("");
    fetchCustomers();
  }

  const filtered = customers.filter((c) =>
    `${c.name} ${c.phone} ${c.whatsapp_id ?? ""}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Customers</h1>
        <div className="flex gap-3">
          <input
            placeholder="Search name / phone / WhatsApp ID"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded border px-3 py-2"
          />
          <button
            onClick={fetchCustomers}
            className="rounded bg-indigo-600 px-4 py-2 text-white"
          >
            Refresh
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="grid grid-cols-3 gap-6">
        {/* Left: Customer Form */}
        <section className="col-span-1">
          <div className="rounded bg-white p-4 shadow">
            <h2 className="mb-3 text-lg font-medium">Add Customer</h2>
            <form onSubmit={addCustomer} className="space-y-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Name
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Phone
                </label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  WhatsApp ID
                </label>
                <input
                  value={whatsappId}
                  onChange={(e) => setWhatsappId(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <button
                type="submit"
                className="rounded bg-emerald-600 text-white px-4 py-2 w-full"
              >
                Create
              </button>
            </form>
          </div>
        </section>

        {/* Right: Customer List */}
        <section className="col-span-2">
          <div className="rounded bg-white p-4 shadow">
            <h2 className="mb-3 text-lg font-medium">
              Customer List ({filtered.length})
            </h2>
            {loading ? (
              <div>Loading...</div>
            ) : filtered.length === 0 ? (
              <div className="rounded bg-emerald-600">No customers found</div>
            ) : (
              <table className="w-full table-auto text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 border-b">
                    <th className="pb-2">#</th>
                    <th className="pb-2">Name</th>
                    <th className="pb-2">Phone</th>
                    <th className="pb-2">WhatsApp ID</th>
                    <th className="pb-2">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c, i) => (
                    <tr key={c.id} className="border-t">
                      <td className="py-2">{i + 1}</td>
                      <td className="py-2 font-medium">{c.name}</td>
                      <td className="py-2">{c.phone}</td>
                      <td className="py-2">{c.whatsapp_id || "—"}</td>
                      <td className="py-2 text-xs text-gray-500">
                        {new Date(c.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
