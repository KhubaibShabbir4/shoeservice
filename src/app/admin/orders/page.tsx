"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";


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
  const RECEIPTS_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_RECEIPTS_BUCKET || "receipts";
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);

  const [customerId, setCustomerId] = useState("");
  const [serviceType, setServiceType] = useState("");
  const [material, setMaterial] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [pickupAddress, setPickupAddress] = useState("");
  const [price, setPrice] = useState<number>(0);

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
    // Persist price in price_list (upsert by service_type + material)
    try {
      const isExpress = serviceType.trim().toLowerCase() === "express";
      const payload: Record<string, any> = {
        service_type: serviceType,
        material,
        ...(isExpress ? { express_price: price } : { base_price: price }),
      };
      await supabase
        .from("price_list")
        .upsert(payload, { onConflict: "service_type,material" });
    } catch (err) {
      console.error("Failed to upsert price_list", err);
    }
    const { data: newOrderData, error } = await supabase
      .from("orders")
      .insert({
        customer_id: customerId,
        service_type: serviceType,
        material,
        quantity,
        pickup_address: pickupAddress,
      })
      .select("*, customers(name, phone)")
      .single();
    if (error) {
      console.error(error);
      return;
    }

    try {
      if (newOrderData) {
        await generateAndStoreReceipt(newOrderData, price);
      }
    } catch (err) {
      console.error("Failed to generate/store receipt:", err);
    }
    setCustomerId("");
    setServiceType("");
    setMaterial("");
    setQuantity(1);
    setPickupAddress("");
    setPrice(0);
    fetchOrders();
  }

  // Load logo from public folder and cache as data URL
  let cachedLogoDataUrl: string | null = null;
  let cachedWatermarkDataUrl: string | null = null;
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

  // Create a low-opacity watermark version of the logo and cache it
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

  // --- Generate PDF Receipt ---
 
function createReceiptPdf(order: Order, logoBase64: string = "", watermarkBase64: string = "", unitPrice?: number, displayOrderNumber?: number) {
  const doc = new jsPDF();

  // Background watermark (covers most of the page, very light)
  try {
    if (watermarkBase64) {
      // Position roughly centered and large
      doc.addImage(watermarkBase64, "PNG", 25, 30, 160, 200);
    }
  } catch {}

  // Logo (prefer provided base64; otherwise skip silently)
  try {
    if (logoBase64) {
      doc.addImage(logoBase64, "PNG", 14, 10, 40, 40);
    }
  } catch {}

  // Title
  doc.setFontSize(18);
  doc.text("Don Lustre - Receipt", 105, 20, { align: "center" });

  // Order Info
  doc.setFontSize(12);
  doc.text(`Order No: ${displayOrderNumber ?? "-"}` , 14, 56);
  doc.text(`Date: ${new Date(order.created_at).toLocaleString()}`, 14, 64);

  // Customer Info
  doc.text(`Customer: ${order.customers?.name ?? ""}`, 14, 70);
  doc.text(`Phone: ${order.customers?.phone ?? ""}`, 14, 78);
  doc.text(`Pickup Address: ${order.pickup_address}`, 14, 86);

  // Table for order details
  autoTable(doc, {
    startY: 100,
    head: [["Service Type", "Material", "Quantity", "Unit Price", "Total"]],
    body: [[
      order.service_type,
      order.material,
      order.quantity.toString(),
      unitPrice != null ? unitPrice.toFixed(2) : "-",
      unitPrice != null ? (unitPrice * order.quantity).toFixed(2) : "-",
    ]],
  });

  // Footer
  doc.setFontSize(10);
  doc.text(
    "Thank you for choosing Don Lustre. Estimated 24–48 hrs service.",
    14,
    140
  );

  return doc;
}

  async function uploadReceiptAndSaveRecord(order: Order, pdfBlob: Blob, totalAmount: number | null) {
    const filePath = `receipt_${order.id}.pdf`;
    try {
      const { error: uploadError } = await supabase.storage
        .from(RECEIPTS_BUCKET)
        .upload(filePath, pdfBlob, { contentType: "application/pdf", upsert: true });
      if (uploadError) {
        const message = (uploadError as any)?.message || String(uploadError);
        if (message.toLowerCase().includes("bucket not found")) {
          throw new Error(
            `Supabase Storage bucket "${RECEIPTS_BUCKET}" not found. Create it in Storage or set NEXT_PUBLIC_SUPABASE_RECEIPTS_BUCKET to an existing bucket.`
          );
        }
        throw uploadError;
      }
      const { data: publicUrlData } = supabase.storage.from(RECEIPTS_BUCKET).getPublicUrl(filePath);
      const receiptUrl = publicUrlData.publicUrl;
      await upsertReceiptRecord(order.id, receiptUrl, totalAmount);
      return receiptUrl;
    } catch (err) {
      // Ensure a DB record exists even when upload fails
      await upsertReceiptRecord(order.id, null, totalAmount);
      throw err;
    }
  }

  async function generateAndStoreReceipt(order: Order, unitPrice: number) {
    const [logo, watermark] = await Promise.all([
      getLogoDataUrl(),
      getWatermarkDataUrl(),
    ]);
    const seqNum = await getSequentialOrderNumber(order.created_at);
    const doc = createReceiptPdf(order, logo, watermark, unitPrice, seqNum ?? undefined);
    const blob = doc.output("blob");
    const totalAmount = unitPrice * order.quantity;
    try {
      await uploadReceiptAndSaveRecord(order, blob, totalAmount);
    } catch (e) {
      // Already ensured DB record in uploadReceiptAndSaveRecord; swallow here
      console.error("Receipt upload failed; DB record ensured.", e);
    }
  }

  async function downloadReceipt(order: Order) {
    try {
      const [logo, watermark] = await Promise.all([
        getLogoDataUrl(),
        getWatermarkDataUrl(),
      ]);
      const unitPrice = await getUnitPrice(order.service_type, order.material);
      const seqNum = await getSequentialOrderNumber(order.created_at);
      const doc = createReceiptPdf(
        order,
        logo,
        watermark,
        unitPrice ?? undefined,
        seqNum ?? undefined
      );
      const blob = doc.output("blob");
      // Upload & save DB record (idempotent via upsert storage)
      const totalAmount = unitPrice != null ? unitPrice * order.quantity : null;
      await uploadReceiptAndSaveRecord(order, blob, totalAmount);
      // Also trigger download for the user
      doc.save(`receipt_${order.id}.pdf`);
    } catch (e) {
      console.error("Failed to upload/save receipt", e);
      // Still let the user download locally
      try {
        const [logo, watermark] = await Promise.all([
          getLogoDataUrl(),
          getWatermarkDataUrl(),
        ]);
        const unitPrice = await getUnitPrice(order.service_type, order.material);
        const seqNum = await getSequentialOrderNumber(order.created_at);
        const doc = createReceiptPdf(
          order,
          logo,
          watermark,
          unitPrice ?? undefined,
          seqNum ?? undefined
        );
        doc.save(`receipt_${order.id}.pdf`);
      } catch {}
      // Provide a visible hint once (best-effort)
      if (e instanceof Error && e.message.includes("bucket")) {
        alert(e.message);
      }
    }
  }

  async function upsertReceiptRecord(orderId: string, receiptUrl: string | null, totalAmount: number | null) {
    // Check if a receipt exists for this order
    const { data: existing, error: selErr } = await supabase
      .from("receipts")
      .select("id")
      .eq("order_id", orderId)
      .maybeSingle();
    if (selErr) {
      console.error("Failed to check existing receipt", selErr);
    }
    if (existing?.id) {
      const { error: updErr } = await supabase
        .from("receipts")
        .update({ receipt_url: receiptUrl, total_amount: totalAmount })
        .eq("id", existing.id);
      if (updErr) console.error("Failed to update receipt record", updErr);
      return;
    }
    const { error: insErr } = await supabase.from("receipts").insert({
      order_id: orderId,
      receipt_url: receiptUrl,
      total_amount: totalAmount,
    });
    if (insErr) console.error("Failed to insert receipt record", insErr);
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
    const isExpress = serviceType.trim().toLowerCase() === "express";
    const row: any = data;
    if (!row) return null;
    return isExpress ? row.express_price ?? row.base_price ?? null : row.base_price ?? null;
  }

  // Compute sequential order number based on creation time
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
              <label className="block text-sm text-black mb-1">Unit Price</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(Number(e.target.value))}
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
                  <div className="text-xs text-black">{o.pickup_address}</div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <div className="text-xs text-black">
                    {new Date(o.created_at).toLocaleString()}
                  </div>
                  <button
                    onClick={() => downloadReceipt(o)}
                    className="text-xs bg-indigo-600 text-white px-2 py-1 rounded"
                  >
                    Download Receipt
                  </button>
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

