"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type Order = {
  id: string;
  customer_id: string;
  service_type: string;
  material: string;
  quantity: number;
  pickup_address: string;
  created_at: string;
  customers: {
    name: string;
    phone: string;
  };
};

type Customer = {
  id: string;
  name: string;
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);

  const [customerId, setCustomerId] = useState("");
  const [serviceType, setServiceType] = useState("");
  const [material, setMaterial] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [pickupAddress, setPickupAddress] = useState("");

  useEffect(() => {
    fetchOrders();
    fetchCustomers();
  }, []);

  async function fetchOrders() {
    setLoading(true);
    const { data, error } = await supabase
      .from("orders")
      .select("*, customers(name, phone)")
      .order("created_at", { ascending: false });
    if (error) console.error(error);
    setOrders(data || []);
    setLoading(false);
  }

  async function fetchCustomers() {
    const { data, error } = await supabase
      .from("customers")
      .select("id, name")
      .order("created_at", { ascending: false });
    if (error) console.error(error);
    setCustomers(data || []);
  }

  async function addOrder(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("orders").insert({
      customer_id: customerId,
      service_type: serviceType,
      material,
      quantity,
      pickup_address: pickupAddress,
    });
    if (error) {
      console.error(error);
      return;
    }
    setCustomerId("");
    setServiceType("");
    setMaterial("");
    setQuantity(1);
    setPickupAddress("");
    fetchOrders();
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6 space-y-6 text-black">
      {/* Header Card */}
      <div className="rounded bg-white p-4 shadow">
        <h2 className="text-lg font-semibold text-black">Orders</h2>
        <div className="text-sm text-black">
          {loading ? "Loading..." : `${orders.length} total`}
        </div>
      </div>

      {/* Two-column grid */}
      <div className="grid grid-cols-2 gap-6">
        {/* Add Order Form */}
        <div className="rounded bg-white p-4 shadow">
          <h3 className="font-medium mb-3 text-black">Add Order</h3>
          <form onSubmit={addOrder} className="space-y-3">
            <div>
              <label className="block text-sm text-black mb-1">Customer</label>
              <select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                className="w-full border rounded px-3 py-2 text-black"
                required
              >
                <option value="">Select Customer</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-black mb-1">
                Service Type
              </label>
              <input
                value={serviceType}
                onChange={(e) => setServiceType(e.target.value)}
                className="w-full border rounded px-3 py-2 text-black"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-black mb-1">Material</label>
              <input
                value={material}
                onChange={(e) => setMaterial(e.target.value)}
                className="w-full border rounded px-3 py-2 text-black"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-black mb-1">Quantity</label>
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                className="w-full border rounded px-3 py-2 text-black"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-black mb-1">
                Pickup Address
              </label>
              <input
                value={pickupAddress}
                onChange={(e) => setPickupAddress(e.target.value)}
                className="w-full border rounded px-3 py-2 text-black"
                required
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

        {/* Order List */}
        <div className="rounded bg-white p-4 shadow">
          <h3 className="font-medium mb-3 text-black">Order List</h3>
          <div className="divide-y">
            {orders.map((o) => (
              <div
                key={o.id}
                className="py-3 flex items-center justify-between"
              >
                <div>
                  <div className="font-medium text-black">
                    {o.customers?.name || "Unknown"} • {o.service_type}
                  </div>
                  <div className="text-xs text-black">
                    {o.material} • Qty: {o.quantity}
                  </div>
                  <div className="text-xs text-black">
                    {o.pickup_address}
                  </div>
                </div>
                <div className="text-xs text-black">
                  {new Date(o.created_at).toLocaleString()}
                </div>
              </div>
            ))}
            {orders.length === 0 && (
              <div className="text-sm text-black">No orders yet</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
