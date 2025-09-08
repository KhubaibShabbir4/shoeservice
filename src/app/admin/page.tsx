"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { Menu, Users, FileText, Settings, Home, Search, Bell } from "lucide-react";
import { supabase } from "../lib/supabaseClient"; 
import { useRouter } from "next/navigation";

// (removed duplicate default export)

// ----- Types (you can replace these with generated Database types if available) -----
type Order = {
  id: string;
  customer_id: string | null;
  rider_id: string | null;
  service_type: string;
  material: string | null;
  quantity: number;
  notes: string | null;
  pickup_address: string | null;
  pickup_lat: number | null;
  pickup_lng: number | null;
  status: string; // 'pedido recibido','en proceso','listo','en camino','entregado'
  express: boolean | null;
  created_at: string;
  updated_at: string;
};

type Rider = {
  id: string;
  name: string;
  phone: string;
  zone?: string | null;
  is_active?: boolean | null;
};

type Customer = {
  id: string;
  name: string;
  phone: string;
  whatsapp_id?: string | null;
};

// --- UI constants ---
const SIDEBAR_BG = "bg-emerald-900";
const SIDEBAR_LINK = "text-emerald-100 hover:text-white";
const CARD = "rounded bg-white p-4 shadow";

const STATUS_COLORS: Record<string, string> = {
  "pedido recibido": "#60a5fa",
  "en proceso": "#f59e0b",
  "listo": "#10b981",
  "en camino": "#6366f1",
  "entregado": "#9ca3af",
};

export default function AdminDashboard() {
  const router = useRouter();
  // data
  const [orders, setOrders] = useState<Order[]>([]);
  const [riders, setRiders] = useState<Rider[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);

  // UI state
  const [query, setQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string | "">("");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const rrRef = useRef(0);
  const [lang, setLang] = useState<"en" | "es">("en");

  // auth redirect
  useEffect(() => {
    const loggedIn = localStorage.getItem("admin_logged_in");
    if (!loggedIn) {
      router.push("/admin/Login");
    }
  }, [router]);

  async function handleLogout() {
    try {
      await supabase.auth.signOut();
    } catch {}
    try {
      localStorage.removeItem("admin_logged_in");
    } catch {}
    router.push("/admin/Login");
  }

  const dict: Record<string, Record<string, string>> = {
    en: {
      "Admin Panel": "Admin Panel",
      Dashboard: "Dashboard",
      Orders: "Orders",
      Customers: "Customers",
      Riders: "Riders",
      "Price List": "Price List",
      Receipts: "Receipts",
      Reports: "Reports",
      Settings: "Settings",
      Version: "Version",
      searchPlaceholder: "Search orders, customers...",
      OrdersLabel: "Orders",
      Revenue: "Revenue",
      "Recent Orders": "Recent Orders",
      Loading: "Loading...",
      total: "total",
      "No orders found": "No orders found",
      "Status Distribution": "Status Distribution",
      ManageRiders: "Manage Riders",
      "Quick Actions": "Quick Actions",
      "Export CSV": "Export CSV",
      Refresh: "Refresh",
      "Orders Over Time": "Orders Over Time",
      "Top Services": "Top Services",
      Order: "Order",
      Advance: "Advance",
      Receipt: "Receipt",
      Close: "Close",
      Phone: "Phone",
      Address: "Address",
      Notes: "Notes",
      Service: "Service",
      Quantity: "Quantity",
      "Assign Rider": "Assign Rider",
      "Select rider": "Select rider",
      "Assign & Notify": "Assign & Notify",
      "Mark Ready": "Mark Ready",
      PhotosHint: "Photos available in Orders page details.",
      View: "View",
      Next: "Next",
    },
    es: {
      "Admin Panel": "Panel de Administración",
      Dashboard: "Panel",
      Orders: "Pedidos",
      Customers: "Clientes",
      Riders: "Repartidores",
      "Price List": "Lista de precios",
      Receipts: "Recibos",
      Reports: "Reportes",
      Settings: "Configuración",
      Version: "Versión",
      searchPlaceholder: "Buscar pedidos, clientes...",
      OrdersLabel: "Pedidos",
      Revenue: "Ingresos",
      "Recent Orders": "Pedidos recientes",
      Loading: "Cargando...",
      total: "total",
      "No orders found": "No se encontraron pedidos",
      "Status Distribution": "Distribución por estado",
      ManageRiders: "Gestionar repartidores",
      "Quick Actions": "Acciones rápidas",
      "Export CSV": "Exportar CSV",
      Refresh: "Actualizar",
      "Orders Over Time": "Pedidos en el tiempo",
      "Top Services": "Servicios más usados",
      Order: "Pedido",
      Advance: "Avanzar",
      Receipt: "Recibo",
      Close: "Cerrar",
      Phone: "Teléfono",
      Address: "Dirección",
      Notes: "Notas",
      Service: "Servicio",
      Quantity: "Cantidad",
      "Assign Rider": "Asignar repartidor",
      "Select rider": "Selecciona repartidor",
      "Assign & Notify": "Asignar y notificar",
      "Mark Ready": "Marcar listo",
      PhotosHint: "Fotos disponibles en detalles de pedidos.",
      View: "Ver",
      Next: "Siguiente",
    },
  };

  function t(key: string) {
    return dict[lang][key] ?? key;
  }

  // fetch initial + realtime
  useEffect(() => {
    fetchInitial();

    const sub = supabase
      .channel("public:orders")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders" },
        (payload) => setOrders((p) => [payload.new as Order, ...p])
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders" },
        (payload) =>
          setOrders((p) => p.map((o) => (o.id === payload.new.id ? (payload.new as Order) : o)))
      )
      .subscribe();

    return () => {
      supabase.removeChannel(sub);
    };
  }, []);

  async function fetchInitial() {
    setLoading(true);
    // orders
    const { data: ordersData, error: ordersErr } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500)
      .returns<Order[]>();

    if (ordersErr) console.error("orders fetch error", ordersErr);
    else setOrders(ordersData || []);

    // riders
    const { data: ridersData, error: ridersErr } = await supabase.from("riders").select("*").returns<Rider[]>();
    if (ridersErr) console.error("riders fetch error", ridersErr);
    else setRiders(ridersData || []);

    // customers
    const { data: customersData, error: customersErr } = await supabase.from("customers").select("*").returns<Customer[]>();
    if (customersErr) console.error("customers fetch error", customersErr);
    else setCustomers(customersData || []);

    setLoading(false);
  }

  // actions
  async function updateOrderStatus(orderId: string, status: string) {
    const { error } = await supabase.from("orders").update({ status }).eq("id", orderId);
    if (error) console.error(error);
  }

  async function assignRider(orderId: string, riderId: string) {
    const { error } = await supabase.from("orders").update({ rider_id: riderId, status: "en camino" }).eq("id", orderId);
    if (error) console.error(error);
  }

  function autoAssign(order: Order) {
    if (!riders.length) return;
    const idx = rrRef.current % riders.length;
    const r = riders[idx];
    rrRef.current = idx + 1;
    assignRider(order.id, r.id);
  }

  function riderNameById(id?: string | null) {
    if (!id) return "—";
    const r = riders.find((x) => x.id === id);
    return r ? r.name : id;
  }

  function customerById(id?: string | null) {
    if (!id) return undefined;
    return customers.find((x) => x.id === id);
  }

  // derived data for cards/charts
  const filteredOrders = orders.filter((o) => {
    if (filterStatus && o.status !== filterStatus) return false;
    const cust = customerById(o.customer_id);
    const haystack = `${cust?.name ?? ""} ${cust?.phone ?? ""} ${o.pickup_address ?? ""}`.toLowerCase();
    if (query && !haystack.includes(query.toLowerCase())) return false;
    return true;
  });

  const totals = useMemo(() => {
    const byStatus: Record<string, number> = { "pedido recibido": 0, "en proceso": 0, "listo": 0, "en camino": 0, "entregado": 0 };
    const revenue = 0;
    filteredOrders.forEach((o) => {
      byStatus[o.status] = (byStatus[o.status] || 0) + 1;
      // revenue could be derived from receipts; keeping 0 for now
    });
    return { byStatus, revenue, total: filteredOrders.length };
  }, [filteredOrders]);

  const monthlySeries = useMemo(() => {
    // produce last 6 months counts
    const now = new Date();
    const months: { label: string; count: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleString(undefined, { month: "short" });
      months.push({ label, count: 0 });
    }
    filteredOrders.forEach((o) => {
      const d = new Date(o.created_at);
      const label = d.toLocaleString(undefined, { month: "short" });
      const m = months.find((x) => x.label === label);
      if (m) m.count++;
    });
    return months;
  }, [filteredOrders]);

  const statusPie = useMemo(() => {
    return Object.entries(totals.byStatus).map(([k, v]) => ({ name: k, value: v }));
  }, [totals]);

  // printing receipt (simple HTML popup)
  function generateReceipt(order: Order) {
    const rider = riders.find((r) => r.id === order.rider_id);
    const customer = customerById(order.customer_id);
    const html = `
      <html><head><meta charset="utf-8"/><title>Receipt</title>
      <style>body{font-family:Inter,system-ui,Arial;padding:20px} .card{border:1px solid #e5e7eb;padding:12px;border-radius:8px}</style>
      </head><body>
      <h2>Don Lustre — Receipt</h2>
      <div class="card">
        <strong>Customer:</strong> ${customer?.name ?? ""}<br/>
        <strong>Phone:</strong> ${customer?.phone ?? ""}<br/>
        <strong>Pickup Address:</strong> ${order.pickup_address ?? ""}<br/>
        <strong>Rider:</strong> ${rider?.name ?? "—"}<br/>
        <strong>Service:</strong> ${order.service_type} / ${order.material}<br/>
        <strong>Qty:</strong> ${order.quantity}<br/>
        <strong>Status:</strong> ${order.status}<br/>
        <strong>Date:</strong> ${new Date(order.created_at).toLocaleString()}
      </div>
      <p><button onclick="window.print()">Print / Save PDF</button></p>
      </body></html>
    `;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(html);
    w.document.close();
  }

  // small helper to format numbers
  function fmt(n: number) {
    return n.toLocaleString();
  }

  // --- UI ---
  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Sidebar */}
      <aside className={`w-64 ${SIDEBAR_BG} text-white flex flex-col`}>
        <div className="p-6 flex items-center gap-3 border-b border-emerald-800">
          <div className="w-10 h-10 rounded bg-white/10 flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M3 12h18" stroke="white" strokeWidth="1.5"/><path d="M12 3v18" stroke="white" strokeWidth="1.5"/></svg>
          </div>
          <div>
            <div className="font-semibold">Don Lustre</div>
            <div className="text-xs text-emerald-200">{t("Admin Panel")}</div>
          </div>
        </div>

        <nav className="flex-1 p-4">
          <ul className="space-y-2">
            <li className="py-1 px-2 rounded hover:bg-emerald-800">
              <a className={`flex items-center gap-3 ${SIDEBAR_LINK}`} href="#">
                <Home size={16} /> {t("Dashboard")}
              </a>
            </li>
            <li className="py-1 px-2 rounded hover:bg-emerald-800">
              <a className={`flex items-center gap-3 ${SIDEBAR_LINK}`} href="/admin/orders">
                <FileText size={16} /> {t("Orders")}
              </a>
            </li>
            <li className="py-1 px-2 rounded hover:bg-emerald-800">
              <a className={`flex items-center gap-3 ${SIDEBAR_LINK}`} href="/admin/customers">
                <Users size={16} /> {t("Customers")}
              </a>
            </li>
            <li className="py-1 px-2 rounded hover:bg-emerald-800">
              <a className={`flex items-center gap-3 ${SIDEBAR_LINK}`} href="/admin/riders">
                <Users size={16} /> {t("Riders")}
              </a>
            </li>
            <li className="py-1 px-2 rounded hover:bg-emerald-800">
              <a className={`flex items-center gap-3 ${SIDEBAR_LINK}`} href="/admin/price-list">
                <FileText size={16} /> {t("Price List")}
              </a>
            </li>
            <li className="py-1 px-2 rounded hover:bg-emerald-800">
              <a className={`flex items-center gap-3 ${SIDEBAR_LINK}`} href="/admin/receipts">
                <FileText size={16} /> {t("Receipts")}
              </a>
            </li>
            <li className="py-1 px-2 rounded hover:bg-emerald-800">
              <a className={`flex items-center gap-3 ${SIDEBAR_LINK}`} href="/admin/reports">
                <FileText size={16} /> {t("Reports")}
              </a>
            </li>
            <li className="py-1 px-2 rounded hover:bg-emerald-800">
              <a className={`flex items-center gap-3 ${SIDEBAR_LINK}`} href="/admin/settings">
                <Settings size={16} /> {t("Settings")}
              </a>
            </li>
          </ul>
        </nav>

        <div className="p-4 border-t border-emerald-800">
          <div className="text-sm text-emerald-200">{t("Version")} 1.0</div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1">
        {/* Topbar */}
        <header className="flex items-center justify-between p-4 border-b bg-white">
          <div className="flex items-center gap-4">
            <button className="p-2 rounded hover:bg-gray-100"><Menu size={18} /></button>
            <div className="relative">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("searchPlaceholder")}
                className="border rounded px-3 py-2 w-96"
              />
              <span className="absolute right-2 top-1.5 text-gray-700"><Search size={16} /></span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              aria-label="Toggle language"
              className="px-2 py-1 border rounded text-sm"
              onClick={() => setLang((prev) => (prev === "en" ? "es" : "en"))}
            >
              {lang === "en" ? "ES" : "EN"}
            </button>
            <button className="relative p-2 rounded hover:bg-gray-50"><Bell size={18} /></button>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-sm font-medium">Admin</div>
                <div className="text-xs text-gray-800">dispatcher@donlustre</div>
              </div>
              <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">A</div>
              <button onClick={handleLogout} className="ml-2 px-3 py-1 text-sm border rounded hover:bg-gray-50">Logout</button>
            </div>
        </div>
      </header>

        {/* Content */}
        <main className="p-6 space-y-6">
          {/* Top stats */}
          <div className="grid grid-cols-12 gap-6">
            <div className="col-span-8">
              <div className={`${CARD} flex items-center justify-between`}>
                <div>
                  <div className="text-gray-900 text-sm">{t("OrdersLabel")}</div>
                  <div className="text-2xl font-semibold">{fmt(totals.total)}</div>
                  <div className="text-sm text-gray-900 mt-1">{t("Revenue")}: <strong className="text-emerald-600">${fmt(Math.round(totals.revenue))}</strong></div>
                </div>

                <div className="grid grid-cols-6 gap-1 items-end" style={{ width: 360, height: 120 }}>
                  {monthlySeries.map(m => (
                    <div key={m.label} className="flex flex-col items-center gap-1">
                      <div className="bg-emerald-500 w-6 rounded" style={{ height: Math.max(6, m.count * 8) }} />
                      <div className="text-[10px] text-gray-900">{m.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Orders list card (cards inside) */}
              <div className={`${CARD} mt-6`}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-medium">{t("Recent Orders")}</h3>
                  <div className="text-xs text-gray-900">{loading ? t("Loading") : `${orders.length} ${t("total")}`}</div>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {filteredOrders.slice(0, 8).map((o) => (
                    <div key={o.id} className="flex items-center justify-between border rounded p-3">
                      <div>
                        <div className="font-medium">{customerById(o.customer_id)?.name ?? ""} <span className="text-xs text-gray-700">• {customerById(o.customer_id)?.phone ?? ""}</span></div>
                        <div className="text-xs text-gray-900">{o.service_type} / {o.material} • {o.quantity} pcs</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className={`text-xs px-2 py-0.5 rounded-full ${getStatusBgClass(o.status)}`}>{o.status}</div>
                        <div className="text-xs text-gray-900">{new Date(o.created_at).toLocaleTimeString()}</div>
                        <div className="flex gap-2">
                          <button onClick={() => setSelectedOrder(o)} className="text-xs rounded border px-2 py-1">{t("View")}</button>
                          <button onClick={() => updateOrderStatus(o.id, nextStatus(o.status))} className="text-xs rounded border px-2 py-1">{t("Next")}</button>
                        </div>
                      </div>
                    </div>
                  ))}

                  {filteredOrders.length === 0 && <div className="text-sm text-gray-900">{t("No orders found")}</div>}
                </div>
              </div>
            </div>

            {/* Right column small cards */}
            <div className="col-span-4 space-y-6">
              <div className={`${CARD}`}>
                <h4 className="font-medium mb-3">{t("Status Distribution")}</h4>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  {Object.entries(totals.byStatus).map(([k, v]) => (
                    <div key={k} className="flex items-center gap-2 p-2 border rounded">
                      <span className="w-2 h-2 rounded-full" style={{ background: STATUS_COLORS[k] }} />
                      <div className="capitalize">{k}</div>
                      <div className="ml-auto font-medium">{v}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className={`${CARD}`}>
                <h4 className="font-medium mb-3">{t("Riders")}</h4>
                <ul className="space-y-3">
                  {riders.slice(0, 6).map((r) => (
                    <li key={r.id} className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{r.name}</div>
                    <div className="text-xs text-gray-900">{r.phone}</div>
                  </div>
                      <div className="text-xs text-gray-700">{r.zone ?? "—"}</div>
                </li>
              ))}
            </ul>

                <div className="mt-3">
                  <button className="w-full rounded bg-emerald-700 text-white px-3 py-2" onClick={() => (window.location.href = "/admin/riders")}>{t("ManageRiders")}</button>
                </div>
              </div>

              <div className={`${CARD}`}>
                <h4 className="font-medium mb-3">{t("Quick Actions")}</h4>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => exportCSV(filteredOrders, riders, customers)}
                    className="rounded border px-3 py-2 text-sm transition-colors hover:bg-emerald-50 hover:border-emerald-300"
                    title={t("Export CSV")}
                  >
                    {t("Export CSV")}
                  </button>
                  <button onClick={() => fetchInitial()} className="rounded border px-3 py-2 text-sm">{t("Refresh")}</button>
                </div>
              </div>
            </div>
          </div>

          {/* charts row */}
          <div className="grid grid-cols-3 gap-6">
            <div className={`${CARD} col-span-2`} style={{ height: 260 }}>
              <h4 className="font-medium mb-3">{t("Orders Over Time")}</h4>
              <div className="flex items-end gap-2 h-[180px]">
                {monthlySeries.map(m => (
                  <div key={m.label} className="flex flex-col items-center gap-1">
                    <div className="bg-emerald-500 w-8 rounded" style={{ height: Math.max(8, m.count * 10) }} />
                    <div className="text-[10px] text-gray-900">{m.label}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className={`${CARD}`} style={{ height: 260 }}>
              <h4 className="font-medium mb-3">{t("Top Services")}</h4>
              <div className="text-sm text-gray-900">
                {aggregateTopServices(filteredOrders).slice(0,5).map(s => (
                  <div key={s.name} className="flex items-center justify-between py-1">
                    <div>{s.name}</div>
                    <div className="font-medium">{s.count}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
      </main>
      </div>

      {/* Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 p-6">
      <div className="w-full max-w-3xl rounded bg-white p-6">
        <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold">{t("Order")} — {customerById(selectedOrder.customer_id)?.name ?? ""}</h3>
          <div className="flex gap-2">
                <button onClick={() => updateOrderStatus(selectedOrder.id, nextStatus(selectedOrder.status))} className="rounded border px-3 py-1">{t("Advance")}</button>
                <button onClick={() => { generateReceipt(selectedOrder); }} className="rounded border px-3 py-1">{t("Receipt")}</button>
                <button onClick={() => setSelectedOrder(null)} className="rounded border px-3 py-1">{t("Close")}</button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4">
          <div>
            <div className="mb-2 text-sm text-gray-900">{t("Phone")}</div>
                <div className="font-medium">{customerById(selectedOrder.customer_id)?.phone ?? ""}</div>

            <div className="mt-4 mb-2 text-sm text-gray-900">{t("Address")}</div>
                <div className="text-sm">{selectedOrder.pickup_address ?? "—"}</div>

            <div className="mt-4 mb-2 text-sm text-gray-900">{t("Notes")}</div>
                <div className="text-sm">{selectedOrder.notes || "—"}</div>
          </div>

          <div>
            <div className="mb-2 text-sm text-gray-900">{t("Service")}</div>
                <div className="font-medium">{selectedOrder.service_type} / {selectedOrder.material}</div>
            <div className="mt-4 text-sm text-gray-900">{t("Quantity")}</div>
                <div className="font-medium">{selectedOrder.quantity}</div>

            <div className="mt-4">
              <label className="mb-1 block text-sm text-gray-900">{t("Assign Rider")}</label>
                  <select id="assign-rider" className="w-full rounded border px-2 py-2">
                <option value="">{t("Select rider")}</option>
                {riders.map(r => <option key={r.id} value={r.id}>{r.name} — {r.phone}</option>)}
              </select>
              <div className="mt-2 flex gap-2">
                    <button onClick={() => {
                      const sel = (document.getElementById("assign-rider") as HTMLSelectElement).value;
                      if (sel) assignRider(selectedOrder.id, sel);
                    }} className="rounded bg-indigo-600 px-3 py-2 text-white">{t("Assign & Notify")}</button>
                    <button onClick={() => updateOrderStatus(selectedOrder.id, "listo")} className="rounded border px-3 py-2">{t("Mark Ready")}</button>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex gap-2">
              {/* Photos are stored in order_photos table. Show a hint to manage in Orders page. */}
              <div className="text-sm text-gray-900">{t("PhotosHint")}</div>
        </div>
      </div>
        </div>
      )}
    </div>
  );
}

/* ----------------- small helpers ----------------- */

function getStatusBgClass(status: string) {
  switch (status) {
    case "received": return "bg-blue-100 text-blue-700";
    case "processing": return "bg-amber-100 text-amber-700";
    case "ready": return "bg-emerald-100 text-emerald-700";
    case "enroute": return "bg-indigo-100 text-indigo-700";
    case "delivered": return "bg-gray-100 text-gray-700";
    default: return "bg-gray-100 text-gray-700";
  }
}

function nextStatus(s: string) {
  const order = ["received", "processing", "ready", "enroute", "delivered"];
  const idx = order.indexOf(s);
  return order[Math.min(order.length - 1, Math.max(0, idx + 1))];
}

function exportCSV(data: Order[], ridersParam: Rider[], customersParam: Customer[]) {
  try {
  const headers = ["ID","Customer","Phone","Status","Service","Material","Quantity","Address","Rider","Notes","Created"];
  const rows = data.map((order) => [
    order.id,
    customersParam.find((customer) => customer.id === (order.customer_id || ""))?.name ?? "",
    customersParam.find((customer) => customer.id === (order.customer_id || ""))?.phone ?? "",
    order.status,
    order.service_type,
    order.material,
    String(order.quantity),
    order.pickup_address,
    ridersParam.find((rider) => rider.id === (order.rider_id || ""))?.name ?? "—",
    (order.notes ?? "").replace(/\n/g, " "),
    new Date(order.created_at).toLocaleString(),
  ]);

  // Ensure proper CSV formatting and Windows-friendly newlines
  const csvBody = [headers.join(","), ...rows.map((row) => row.map((cell) => JSON.stringify(cell ?? "")).join(","))].join("\r\n");

  // Prepend UTF-8 BOM so Excel recognizes encoding
  const BOM = "\uFEFF";
  const blob = new Blob([BOM + csvBody], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `orders_${new Date().toISOString().replace(/[:]/g, "-")}.csv`;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

  // Delay revoke to avoid potential race conditions in some browsers
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (err) {
    console.error("CSV export failed", err);
    alert("CSV export failed. Please try again.");
  }
}

function aggregateTopServices(orders: Order[]) {
  const map: Record<string, number> = {};
  orders.forEach(o => {
    const name = `${o.service_type} (${o.material})`;
    map[name] = (map[name] || 0) + 1;
  });
  return Object.entries(map).map(([name, count]) => ({ name, count })).sort((a,b) => b.count - a.count);
}
