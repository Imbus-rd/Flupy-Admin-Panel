"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ServicesShell } from "@/components/ServicesShell";
import { servicesFetch, ServicesApiError } from "@/lib/servicesApi";
import { useServicesAuth } from "@/lib/ServicesAuthProvider";

type DashboardData = {
  summary: { total_users: number; total_customers: number; total_providers: number; active_users: number };
  orders: { total_orders: number; completed_orders: number; canceled_orders: number; open_orders: number };
  ratings: { global_rating: number | string; total_ratings: number };
  memberships: Array<{ plan: string; membership_status: string; providers: number }>;
  inactive_memberships: { providers_without_active_membership: number };
  top_services: Array<{ id: number; name: string; country: string; total_orders: number }>;
};

type ServiceCategory = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  icon_url: string | null;
  country: string;
  is_active: number;
  sort_order: number;
};

type Plan = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  price_amount: string | number;
  currency: string;
  billing_interval: string;
  service_limit: number | null;
  stripe_price_id: string | null;
  is_active: number;
  sort_order: number;
};

type Provider = {
  user_id: number;
  full_name: string;
  email: string;
  phone: string | null;
  country: string;
  membership_status: string;
  subscription_plan: string | null;
  membership_expires_at: string | null;
  is_available: number;
  average_rating: string | number | null;
  total_ratings: number | null;
  service_count: number;
  service_limit: number | null;
};

type Order = {
  id: number;
  status: string;
  order_mode: string;
  created_at: string;
  service_name: string;
  customer_name: string;
  provider_name: string | null;
  rating: number | null;
};

const tabs = [
  { id: "summary", label: "Resumen" },
  { id: "services", label: "Servicios" },
  { id: "plans", label: "Planes" },
  { id: "providers", label: "Proveedores" },
  { id: "orders", label: "Ordenes" },
];

function numberValue(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-500">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1.5 w-full rounded-xl border border-white/[0.1] bg-[rgba(3,6,14,0.65)] px-3 py-2.5 text-sm text-white outline-none transition focus:border-teal-400/40 focus:ring-2 focus:ring-teal-400/20"
      />
    </label>
  );
}

function ServicesDashboardContent() {
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab") || "summary";
  const { token } = useServicesAuth();

  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [services, setServices] = useState<ServiceCategory[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [serviceForm, setServiceForm] = useState({
    name: "",
    slug: "",
    description: "",
    icon_url: "",
    country: "DR",
    sort_order: "10",
  });
  const [planForm, setPlanForm] = useState({
    name: "",
    slug: "",
    description: "",
    price_amount: "0",
    currency: "USD",
    billing_interval: "month",
    service_limit: "",
    stripe_price_id: "",
    sort_order: "10",
  });

  const metricCards = useMemo(() => {
    if (!dashboard) return [];
    return [
      { label: "Usuarios totales", value: dashboard.summary.total_users },
      { label: "Proveedores", value: dashboard.summary.total_providers },
      { label: "Ordenes generadas", value: dashboard.orders.total_orders },
      { label: "Rating global", value: numberValue(dashboard.ratings.global_rating).toFixed(2) },
      {
        label: "Sin membresia activa",
        value: dashboard.inactive_memberships.providers_without_active_membership,
      },
    ];
  }, [dashboard]);

  async function loadAll() {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [dash, serviceRes, planRes, providerRes, orderRes] = await Promise.all([
        servicesFetch<DashboardData>("/api/admin/dashboard", { token }),
        servicesFetch<{ services: ServiceCategory[] }>("/api/admin/services", { token }),
        servicesFetch<{ plans: Plan[] }>("/api/admin/plans", { token }),
        servicesFetch<{ providers: Provider[] }>("/api/admin/providers?limit=25", { token }),
        servicesFetch<{ orders: Order[] }>("/api/admin/orders?limit=25", { token }),
      ]);
      setDashboard(dash);
      setServices(serviceRes.services || []);
      setPlans(planRes.plans || []);
      setProviders(providerRes.providers || []);
      setOrders(orderRes.orders || []);
    } catch (err) {
      setError(err instanceof ServicesApiError ? err.message : "No se pudo cargar el panel");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function createService(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      await servicesFetch("/api/admin/services", {
        token,
        method: "POST",
        body: JSON.stringify({
          ...serviceForm,
          sort_order: Number(serviceForm.sort_order || 0),
        }),
      });
      setServiceForm({ name: "", slug: "", description: "", icon_url: "", country: "DR", sort_order: "10" });
      await loadAll();
    } catch (err) {
      setError(err instanceof ServicesApiError ? err.message : "No se pudo crear el servicio");
    } finally {
      setSaving(false);
    }
  }

  async function createPlan(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      await servicesFetch("/api/admin/plans", {
        token,
        method: "POST",
        body: JSON.stringify({
          ...planForm,
          price_amount: Number(planForm.price_amount || 0),
          service_limit: planForm.service_limit === "" ? null : Number(planForm.service_limit),
          sort_order: Number(planForm.sort_order || 0),
          is_active: 1,
        }),
      });
      setPlanForm({
        name: "",
        slug: "",
        description: "",
        price_amount: "0",
        currency: "USD",
        billing_interval: "month",
        service_limit: "",
        stripe_price_id: "",
        sort_order: "10",
      });
      await loadAll();
    } catch (err) {
      setError(err instanceof ServicesApiError ? err.message : "No se pudo crear el plan");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ServicesShell>
      <div className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-teal-300/80">Flupy Services</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-white">Panel administrativo</h1>
            <p className="mt-1 text-sm text-slate-500">Operaciones globales para el marketplace de servicios.</p>
          </div>
          <button
            type="button"
            onClick={loadAll}
            className="rounded-xl border border-white/[0.1] bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:border-teal-400/30 hover:bg-white/[0.07]"
          >
            Actualizar
          </button>
        </div>

        {error && <div className="rounded-xl border border-rose-400/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div>}

        <div className="scrollbar-thin flex gap-2 overflow-x-auto rounded-2xl border border-white/[0.07] bg-white/[0.03] p-2">
          {tabs.map((tab) => (
            <a
              key={tab.id}
              href={tab.id === "summary" ? "/services/dashboard" : `/services/dashboard?tab=${tab.id}`}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                activeTab === tab.id ? "bg-teal-400/15 text-teal-100" : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-100"
              }`}
            >
              {tab.label}
            </a>
          ))}
        </div>

        {loading ? (
          <div className="ui-card p-6 text-sm text-slate-500">Cargando datos...</div>
        ) : (
          <>
            {activeTab === "summary" && dashboard && (
              <section className="space-y-5">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                  {metricCards.map((metric) => (
                    <div key={metric.label} className="ui-card rounded-2xl p-4">
                      <p className="text-xs font-medium text-slate-500">{metric.label}</p>
                      <p className="mt-2 text-2xl font-bold tracking-tight text-white">{metric.value}</p>
                    </div>
                  ))}
                </div>

                <div className="grid gap-5 xl:grid-cols-2">
                  <div className="ui-card rounded-2xl p-5">
                    <h2 className="text-base font-semibold text-white">Planes mas usados</h2>
                    <div className="mt-4 space-y-2">
                      {dashboard.memberships.map((item) => (
                        <div key={`${item.plan}-${item.membership_status}`} className="flex items-center justify-between rounded-xl bg-white/[0.03] px-3 py-2 text-sm">
                          <span className="text-slate-300">{item.plan} / {item.membership_status}</span>
                          <span className="font-semibold text-white">{item.providers}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="ui-card rounded-2xl p-5">
                    <h2 className="text-base font-semibold text-white">Servicios con mas ordenes</h2>
                    <div className="mt-4 space-y-2">
                      {dashboard.top_services.map((service) => (
                        <div key={service.id} className="flex items-center justify-between rounded-xl bg-white/[0.03] px-3 py-2 text-sm">
                          <span className="text-slate-300">{service.name}</span>
                          <span className="font-semibold text-white">{service.total_orders}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            )}

            {activeTab === "services" && (
              <section className="grid gap-5 xl:grid-cols-[26rem_1fr]">
                <form onSubmit={createService} className="ui-card h-fit space-y-3 rounded-2xl p-5">
                  <h2 className="text-base font-semibold text-white">Crear servicio</h2>
                  <Field label="Nombre" value={serviceForm.name} onChange={(v) => setServiceForm({ ...serviceForm, name: v })} />
                  <Field label="Slug" value={serviceForm.slug} onChange={(v) => setServiceForm({ ...serviceForm, slug: v })} placeholder="electricity" />
                  <Field label="Descripcion" value={serviceForm.description} onChange={(v) => setServiceForm({ ...serviceForm, description: v })} />
                  <Field label="Icono" value={serviceForm.icon_url} onChange={(v) => setServiceForm({ ...serviceForm, icon_url: v })} placeholder="electricity.png" />
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Pais" value={serviceForm.country} onChange={(v) => setServiceForm({ ...serviceForm, country: v })} />
                    <Field label="Orden" value={serviceForm.sort_order} onChange={(v) => setServiceForm({ ...serviceForm, sort_order: v })} type="number" />
                  </div>
                  <button disabled={saving} className="w-full rounded-xl bg-teal-400 px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-60">
                    Crear servicio
                  </button>
                </form>
                <DataTable
                  columns={["Nombre", "Slug", "Pais", "Activo", "Orden"]}
                  rows={services.map((s) => [s.name, s.slug, s.country, s.is_active ? "Si" : "No", s.sort_order])}
                />
              </section>
            )}

            {activeTab === "plans" && (
              <section className="grid gap-5 xl:grid-cols-[26rem_1fr]">
                <form onSubmit={createPlan} className="ui-card h-fit space-y-3 rounded-2xl p-5">
                  <h2 className="text-base font-semibold text-white">Crear plan</h2>
                  <Field label="Nombre" value={planForm.name} onChange={(v) => setPlanForm({ ...planForm, name: v })} />
                  <Field label="Slug" value={planForm.slug} onChange={(v) => setPlanForm({ ...planForm, slug: v })} placeholder="premium" />
                  <Field label="Descripcion" value={planForm.description} onChange={(v) => setPlanForm({ ...planForm, description: v })} />
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Precio" value={planForm.price_amount} onChange={(v) => setPlanForm({ ...planForm, price_amount: v })} type="number" />
                    <Field label="Moneda" value={planForm.currency} onChange={(v) => setPlanForm({ ...planForm, currency: v })} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Limite servicios" value={planForm.service_limit} onChange={(v) => setPlanForm({ ...planForm, service_limit: v })} placeholder="vacio = ilimitado" />
                    <Field label="Orden" value={planForm.sort_order} onChange={(v) => setPlanForm({ ...planForm, sort_order: v })} type="number" />
                  </div>
                  <Field label="Stripe Price ID" value={planForm.stripe_price_id} onChange={(v) => setPlanForm({ ...planForm, stripe_price_id: v })} />
                  <button disabled={saving} className="w-full rounded-xl bg-teal-400 px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-60">
                    Crear plan
                  </button>
                </form>
                <DataTable
                  columns={["Nombre", "Slug", "Precio", "Limite", "Activo"]}
                  rows={plans.map((p) => [
                    p.name,
                    p.slug,
                    `${p.price_amount} ${p.currency}`,
                    p.service_limit ?? "Ilimitado",
                    p.is_active ? "Si" : "No",
                  ])}
                />
              </section>
            )}

            {activeTab === "providers" && (
              <DataTable
                columns={["Proveedor", "Email", "Plan", "Membresia", "Servicios", "Rating", "Disponible"]}
                rows={providers.map((p) => [
                  p.full_name,
                  p.email,
                  p.subscription_plan || "none",
                  p.membership_status,
                  `${p.service_count}${p.service_limit ? `/${p.service_limit}` : ""}`,
                  numberValue(p.average_rating).toFixed(2),
                  p.is_available ? "Si" : "No",
                ])}
              />
            )}

            {activeTab === "orders" && (
              <DataTable
                columns={["ID", "Estado", "Servicio", "Cliente", "Proveedor", "Rating", "Fecha"]}
                rows={orders.map((o) => [
                  o.id,
                  o.status,
                  o.service_name,
                  o.customer_name,
                  o.provider_name || "Sin asignar",
                  o.rating ?? "-",
                  new Date(o.created_at).toLocaleDateString(),
                ])}
              />
            )}
          </>
        )}
      </div>
    </ServicesShell>
  );
}

export default function ServicesDashboardPage() {
  return (
    <Suspense fallback={<div className="min-h-screen p-8 text-sm text-slate-500">Cargando panel...</div>}>
      <ServicesDashboardContent />
    </Suspense>
  );
}

function DataTable({ columns, rows }: { columns: string[]; rows: Array<Array<React.ReactNode>> }) {
  return (
    <div className="ui-table-wrap overflow-hidden rounded-2xl">
      <div className="scrollbar-thin overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-white/[0.07] bg-white/[0.03] text-xs uppercase tracking-wider text-slate-500">
            <tr>
              {columns.map((column) => (
                <th key={column} className="px-4 py-3 font-semibold">{column}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.06]">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-slate-500">
                  Sin datos
                </td>
              </tr>
            ) : (
              rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="text-slate-300">
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex} className="whitespace-nowrap px-4 py-3">{cell}</td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
