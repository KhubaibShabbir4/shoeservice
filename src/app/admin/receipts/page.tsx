"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

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
  const [search, setSearch] = useState("");
  const RECEIPTS_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_RECEIPTS_BUCKET || "receipts";
  let cachedLogoDataUrl: string | null = null;
  let cachedWatermarkDataUrl: string | null = null;
  
  async function downloadFromUrl(url: string, filename: string) {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e) {
      console.error("Failed to download receipt", e);
      window.open(url, "_blank");
    }
  }

  async function getLogoDataUrl(): Promise<string> {
    if (cachedLogoDataUrl) return cachedLogoDataUrl;
    try {
      const response = await fetch("/logo.png");
      const blob = await response.blob();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      cachedLogoDataUrl = dataUrl;
      return dataUrl;
    } catch {
      return "";
    }
  }

  async function makeTransparentImage(dataUrl: string, opacity: number): Promise<string> {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.globalAlpha = Math.max(0, Math.min(opacity, 1));
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  }

  async function getWatermarkDataUrl(): Promise<string> {
    if (cachedWatermarkDataUrl) return cachedWatermarkDataUrl;
    try {
      const logo = await getLogoDataUrl();
      if (!logo) return "";
      const transparent = await makeTransparentImage(logo, 0.07);
      cachedWatermarkDataUrl = transparent;
      return transparent;
    } catch {
      return "";
    }
  }

  function createReceiptPdf(order: any, logoBase64: string = "", watermarkBase64: string = "", unitPrice?: number, displayOrderNumber?: number) {
    const doc = new jsPDF();
    try {
      if (watermarkBase64) {
        doc.addImage(watermarkBase64, "PNG", 25, 30, 160, 200);
      }
    } catch {}
    try {
      if (logoBase64) {
        doc.addImage(logoBase64, "PNG", 14, 10, 40, 40);
      }
    } catch {}
    doc.setFontSize(18);
    doc.text("Don Lustre - Receipt", 105, 20, { align: "center" });
    doc.setFontSize(12);
    doc.text(`Order No: ${displayOrderNumber ?? "-"}`, 14, 56);
    doc.text(`Date: ${new Date(order.created_at).toLocaleString()}`, 14, 64);
    doc.text(`Customer: ${order.customers?.name ?? ""}`, 14, 70);
    doc.text(`Phone: ${order.customers?.phone ?? ""}`, 14, 78);
    doc.text(`Pickup Address: ${order.pickup_address ?? "-"}`, 14, 86);
    autoTable(doc, {
      startY: 100,
      head: [["Service Type", "Material", "Quantity", "Unit Price", "Total"]],
      body: [[
        order.service_type,
        order.material,
        String(order.quantity ?? "-"),
        unitPrice != null ? unitPrice.toFixed(2) : "-",
        unitPrice != null && order.quantity != null ? (unitPrice * Number(order.quantity)).toFixed(2) : "-",
      ]],
    });
    doc.setFontSize(10);
    doc.text("Thank you for choosing Don Lustre. Estimated 24–48 hrs service.", 14, 140);
    return doc;
  }

  async function upsertReceiptRecord(orderId: string, receiptUrl: string | null, totalAmount: number | null) {
    const { data: existing } = await supabase
      .from("receipts")
      .select("id")
      .eq("order_id", orderId)
      .maybeSingle();
    if (existing?.id) {
      await supabase.from("receipts").update({ receipt_url: receiptUrl, total_amount: totalAmount }).eq("id", existing.id);
      return;
    }
    await supabase.from("receipts").insert({ order_id: orderId, receipt_url: receiptUrl, total_amount: totalAmount });
  }

  async function generateAndUploadReceipt(orderId: string) {
    // Fetch full order with customer and details
    const { data: order, error } = await supabase
      .from("orders")
      .select("*, customers(name, phone)")
      .eq("id", orderId)
      .single();
    if (error || !order) throw error || new Error("Order not found");
    const [logo, watermark] = await Promise.all([
      getLogoDataUrl(),
      getWatermarkDataUrl(),
    ]);
    const unitPrice = await getUnitPrice(order.service_type, order.material);
    const seqNum = await getSequentialOrderNumber(order.created_at);
    const doc = createReceiptPdf(order, logo, watermark, unitPrice ?? undefined, seqNum ?? undefined);
    const blob = doc.output("blob");

    try {
      const path = `receipt_${orderId}.pdf`;
      const { error: uploadError } = await supabase.storage
        .from(RECEIPTS_BUCKET)
        .upload(path, blob, { contentType: "application/pdf", upsert: true });
      if (uploadError) throw uploadError;
      const { data: publicUrlData } = supabase.storage.from(RECEIPTS_BUCKET).getPublicUrl(path);
      const url = publicUrlData.publicUrl;
      const totalAmount = unitPrice != null ? unitPrice * Number(order.quantity) : null;
      await upsertReceiptRecord(orderId, url, totalAmount);
      // trigger download as well
      doc.save(`receipt_${orderId}.pdf`);
      // refresh list to reflect new URL
      fetchAll();
    } catch (e) {
      // still upsert a record w/o URL and download locally
      const totalAmount = unitPrice != null ? unitPrice * Number(order.quantity) : null;
      await upsertReceiptRecord(orderId, null, totalAmount);
      doc.save(`receipt_${orderId}.pdf`);
      fetchAll();
    }
  }

  async function getUnitPrice(serviceType: string, material: string): Promise<number | null> {
    const { data, error } = await supabase
      .from("price_list")
      .select("base_price, express_price")
      .eq("service_type", serviceType)
      .eq("material", material)
      .maybeSingle();
    if (error) {
      console.error("Failed to fetch unit price", error);
      return null;
    }
    const isExpress = serviceType?.toLowerCase?.().trim() === "express";
    const row: any = data;
    if (!row) return null;
    return isExpress ? row.express_price ?? row.base_price ?? null : row.base_price ?? null;
  }

  async function getSequentialOrderNumber(orderCreatedAt: string): Promise<number | null> {
    const { count, error } = await supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .lte("created_at", orderCreatedAt);
    if (error) {
      console.error("Failed to compute sequential order number", error);
      return null;
    }
    return count ?? null;
  }

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

  const filtered = receipts.filter((r) => {
    const order = oMap.get(r.order_id || "");
    const customer = order ? cMap.get(order.customer_id || "") : undefined;
    const hay = `${r.order_id} ${customer?.name ?? ""}`.toLowerCase();
    return hay.includes(search.toLowerCase());
  });

  return (
    <div className="min-h-screen bg-gray-50 p-6 space-y-6">
      {/* Header */}
      <div className="rounded overflow-hidden shadow">
        <div className="bg-gradient-to-r from-emerald-600 via-emerald-500 to-emerald-400 px-5 py-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src="/logo.png" alt="Logo" className="h-16 w-16 bg-white/10 rounded p-1" />
            <div>
              <h2 className="text-2xl font-semibold text-white">Receipts</h2>
              <div className="text-sm text-emerald-100">{loading ? "Loading..." : `${filtered.length} receipts`}</div>
            </div>
          </div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by order or customer..."
            className="w-80 bg-white/90 focus:bg-white border border-emerald-200 rounded px-3 py-2 text-sm placeholder-gray-500"
          />
        </div>
      </div>

      {/* List */}
      <div className="rounded bg-white p-0 shadow overflow-hidden">
        <div className="grid grid-cols-12 px-4 py-3 text-xs font-medium text-emerald-700 bg-emerald-50">
          <div className="col-span-3">Customer</div>
          <div className="col-span-3">Order</div>
          <div className="col-span-3">Created</div>
          <div className="col-span-3 text-right">Actions</div>
        </div>
        <div className="divide-y">
          {filtered.map((r) => {
            const order = oMap.get(r.order_id || "");
            const customer = order ? cMap.get(order.customer_id || "") : undefined;
            return (
              <div key={r.id} className="grid grid-cols-12 items-center px-4 py-4 hover:bg-emerald-50/40">
                <div className="col-span-3">
                  <div className="font-medium text-gray-900">{customer?.name ?? "Unknown Customer"}</div>
                  <div className="text-xs text-gray-500">{order?.customer_id}</div>
                </div>
                <div className="col-span-3">
                  <div className="text-sm text-gray-900">{r.order_id}</div>
                  <div className="text-xs text-gray-500">Amount: {r.total_amount ? `$${r.total_amount}` : "—"}</div>
                </div>
                <div className="col-span-3 text-sm text-gray-700">
                  {new Date(r.created_at).toLocaleString()}
                </div>
                <div className="col-span-3 flex items-center justify-end gap-2">
                  {r.receipt_url ? (
                    <>
                      <a
                        href={r.receipt_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded"
                      >
                        View Receipt
                      </a>
                      <button
                        onClick={() => downloadFromUrl(r.receipt_url!, `receipt_${r.order_id}.pdf`)}
                        className="text-xs border border-emerald-200 text-emerald-700 px-3 py-1.5 rounded hover:bg-emerald-50"
                      >
                        Download
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => generateAndUploadReceipt(r.order_id)}
                      className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded"
                    >
                      Generate & Download
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="px-4 py-8 text-sm text-gray-500">No receipts match your search.</div>
          )}
        </div>
      </div>
    </div>
  );
}


