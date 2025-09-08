"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type PriceItem = {
  id: string;
  service_type: string;
  material: string;
  base_price: number;
  express_price: number | null;
  created_at: string;
};

export default function PriceListPage() {
  const [items, setItems] = useState<PriceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [serviceType, setServiceType] = useState("");
  const [material, setMaterial] = useState("");
  const [basePrice, setBasePrice] = useState<string>("");
  const [expressPrice, setExpressPrice] = useState<string>("");

  useEffect(() => {
    fetchItems();
  }, []);

  async function fetchItems() {
    setLoading(true);
    const { data, error } = await supabase
      .from("price_list")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) console.error(error);
    setItems(data || []);
    setLoading(false);
  }

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("price_list").insert({
      service_type: serviceType,
      material,
      base_price: Number(basePrice),
      express_price: expressPrice ? Number(expressPrice) : null,
    });
    if (error) {
      console.error(error);
      return;
    }
    setServiceType("");
    setMaterial("");
    setBasePrice("");
    setExpressPrice("");
    fetchItems();
  }

  return (
    <div className="p-6 space-y-6 bg-gray-100 min-h-screen text-black">
      {/* Header */}
      <div className="rounded bg-white p-4 shadow">
        <h2 className="text-lg font-semibold">Price List</h2>
        <div className="text-sm text-gray-700">
          {loading ? "Loading..." : `${items.length} items`}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Add Item Form */}
        <div className="rounded bg-white p-6 shadow">
          <h3 className="font-medium mb-4">Add Item</h3>
          <form onSubmit={addItem} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Service Type</label>
              <input
                value={serviceType}
                onChange={(e) => setServiceType(e.target.value)}
                className="w-full border rounded px-3 py-2 text-black"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Material</label>
              <input
                value={material}
                onChange={(e) => setMaterial(e.target.value)}
                className="w-full border rounded px-3 py-2 text-black"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Base Price</label>
                <input
                  type="number"
                  step="0.01"
                  value={basePrice}
                  onChange={(e) => setBasePrice(e.target.value)}
                  className="w-full border rounded px-3 py-2 text-black"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Express Price</label>
                <input
                  type="number"
                  step="0.01"
                  value={expressPrice}
                  onChange={(e) => setExpressPrice(e.target.value)}
                  className="w-full border rounded px-3 py-2 text-black"
                />
              </div>
            </div>
            <button
              type="submit"
              className="rounded bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2 transition"
            >
              Create
            </button>
          </form>
        </div>

        {/* Price List */}
        <div className="rounded bg-white p-6 shadow">
          <h3 className="font-medium mb-4">List</h3>
          <div className="divide-y">
            {items.map((it) => (
              <div
                key={it.id}
                className="py-3 flex items-center justify-between"
              >
                <div>
                  <div className="font-medium">
                    {it.service_type} — {it.material}
                  </div>
                  <div className="text-xs text-gray-600">
                    Base: ${it.base_price}{" "}
                    {it.express_price ? `• Express: $${it.express_price}` : ""}
                  </div>
                </div>
                <div className="text-xs text-gray-500">
                  {new Date(it.created_at).toLocaleString()}
                </div>
              </div>
            ))}
            {items.length === 0 && (
              <div className="text-sm text-gray-600">No price items yet</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
