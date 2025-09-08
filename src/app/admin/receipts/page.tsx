"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type Receipt = {
  id: string;
  order_id: string;
  receipt_url: string | null;
  total_amount: number | null;
  created_at: string;
};

type Order = { id: string; customer_id: string | null; created_at: string };
type Customer = { id: string; name: string };

export default function ReceiptsPage() {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll() {
    setLoading(true);
    const [{ data: rData }, { data: oData }, { data: cData }] = await Promise.all([
      supabase.from("receipts").select("*").order("created_at", { ascending: false }),
      supabase.from("orders").select("id,customer_id,created_at"),
      supabase.from("customers").select("id,name"),
    ]);
    setReceipts(rData || []);
    setOrders(oData || []);
    setCustomers(cData || []);
    setLoading(false);
  }

  const cMap = useMemo(() => {
    const m = new Map<string, Customer>();
    customers.forEach((c) => m.set(c.id, c));
    return m;
  }, [customers]);

  const oMap = useMemo(() => {
    const m = new Map<string, Order>();
    orders.forEach((o) => m.set(o.id, o));
    return m;
  }, [orders]);

  return (
    <div className="p-6 space-y-6">
      <div className="rounded bg-white p-4 shadow">
        <h2 className="text-lg font-semibold">Receipts</h2>
        <div className="text-sm text-gray-500">{loading ? "Loading..." : `${receipts.length} receipts`}</div>
      </div>

      <div className="rounded bg-white p-4 shadow">
        <div className="divide-y">
          {receipts.map((r) => {
            const order = oMap.get(r.order_id || "");
            const customer = order ? cMap.get(order.customer_id || "") : undefined;
            return (
              <div key={r.id} className="py-3 flex items-center justify-between">
                <div>
                  <div className="font-medium">{customer?.name ?? "Unknown Customer"}</div>
                  <div className="text-xs text-gray-500">Order: {r.order_id} • Amount: {r.total_amount ? `$${r.total_amount}` : "—"}</div>
                </div>
                <div className="flex items-center gap-2">
                  {r.receipt_url && (
                    <a href={r.receipt_url} target="_blank" rel="noreferrer" className="text-xs rounded border px-2 py-1">View</a>
                  )}
                  <a href={`/admin/orders/${r.order_id}`} className="text-xs rounded border px-2 py-1">Order</a>
                </div>
              </div>
            );
          })}
          {receipts.length === 0 && <div className="text-sm text-gray-500">No receipts yet</div>}
        </div>
      </div>
    </div>
  );
}


