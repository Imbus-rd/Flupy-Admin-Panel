"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ServiceIcon3DCatalog } from "@/components/ServiceIcon3DCatalog";
import { ServicesShell } from "@/components/ServicesShell";
import { Snackbar } from "@/components/Snackbar";
import { servicesFetch, ServicesApiError } from "@/lib/servicesApi";
import { useServicesAuth } from "@/lib/ServicesAuthProvider";
import {
  assetExistsForSlug,
  isWebpServiceIconPath,
  readableNameFromSlug,
  resolveIconUrlForSubmit,
  type ServiceIconAsset,
} from "@/lib/serviceIconCatalog";

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
  is_regulated?: number;
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
  stripe_product_id?: string | null;
  stripe_lookup_key?: string | null;
  stripe_active?: number;
  synced_from_stripe_at?: string | null;
  is_active: number;
  sort_order: number;
  prices?: Array<{
    billing_interval: string;
    price_amount: string | number;
    currency: string;
    stripe_price_id: string;
    stripe_active: number;
  }>;
};

type Provider = {
  user_id: number;
  full_name: string;
  email: string;
  phone: string | null;
  country: string;
  is_active: number;
  membership_status: string;
  subscription_plan: string | null;
  membership_expires_at: string | null;
  is_available: number;
  average_rating: string | number | null;
  total_ratings: number | null;
  service_count: number;
  service_limit: number | null;
};

type Client = {
  user_id: number;
  full_name: string;
  email: string;
  phone: string | null;
  country: string;
  is_active: number;
  created_at: string;
  order_count: number;
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
  { id: "clients", label: "Clientes" },
  { id: "orders", label: "Ordenes" },
];

const COUNTRY_LABELS: Record<string, string> = {
  DR: "Republica Dominicana",
  DO: "Republica Dominicana",
  US: "Estados Unidos",
  PR: "Puerto Rico",
};

const MEMBERSHIP_STATUSES = ["none", "active", "past_due", "canceled"];

function numberValue(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function planPricesLabel(plan: Plan) {
  if (plan.prices?.length) {
    return (
      <div className="space-y-1">
        {plan.prices.map((price) => (
          <div key={price.stripe_price_id}>
            <span className="font-medium text-slate-200">
              {price.billing_interval === "year" ? "Anual" : "Mensual"}:
            </span>{" "}
            {price.price_amount} {price.currency}
          </div>
        ))}
      </div>
    );
  }

  return `${plan.price_amount} ${plan.currency}`;
}

function planStripeStatus(plan: Plan) {
  const count = plan.prices?.filter((price) => price.stripe_active).length || 0;
  if (count > 0) return `${count} precio${count === 1 ? "" : "s"}`;
  return plan.stripe_price_id ? "Vinculado" : "Sin Stripe";
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
  const [clients, setClients] = useState<Client[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [syncingStripe, setSyncingStripe] = useState(false);
  const [stripeSyncMessage, setStripeSyncMessage] = useState<string | null>(null);
  const [toast, setToast] = useState<{ open: boolean; message: string }>({ open: false, message: "" });
  const [servicesCountry, setServicesCountry] = useState("DR");
  const [providerFilters, setProviderFilters] = useState({
    country: "",
    plan: "",
    membership: "",
    search: "",
  });
  const [clientFilters, setClientFilters] = useState({
    country: "",
    status: "",
    search: "",
  });
  const [providerForm, setProviderForm] = useState({
    name: "",
    email: "",
    password: "",
    plan: "",
    country: "DR",
  });
  const [showProviderCreateModal, setShowProviderCreateModal] = useState(false);
  const [providerMembershipModal, setProviderMembershipModal] = useState<{
    open: boolean;
    provider: Provider | null;
    plan: string;
    membership_status: string;
  }>({
    open: false,
    provider: null,
    plan: "",
    membership_status: "none",
  });
  const [providerDeleteModal, setProviderDeleteModal] = useState<{
    open: boolean;
    provider: Provider | null;
    step: 1 | 2;
  }>({ open: false, provider: null, step: 1 });
  const [clientDeleteModal, setClientDeleteModal] = useState<{
    open: boolean;
    client: Client | null;
    step: 1 | 2;
  }>({ open: false, client: null, step: 1 });
  const [clientOrdersModal, setClientOrdersModal] = useState<{
    open: boolean;
    client: Client | null;
    orders: Order[];
  }>({ open: false, client: null, orders: [] });
  const [editingServiceId, setEditingServiceId] = useState<number | null>(null);
  const [serviceEditForm, setServiceEditForm] = useState({
    name: "",
    slug: "",
    description: "",
    icon_url: "",
    country: "DR",
    sort_order: "0",
    is_active: true,
    is_regulated: false,
  });

  const [serviceForm, setServiceForm] = useState({
    name: "",
    slug: "",
    description: "",
    icon_url: "",
    country: "DR",
    sort_order: "10",
    is_regulated: false,
  });
  const [iconAssets, setIconAssets] = useState<ServiceIconAsset[]>([]);
  const [iconAssetsLoading, setIconAssetsLoading] = useState(false);
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

  const availablePlanOptions = useMemo(() => {
    const dynamic = plans.map((p) => p.slug).filter(Boolean);
    const merged = new Set(["none", ...dynamic]);
    return Array.from(merged);
  }, [plans]);

  const countryOptions = useMemo(() => {
    const merged = new Set<string>(["DR", "US", "PR"]);
    providers.forEach((p) => merged.add(String(p.country || "").toUpperCase()));
    clients.forEach((c) => merged.add(String(c.country || "").toUpperCase()));
    return Array.from(merged).filter(Boolean).sort();
  }, [providers, clients]);

  const assetsBySlug = useMemo(() => {
    const map = new Map<string, ServiceIconAsset>();
    iconAssets.forEach((asset) => map.set(asset.slug.toLowerCase(), asset));
    return map;
  }, [iconAssets]);

  function openToast(message: string) {
    setToast({ open: false, message: "" });
    window.setTimeout(() => setToast({ open: true, message }), 10);
  }

  function toCountryLabel(country: string | null | undefined) {
    const code = String(country || "").toUpperCase();
    return COUNTRY_LABELS[code] || code || "N/A";
  }

  function toCountryFlag(country: string | null | undefined) {
    const code = String(country || "").toUpperCase();
    if (!/^[A-Z]{2}$/.test(code)) return "🏳️";
    return String.fromCodePoint(...code.split("").map((char) => 127397 + char.charCodeAt(0)));
  }

  function buildQuery(params: Record<string, string | number | undefined | null>) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value === null || value === undefined) return;
      const text = String(value).trim();
      if (!text) return;
      query.set(key, text);
    });
    const serialized = query.toString();
    return serialized ? `?${serialized}` : "";
  }

  async function loadAll() {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const providerQuery = buildQuery({
        limit: 200,
        country: providerFilters.country,
        plan: providerFilters.plan,
        membership: providerFilters.membership,
        search: providerFilters.search,
      });
      const clientQuery = buildQuery({
        limit: 200,
        country: clientFilters.country,
        status: clientFilters.status,
        search: clientFilters.search,
      });
      const [dash, serviceRes, planRes, providerRes, clientRes, orderRes] = await Promise.all([
        servicesFetch<DashboardData>("/api/admin/dashboard", { token }),
        servicesFetch<{ categories: ServiceCategory[] }>(`/api/orders/categories?country=${encodeURIComponent(servicesCountry)}`, { token }),
        servicesFetch<{ plans: Plan[] }>("/api/admin/plans", { token }),
        servicesFetch<{ providers: Provider[] }>(`/api/admin/providers${providerQuery}`, { token }),
        servicesFetch<{ clients: Client[] }>(`/api/admin/clients${clientQuery}`, { token }),
        servicesFetch<{ orders: Order[] }>("/api/admin/orders?limit=25", { token }),
      ]);
      setDashboard(dash);
      setServices(serviceRes.categories || []);
      setPlans(planRes.plans || []);
      setProviders(providerRes.providers || []);
      setClients(clientRes.clients || []);
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
  }, [token, servicesCountry]);

  async function loadServiceIcons() {
    if (!token) return;
    setIconAssetsLoading(true);
    try {
      const res = await servicesFetch<{ icons: ServiceIconAsset[]; count: number }>(
        "/api/admin/service-icons",
        { token }
      );
      setIconAssets(res.icons || []);
    } catch {
      setIconAssets([]);
    } finally {
      setIconAssetsLoading(false);
    }
  }

  useEffect(() => {
    if (token && activeTab === "services") {
      loadServiceIcons();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, activeTab]);

  function selectCreateAsset(asset: ServiceIconAsset) {
    setServiceForm((prev) => ({
      ...prev,
      icon_url: asset.icon,
      slug: prev.slug.trim() ? prev.slug : asset.slug,
      name: prev.name.trim() ? prev.name : readableNameFromSlug(asset.slug),
    }));
  }

  function selectEditAsset(asset: ServiceIconAsset) {
    setServiceEditForm((prev) => ({
      ...prev,
      icon_url: asset.icon,
      slug: prev.slug.trim() ? prev.slug : asset.slug,
      name: prev.name.trim() ? prev.name : readableNameFromSlug(asset.slug),
    }));
  }

  function onCreateIconChange(value: string) {
    if (value.trim() && /\.svg/i.test(value)) return;
    setServiceForm((prev) => ({ ...prev, icon_url: value }));
  }

  function onEditIconChange(value: string) {
    if (value.trim() && /\.svg/i.test(value)) return;
    setServiceEditForm((prev) => ({ ...prev, icon_url: value }));
  }

  async function createService(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      const slug = serviceForm.slug.trim();
      let icon_url: string | null;
      try {
        icon_url = resolveIconUrlForSubmit(slug, serviceForm.icon_url, assetsBySlug);
      } catch (iconErr) {
        setError(iconErr instanceof Error ? iconErr.message : "Icono inválido");
        setSaving(false);
        return;
      }
      await servicesFetch("/api/admin/services", {
        token,
        method: "POST",
        body: JSON.stringify({
          ...serviceForm,
          slug,
          icon_url,
          sort_order: Number(serviceForm.sort_order || 0),
          is_regulated: serviceForm.is_regulated ? 1 : 0,
        }),
      });
      setServiceForm({
        name: "",
        slug: "",
        description: "",
        icon_url: "",
        country: "DR",
        sort_order: "10",
        is_regulated: false,
      });
      await loadAll();
    } catch (err) {
      setError(err instanceof ServicesApiError ? err.message : "No se pudo crear el servicio");
    } finally {
      setSaving(false);
    }
  }

  function startServiceEdit(service: ServiceCategory) {
    setEditingServiceId(service.id);
    setServiceEditForm({
      name: service.name || "",
      slug: service.slug || "",
      description: service.description || "",
      icon_url: service.icon_url || "",
      country: service.country || "DR",
      sort_order: String(service.sort_order ?? 0),
      is_active: !!service.is_active,
      is_regulated: !!service.is_regulated,
    });
  }

  function cancelServiceEdit() {
    setEditingServiceId(null);
    setServiceEditForm({
      name: "",
      slug: "",
      description: "",
      icon_url: "",
      country: "DR",
      sort_order: "0",
      is_active: true,
      is_regulated: false,
    });
  }

  async function saveServiceEdit() {
    if (!token || !editingServiceId) return;
    setSaving(true);
    setError(null);
    try {
      const slug = serviceEditForm.slug.trim();
      let icon_url: string | null;
      try {
        icon_url = resolveIconUrlForSubmit(slug, serviceEditForm.icon_url, assetsBySlug);
      } catch (iconErr) {
        setError(iconErr instanceof Error ? iconErr.message : "Icono inválido");
        setSaving(false);
        return;
      }
      await servicesFetch(`/api/admin/services/${editingServiceId}`, {
        token,
        method: "PUT",
        body: JSON.stringify({
          name: serviceEditForm.name,
          slug,
          description: serviceEditForm.description || null,
          icon_url,
          country: serviceEditForm.country,
          sort_order: Number(serviceEditForm.sort_order || 0),
          is_active: serviceEditForm.is_active ? 1 : 0,
          is_regulated: serviceEditForm.is_regulated ? 1 : 0,
        }),
      });
      cancelServiceEdit();
      await loadAll();
    } catch (err) {
      setError(err instanceof ServicesApiError ? err.message : "No se pudo actualizar el servicio");
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

  async function syncStripePlans() {
    if (!token) return;
    setSyncingStripe(true);
    setError(null);
    setStripeSyncMessage(null);
    try {
      const result = await servicesFetch<{ synced_count: number; skipped_count: number }>("/api/admin/plans/sync-stripe", {
        token,
        method: "POST",
        body: JSON.stringify({}),
      });
      setStripeSyncMessage(
        `Stripe sincronizado: ${result.synced_count} planes importados, ${result.skipped_count} productos omitidos por no pertenecer a Flupy Services.`
      );
      await loadAll();
    } catch (err) {
      setError(err instanceof ServicesApiError ? err.message : "No se pudo sincronizar Stripe");
    } finally {
      setSyncingStripe(false);
    }
  }

  async function createProvider(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setActionLoading("create-provider");
    setError(null);
    try {
      await servicesFetch("/api/admin/providers", {
        token,
        method: "POST",
        body: JSON.stringify({
          name: providerForm.name.trim(),
          email: providerForm.email.trim().toLowerCase(),
          password: providerForm.password,
          country: providerForm.country.trim().toUpperCase(),
          plan: providerForm.plan || "none",
        }),
      });
      setShowProviderCreateModal(false);
      setProviderForm({ name: "", email: "", password: "", plan: "", country: "DR" });
      openToast("Proveedor creado correctamente.");
      await loadAll();
    } catch (err) {
      const message = err instanceof ServicesApiError ? err.message : "No se pudo crear el proveedor";
      setError(message);
      openToast(message);
    } finally {
      setActionLoading(null);
    }
  }

  function openMembershipModal(provider: Provider) {
    setProviderMembershipModal({
      open: true,
      provider,
      plan: provider.subscription_plan || "none",
      membership_status: provider.membership_status || "none",
    });
  }

  async function saveProviderMembership() {
    if (!token || !providerMembershipModal.provider) return;
    setActionLoading(`provider-membership-${providerMembershipModal.provider.user_id}`);
    setError(null);
    try {
      await servicesFetch(`/api/admin/providers/${providerMembershipModal.provider.user_id}/membership`, {
        token,
        method: "PATCH",
        body: JSON.stringify({
          plan: providerMembershipModal.plan,
          membership_status: providerMembershipModal.membership_status,
        }),
      });
      setProviderMembershipModal({ open: false, provider: null, plan: "", membership_status: "none" });
      openToast("Membresia actualizada.");
      await loadAll();
    } catch (err) {
      const message = err instanceof ServicesApiError ? err.message : "No se pudo actualizar la membresia";
      setError(message);
      openToast(message);
    } finally {
      setActionLoading(null);
    }
  }

  async function setProviderStatus(provider: Provider, status: "active" | "suspended") {
    if (!token) return;
    const confirmed = window.confirm(
      status === "suspended"
        ? `¿Suspender a ${provider.full_name}?`
        : `¿Activar a ${provider.full_name}?`
    );
    if (!confirmed) return;
    setActionLoading(`provider-status-${provider.user_id}`);
    setError(null);
    try {
      await servicesFetch(`/api/admin/providers/${provider.user_id}/status`, {
        token,
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      openToast(status === "active" ? "Proveedor activado." : "Proveedor suspendido.");
      await loadAll();
    } catch (err) {
      const message = err instanceof ServicesApiError ? err.message : "No se pudo cambiar el estado";
      setError(message);
      openToast(message);
    } finally {
      setActionLoading(null);
    }
  }

  async function deleteProviderConfirmed() {
    if (!token || !providerDeleteModal.provider) return;
    setActionLoading(`provider-delete-${providerDeleteModal.provider.user_id}`);
    setError(null);
    try {
      await servicesFetch(`/api/admin/providers/${providerDeleteModal.provider.user_id}`, {
        token,
        method: "DELETE",
      });
      setProviderDeleteModal({ open: false, provider: null, step: 1 });
      openToast("Proveedor eliminado.");
      await loadAll();
    } catch (err) {
      const message = err instanceof ServicesApiError ? err.message : "No se pudo eliminar el proveedor";
      setError(message);
      openToast(message);
    } finally {
      setActionLoading(null);
    }
  }

  async function resetProviderPassword(provider: Provider) {
    if (!token) return;
    setActionLoading(`provider-reset-${provider.user_id}`);
    setError(null);
    try {
      await servicesFetch(`/api/admin/providers/${provider.user_id}/reset-password`, {
        token,
        method: "POST",
        body: JSON.stringify({}),
      });
      openToast("Se envio email de restablecimiento.");
    } catch (err) {
      const message = err instanceof ServicesApiError ? err.message : "No se pudo enviar el reset";
      setError(message);
      openToast(message);
    } finally {
      setActionLoading(null);
    }
  }

  async function setClientStatus(client: Client, status: "active" | "inactive") {
    if (!token) return;
    const confirmed = window.confirm(
      status === "inactive"
        ? `¿Desactivar a ${client.full_name}?`
        : `¿Activar a ${client.full_name}?`
    );
    if (!confirmed) return;
    setActionLoading(`client-status-${client.user_id}`);
    setError(null);
    try {
      await servicesFetch(`/api/admin/clients/${client.user_id}/status`, {
        token,
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      openToast(status === "active" ? "Cliente activado." : "Cliente desactivado.");
      await loadAll();
    } catch (err) {
      const message = err instanceof ServicesApiError ? err.message : "No se pudo cambiar estado del cliente";
      setError(message);
      openToast(message);
    } finally {
      setActionLoading(null);
    }
  }

  async function deleteClientConfirmed() {
    if (!token || !clientDeleteModal.client) return;
    setActionLoading(`client-delete-${clientDeleteModal.client.user_id}`);
    setError(null);
    try {
      await servicesFetch(`/api/admin/clients/${clientDeleteModal.client.user_id}`, {
        token,
        method: "DELETE",
      });
      setClientDeleteModal({ open: false, client: null, step: 1 });
      openToast("Cliente eliminado.");
      await loadAll();
    } catch (err) {
      const message = err instanceof ServicesApiError ? err.message : "No se pudo eliminar el cliente";
      setError(message);
      openToast(message);
    } finally {
      setActionLoading(null);
    }
  }

  async function resetClientPassword(client: Client) {
    if (!token) return;
    setActionLoading(`client-reset-${client.user_id}`);
    setError(null);
    try {
      await servicesFetch(`/api/admin/clients/${client.user_id}/reset-password`, {
        token,
        method: "POST",
        body: JSON.stringify({}),
      });
      openToast("Se envio email de restablecimiento.");
    } catch (err) {
      const message = err instanceof ServicesApiError ? err.message : "No se pudo enviar el reset";
      setError(message);
      openToast(message);
    } finally {
      setActionLoading(null);
    }
  }

  async function openClientOrders(client: Client) {
    if (!token) return;
    setActionLoading(`client-orders-${client.user_id}`);
    setError(null);
    try {
      const response = await servicesFetch<{ orders: Order[] }>(`/api/admin/clients/${client.user_id}/orders?limit=50`, { token });
      setClientOrdersModal({ open: true, client, orders: response.orders || [] });
    } catch (err) {
      const message = err instanceof ServicesApiError ? err.message : "No se pudieron cargar las ordenes";
      setError(message);
      openToast(message);
    } finally {
      setActionLoading(null);
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
                  <Field
                    label="Slug"
                    value={serviceForm.slug}
                    onChange={(v) => setServiceForm({ ...serviceForm, slug: v })}
                    placeholder="ej. fisioterapia (kebab-case; coincide con el .webp)"
                  />
                  <Field label="Descripcion" value={serviceForm.description} onChange={(v) => setServiceForm({ ...serviceForm, description: v })} />
                  <Field
                    label="Icono (opcional)"
                    value={serviceForm.icon_url}
                    onChange={onCreateIconChange}
                    placeholder="Vacío = asset 3D /uploads/service-icons/<slug>.webp"
                  />
                  {serviceForm.icon_url.trim() && !isWebpServiceIconPath(serviceForm.icon_url) && (
                    <p className="text-xs text-amber-200/90">Usa solo rutas WebP oficiales, no SVG.</p>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Pais" value={serviceForm.country} onChange={(v) => setServiceForm({ ...serviceForm, country: v })} />
                    <Field label="Orden" value={serviceForm.sort_order} onChange={(v) => setServiceForm({ ...serviceForm, sort_order: v })} type="number" />
                  </div>
                  <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-3">
                    <input
                      type="checkbox"
                      checked={serviceForm.is_regulated}
                      onChange={(e) => setServiceForm({ ...serviceForm, is_regulated: e.target.checked })}
                      className="mt-0.5 h-4 w-4 rounded border-white/20 accent-teal-400"
                    />
                    <span className="text-sm leading-snug text-slate-300">
                      <span className="font-medium text-white">Servicio regulado</span>
                      <span className="mt-1 block text-xs text-slate-500">
                        Requiere colegiatura, exequatur o registro profesional al proveedor.
                      </span>
                    </span>
                  </label>
                  <button disabled={saving} className="w-full rounded-xl bg-teal-400 px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-60">
                    Crear servicio
                  </button>
                  <ServiceIcon3DCatalog
                    assets={iconAssets}
                    loading={iconAssetsLoading}
                    selectedIconPath={serviceForm.icon_url}
                    slugForHint={serviceForm.slug}
                    hasAssetForSlug={assetExistsForSlug(serviceForm.slug, assetsBySlug)}
                    onSelect={selectCreateAsset}
                  />
                  {editingServiceId !== null && (
                    <ServiceIcon3DCatalog
                      title="Cambiar asset (edición)"
                      compact
                      assets={iconAssets}
                      loading={iconAssetsLoading}
                      selectedIconPath={serviceEditForm.icon_url}
                      slugForHint={serviceEditForm.slug}
                      hasAssetForSlug={assetExistsForSlug(serviceEditForm.slug, assetsBySlug)}
                      onSelect={selectEditAsset}
                    />
                  )}
                </form>
                <div className="space-y-4">
                  <div className="ui-card flex flex-wrap items-end gap-3 rounded-2xl p-4">
                    <label className="block">
                      <span className="text-xs font-medium text-slate-500">Pais</span>
                      <input
                        value={servicesCountry}
                        onChange={(e) => setServicesCountry(e.target.value.toUpperCase())}
                        className="mt-1.5 w-28 rounded-xl border border-white/[0.1] bg-[rgba(3,6,14,0.65)] px-3 py-2 text-sm text-white outline-none transition focus:border-teal-400/40 focus:ring-2 focus:ring-teal-400/20"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={loadAll}
                      className="rounded-xl border border-white/[0.1] bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:border-teal-400/30 hover:bg-white/[0.07]"
                    >
                      Recargar desde backend
                    </button>
                    <div className="text-sm text-slate-400">Total backend ({servicesCountry}): <span className="font-semibold text-white">{services.length}</span></div>
                  </div>

                  <div className="ui-table-wrap overflow-hidden rounded-2xl">
                    <div className="scrollbar-thin overflow-x-auto">
                      <table className="min-w-full text-left text-sm">
                        <thead className="border-b border-white/[0.07] bg-white/[0.03] text-xs uppercase tracking-wider text-slate-500">
                          <tr>
                            <th className="px-4 py-3 font-semibold">Nombre</th>
                            <th className="px-4 py-3 font-semibold">Slug</th>
                            <th className="px-4 py-3 font-semibold">Icono</th>
                            <th className="px-4 py-3 font-semibold">Pais</th>
                            <th className="px-4 py-3 font-semibold">Activo</th>
                            <th className="px-4 py-3 font-semibold">Regulado</th>
                            <th className="px-4 py-3 font-semibold">Orden</th>
                            <th className="px-4 py-3 font-semibold">Acciones</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.06]">
                          {services.length === 0 ? (
                            <tr>
                              <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                                Sin servicios para {servicesCountry}
                              </td>
                            </tr>
                          ) : (
                            services.map((s) => {
                              const editing = editingServiceId === s.id;
                              return (
                                <tr key={s.id} className="text-slate-300">
                                  <td className="px-4 py-3">
                                    {editing ? (
                                      <input value={serviceEditForm.name} onChange={(e) => setServiceEditForm({ ...serviceEditForm, name: e.target.value })} className="w-44 rounded-lg border border-white/[0.12] bg-transparent px-2 py-1 text-sm text-white" />
                                    ) : s.name}
                                  </td>
                                  <td className="px-4 py-3">
                                    {editing ? (
                                      <input value={serviceEditForm.slug} onChange={(e) => setServiceEditForm({ ...serviceEditForm, slug: e.target.value })} className="w-44 rounded-lg border border-white/[0.12] bg-transparent px-2 py-1 text-sm text-white" />
                                    ) : s.slug}
                                  </td>
                                  <td className="px-4 py-3">
                                    {editing ? (
                                      <input value={serviceEditForm.icon_url} onChange={(e) => onEditIconChange(e.target.value)} className="w-48 rounded-lg border border-white/[0.12] bg-transparent px-2 py-1 text-sm text-white" />
                                    ) : (s.icon_url || "-")}
                                  </td>
                                  <td className="px-4 py-3">
                                    {editing ? (
                                      <input value={serviceEditForm.country} onChange={(e) => setServiceEditForm({ ...serviceEditForm, country: e.target.value.toUpperCase() })} className="w-16 rounded-lg border border-white/[0.12] bg-transparent px-2 py-1 text-sm text-white" />
                                    ) : s.country}
                                  </td>
                                  <td className="px-4 py-3">
                                    {editing ? (
                                      <select
                                        value={serviceEditForm.is_active ? "1" : "0"}
                                        onChange={(e) => setServiceEditForm({ ...serviceEditForm, is_active: e.target.value === "1" })}
                                        className="rounded-lg border border-white/[0.12] bg-transparent px-2 py-1 text-sm text-white"
                                      >
                                        <option value="1">Si</option>
                                        <option value="0">No</option>
                                      </select>
                                    ) : (s.is_active ? "Si" : "No")}
                                  </td>
                                  <td className="px-4 py-3">
                                    {editing ? (
                                      <select
                                        value={serviceEditForm.is_regulated ? "1" : "0"}
                                        onChange={(e) => setServiceEditForm({ ...serviceEditForm, is_regulated: e.target.value === "1" })}
                                        className="rounded-lg border border-white/[0.12] bg-transparent px-2 py-1 text-sm text-white"
                                      >
                                        <option value="1">Si</option>
                                        <option value="0">No</option>
                                      </select>
                                    ) : (
                                      s.is_regulated ? (
                                        <span className="rounded-md bg-amber-400/15 px-2 py-0.5 text-xs font-semibold text-amber-200">Si</span>
                                      ) : (
                                        <span className="text-slate-500">No</span>
                                      )
                                    )}
                                  </td>
                                  <td className="px-4 py-3">
                                    {editing ? (
                                      <input value={serviceEditForm.sort_order} type="number" onChange={(e) => setServiceEditForm({ ...serviceEditForm, sort_order: e.target.value })} className="w-20 rounded-lg border border-white/[0.12] bg-transparent px-2 py-1 text-sm text-white" />
                                    ) : s.sort_order}
                                  </td>
                                  <td className="px-4 py-3">
                                    {editing ? (
                                      <div className="flex gap-2">
                                        <button type="button" onClick={saveServiceEdit} disabled={saving} className="rounded-lg bg-emerald-500 px-3 py-1 text-xs font-semibold text-slate-950 disabled:opacity-60">Guardar</button>
                                        <button type="button" onClick={cancelServiceEdit} className="rounded-lg border border-white/[0.12] px-3 py-1 text-xs font-semibold text-slate-200">Cancelar</button>
                                      </div>
                                    ) : (
                                      <button type="button" onClick={() => startServiceEdit(s)} className="rounded-lg border border-teal-400/35 px-3 py-1 text-xs font-semibold text-teal-200 hover:bg-teal-400/10">Editar</button>
                                    )}
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {activeTab === "plans" && (
              <section className="grid gap-5 xl:grid-cols-[26rem_1fr]">
                <form onSubmit={createPlan} className="ui-card h-fit space-y-3 rounded-2xl p-5">
                  <div>
                    <h2 className="text-base font-semibold text-white">Planes y Stripe</h2>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500">
                      Stripe es la fuente del precio real. Solo se importan productos/precios con metadata flupy_catalog=services.
                    </p>
                  </div>
                  {stripeSyncMessage && (
                    <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs leading-relaxed text-emerald-100">
                      {stripeSyncMessage}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={syncStripePlans}
                    disabled={syncingStripe}
                    className="w-full rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-teal-500/20 transition disabled:opacity-60"
                  >
                    {syncingStripe ? "Sincronizando..." : "Sincronizar desde Stripe"}
                  </button>
                  <div className="border-t border-white/[0.07] pt-3">
                    <h3 className="text-sm font-semibold text-slate-300">Plan manual temporal</h3>
                  </div>
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
                  columns={["Nombre", "Slug", "Precio", "Limite", "Stripe", "Activo"]}
                  rows={plans.map((p) => [
                    p.name,
                    p.slug,
                    planPricesLabel(p),
                    p.service_limit ?? "Ilimitado",
                    planStripeStatus(p),
                    p.is_active ? "Si" : "No",
                  ])}
                />
              </section>
            )}

            {activeTab === "providers" && (
              <section className="space-y-4">
                <div className="ui-card rounded-2xl p-4">
                  <div className="flex flex-wrap items-end gap-3">
                    <label className="block">
                      <span className="text-xs font-medium text-slate-500">Filtrar por pais</span>
                      <select
                        value={providerFilters.country}
                        onChange={(e) => setProviderFilters((prev) => ({ ...prev, country: e.target.value }))}
                        className="mt-1.5 w-40 rounded-xl border border-white/[0.1] bg-[rgba(3,6,14,0.65)] px-3 py-2 text-sm text-white outline-none transition focus:border-teal-400/40 focus:ring-2 focus:ring-teal-400/20"
                      >
                        <option value="">Todos</option>
                        {countryOptions.map((countryCode) => (
                          <option key={countryCode} value={countryCode}>
                            {toCountryFlag(countryCode)} {toCountryLabel(countryCode)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="text-xs font-medium text-slate-500">Plan</span>
                      <select
                        value={providerFilters.plan}
                        onChange={(e) => setProviderFilters((prev) => ({ ...prev, plan: e.target.value }))}
                        className="mt-1.5 w-36 rounded-xl border border-white/[0.1] bg-[rgba(3,6,14,0.65)] px-3 py-2 text-sm text-white outline-none transition focus:border-teal-400/40 focus:ring-2 focus:ring-teal-400/20"
                      >
                        <option value="">Todos</option>
                        {availablePlanOptions.map((planSlug) => (
                          <option key={planSlug} value={planSlug}>
                            {planSlug}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="text-xs font-medium text-slate-500">Membresia</span>
                      <select
                        value={providerFilters.membership}
                        onChange={(e) => setProviderFilters((prev) => ({ ...prev, membership: e.target.value }))}
                        className="mt-1.5 w-36 rounded-xl border border-white/[0.1] bg-[rgba(3,6,14,0.65)] px-3 py-2 text-sm text-white outline-none transition focus:border-teal-400/40 focus:ring-2 focus:ring-teal-400/20"
                      >
                        <option value="">Todas</option>
                        {MEMBERSHIP_STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block flex-1 min-w-[14rem]">
                      <span className="text-xs font-medium text-slate-500">Buscar nombre o email</span>
                      <input
                        value={providerFilters.search}
                        onChange={(e) => setProviderFilters((prev) => ({ ...prev, search: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            void loadAll();
                          }
                        }}
                        className="mt-1.5 w-full rounded-xl border border-white/[0.1] bg-[rgba(3,6,14,0.65)] px-3 py-2 text-sm text-white outline-none transition focus:border-teal-400/40 focus:ring-2 focus:ring-teal-400/20"
                        placeholder="nombre@correo.com"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={loadAll}
                      className="rounded-xl border border-white/[0.1] bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:border-teal-400/30 hover:bg-white/[0.07]"
                    >
                      Aplicar filtros
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowProviderCreateModal(true)}
                      className="rounded-xl bg-teal-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-teal-300"
                    >
                      Crear Proveedor
                    </button>
                  </div>
                </div>

                <div className="ui-table-wrap overflow-hidden rounded-2xl">
                  <div className="scrollbar-thin overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead className="border-b border-white/[0.07] bg-white/[0.03] text-xs uppercase tracking-wider text-slate-500">
                        <tr>
                          <th className="px-4 py-3 font-semibold">Proveedor</th>
                          <th className="px-4 py-3 font-semibold">Email</th>
                          <th className="px-4 py-3 font-semibold">Pais</th>
                          <th className="px-4 py-3 font-semibold">Plan</th>
                          <th className="px-4 py-3 font-semibold">Membresia</th>
                          <th className="px-4 py-3 font-semibold">Servicios</th>
                          <th className="px-4 py-3 font-semibold">Rating</th>
                          <th className="px-4 py-3 font-semibold">Estado</th>
                          <th className="px-4 py-3 font-semibold">Disponible</th>
                          <th className="px-4 py-3 font-semibold">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.06]">
                        {providers.length === 0 ? (
                          <tr>
                            <td colSpan={10} className="px-4 py-8 text-center text-slate-500">
                              Sin proveedores
                            </td>
                          </tr>
                        ) : (
                          providers.map((p) => (
                            <tr key={p.user_id} className="text-slate-300">
                              <td className="whitespace-nowrap px-4 py-3 font-medium text-white">{p.full_name}</td>
                              <td className="whitespace-nowrap px-4 py-3">{p.email}</td>
                              <td className="whitespace-nowrap px-4 py-3">
                                {toCountryFlag(p.country)} {toCountryLabel(p.country)}
                              </td>
                              <td className="whitespace-nowrap px-4 py-3">{p.subscription_plan || "none"}</td>
                              <td className="whitespace-nowrap px-4 py-3">{p.membership_status}</td>
                              <td className="whitespace-nowrap px-4 py-3">{`${p.service_count}${p.service_limit ? `/${p.service_limit}` : ""}`}</td>
                              <td className="whitespace-nowrap px-4 py-3">{numberValue(p.average_rating).toFixed(2)}</td>
                              <td className="whitespace-nowrap px-4 py-3">
                                <span className={`rounded-full px-2 py-1 text-xs ${p.is_active ? "bg-emerald-400/15 text-emerald-200" : "bg-rose-500/15 text-rose-200"}`}>
                                  {p.is_active ? "Activo" : "Suspendido"}
                                </span>
                              </td>
                              <td className="whitespace-nowrap px-4 py-3">{p.is_available ? "Si" : "No"}</td>
                              <td className="px-4 py-3">
                                <div className="flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    onClick={() => openMembershipModal(p)}
                                    className="rounded-lg border border-teal-400/35 px-2.5 py-1 text-xs font-semibold text-teal-200 hover:bg-teal-400/10"
                                  >
                                    Membresia
                                  </button>
                                  {p.is_active ? (
                                    <button
                                      type="button"
                                      disabled={actionLoading === `provider-status-${p.user_id}`}
                                      onClick={() => void setProviderStatus(p, "suspended")}
                                      className="rounded-lg border border-amber-400/35 px-2.5 py-1 text-xs font-semibold text-amber-200 hover:bg-amber-400/10 disabled:opacity-60"
                                    >
                                      Suspender
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      disabled={actionLoading === `provider-status-${p.user_id}`}
                                      onClick={() => void setProviderStatus(p, "active")}
                                      className="rounded-lg border border-emerald-400/35 px-2.5 py-1 text-xs font-semibold text-emerald-200 hover:bg-emerald-400/10 disabled:opacity-60"
                                    >
                                      Activar
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    disabled={actionLoading === `provider-reset-${p.user_id}`}
                                    onClick={() => void resetProviderPassword(p)}
                                    className="rounded-lg border border-sky-400/35 px-2.5 py-1 text-xs font-semibold text-sky-200 hover:bg-sky-400/10 disabled:opacity-60"
                                  >
                                    Reset
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setProviderDeleteModal({ open: true, provider: p, step: 1 })}
                                    className="rounded-lg border border-rose-500/35 px-2.5 py-1 text-xs font-semibold text-rose-200 hover:bg-rose-500/10"
                                  >
                                    Eliminar
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            )}

            {activeTab === "clients" && (
              <section className="space-y-4">
                <div className="ui-card rounded-2xl p-4">
                  <div className="flex flex-wrap items-end gap-3">
                    <label className="block">
                      <span className="text-xs font-medium text-slate-500">Filtrar por pais</span>
                      <select
                        value={clientFilters.country}
                        onChange={(e) => setClientFilters((prev) => ({ ...prev, country: e.target.value }))}
                        className="mt-1.5 w-40 rounded-xl border border-white/[0.1] bg-[rgba(3,6,14,0.65)] px-3 py-2 text-sm text-white outline-none transition focus:border-teal-400/40 focus:ring-2 focus:ring-teal-400/20"
                      >
                        <option value="">Todos</option>
                        {countryOptions.map((countryCode) => (
                          <option key={countryCode} value={countryCode}>
                            {toCountryFlag(countryCode)} {toCountryLabel(countryCode)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="text-xs font-medium text-slate-500">Estado</span>
                      <select
                        value={clientFilters.status}
                        onChange={(e) => setClientFilters((prev) => ({ ...prev, status: e.target.value }))}
                        className="mt-1.5 w-36 rounded-xl border border-white/[0.1] bg-[rgba(3,6,14,0.65)] px-3 py-2 text-sm text-white outline-none transition focus:border-teal-400/40 focus:ring-2 focus:ring-teal-400/20"
                      >
                        <option value="">Todos</option>
                        <option value="active">Activos</option>
                        <option value="inactive">Inactivos</option>
                      </select>
                    </label>
                    <label className="block flex-1 min-w-[14rem]">
                      <span className="text-xs font-medium text-slate-500">Buscar nombre o email</span>
                      <input
                        value={clientFilters.search}
                        onChange={(e) => setClientFilters((prev) => ({ ...prev, search: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            void loadAll();
                          }
                        }}
                        className="mt-1.5 w-full rounded-xl border border-white/[0.1] bg-[rgba(3,6,14,0.65)] px-3 py-2 text-sm text-white outline-none transition focus:border-teal-400/40 focus:ring-2 focus:ring-teal-400/20"
                        placeholder="nombre@correo.com"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={loadAll}
                      className="rounded-xl border border-white/[0.1] bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:border-teal-400/30 hover:bg-white/[0.07]"
                    >
                      Aplicar filtros
                    </button>
                  </div>
                </div>
                <div className="ui-table-wrap overflow-hidden rounded-2xl">
                  <div className="scrollbar-thin overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead className="border-b border-white/[0.07] bg-white/[0.03] text-xs uppercase tracking-wider text-slate-500">
                        <tr>
                          <th className="px-4 py-3 font-semibold">Cliente</th>
                          <th className="px-4 py-3 font-semibold">Email</th>
                          <th className="px-4 py-3 font-semibold">Fecha registro</th>
                          <th className="px-4 py-3 font-semibold">Pais</th>
                          <th className="px-4 py-3 font-semibold">Estado</th>
                          <th className="px-4 py-3 font-semibold">Ordenes</th>
                          <th className="px-4 py-3 font-semibold">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.06]">
                        {clients.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="px-4 py-8 text-center text-slate-500">Sin clientes</td>
                          </tr>
                        ) : (
                          clients.map((c) => (
                            <tr key={c.user_id} className="text-slate-300">
                              <td className="whitespace-nowrap px-4 py-3 font-medium text-white">{c.full_name}</td>
                              <td className="whitespace-nowrap px-4 py-3">{c.email}</td>
                              <td className="whitespace-nowrap px-4 py-3">{new Date(c.created_at).toLocaleDateString()}</td>
                              <td className="whitespace-nowrap px-4 py-3">{toCountryFlag(c.country)} {toCountryLabel(c.country)}</td>
                              <td className="whitespace-nowrap px-4 py-3">
                                <span className={`rounded-full px-2 py-1 text-xs ${c.is_active ? "bg-emerald-400/15 text-emerald-200" : "bg-rose-500/15 text-rose-200"}`}>
                                  {c.is_active ? "Activo" : "Inactivo"}
                                </span>
                              </td>
                              <td className="whitespace-nowrap px-4 py-3">{numberValue(c.order_count)}</td>
                              <td className="px-4 py-3">
                                <div className="flex flex-wrap gap-2">
                                  {c.is_active ? (
                                    <button
                                      type="button"
                                      disabled={actionLoading === `client-status-${c.user_id}`}
                                      onClick={() => void setClientStatus(c, "inactive")}
                                      className="rounded-lg border border-amber-400/35 px-2.5 py-1 text-xs font-semibold text-amber-200 hover:bg-amber-400/10 disabled:opacity-60"
                                    >
                                      Desactivar
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      disabled={actionLoading === `client-status-${c.user_id}`}
                                      onClick={() => void setClientStatus(c, "active")}
                                      className="rounded-lg border border-emerald-400/35 px-2.5 py-1 text-xs font-semibold text-emerald-200 hover:bg-emerald-400/10 disabled:opacity-60"
                                    >
                                      Activar
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    disabled={actionLoading === `client-reset-${c.user_id}`}
                                    onClick={() => void resetClientPassword(c)}
                                    className="rounded-lg border border-sky-400/35 px-2.5 py-1 text-xs font-semibold text-sky-200 hover:bg-sky-400/10 disabled:opacity-60"
                                  >
                                    Reset
                                  </button>
                                  <button
                                    type="button"
                                    disabled={actionLoading === `client-orders-${c.user_id}`}
                                    onClick={() => void openClientOrders(c)}
                                    className="rounded-lg border border-violet-400/35 px-2.5 py-1 text-xs font-semibold text-violet-200 hover:bg-violet-400/10 disabled:opacity-60"
                                  >
                                    Ver ordenes
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setClientDeleteModal({ open: true, client: c, step: 1 })}
                                    className="rounded-lg border border-rose-500/35 px-2.5 py-1 text-xs font-semibold text-rose-200 hover:bg-rose-500/10"
                                  >
                                    Eliminar
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
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

        {showProviderCreateModal && (
          <ModalShell
            title="Crear proveedor"
            onClose={() => setShowProviderCreateModal(false)}
          >
            <form onSubmit={createProvider} className="space-y-3">
              <Field label="Nombre" value={providerForm.name} onChange={(v) => setProviderForm((prev) => ({ ...prev, name: v }))} />
              <Field label="Email" value={providerForm.email} onChange={(v) => setProviderForm((prev) => ({ ...prev, email: v }))} type="email" />
              <Field label="Contrasena temporal" value={providerForm.password} onChange={(v) => setProviderForm((prev) => ({ ...prev, password: v }))} />
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-medium text-slate-500">Plan</span>
                  <select
                    value={providerForm.plan}
                    onChange={(e) => setProviderForm((prev) => ({ ...prev, plan: e.target.value }))}
                    className="mt-1.5 w-full rounded-xl border border-white/[0.1] bg-[rgba(3,6,14,0.65)] px-3 py-2.5 text-sm text-white outline-none transition focus:border-teal-400/40 focus:ring-2 focus:ring-teal-400/20"
                  >
                    {availablePlanOptions.map((planSlug) => (
                      <option key={planSlug} value={planSlug === "none" ? "" : planSlug}>
                        {planSlug}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-slate-500">Pais</span>
                  <select
                    value={providerForm.country}
                    onChange={(e) => setProviderForm((prev) => ({ ...prev, country: e.target.value }))}
                    className="mt-1.5 w-full rounded-xl border border-white/[0.1] bg-[rgba(3,6,14,0.65)] px-3 py-2.5 text-sm text-white outline-none transition focus:border-teal-400/40 focus:ring-2 focus:ring-teal-400/20"
                  >
                    {countryOptions.map((countryCode) => (
                      <option key={countryCode} value={countryCode}>
                        {toCountryFlag(countryCode)} {toCountryLabel(countryCode)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowProviderCreateModal(false)} className="rounded-lg border border-white/[0.12] px-3 py-1.5 text-sm text-slate-200">
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading === "create-provider"}
                  className="rounded-lg bg-teal-400 px-3 py-1.5 text-sm font-semibold text-slate-950 disabled:opacity-60"
                >
                  {actionLoading === "create-provider" ? "Guardando..." : "Crear proveedor"}
                </button>
              </div>
            </form>
          </ModalShell>
        )}

        {providerMembershipModal.open && providerMembershipModal.provider && (
          <ModalShell
            title={`Asignar membresia · ${providerMembershipModal.provider.full_name}`}
            onClose={() => setProviderMembershipModal({ open: false, provider: null, plan: "", membership_status: "none" })}
          >
            <div className="space-y-3">
              <label className="block">
                <span className="text-xs font-medium text-slate-500">Plan</span>
                <select
                  value={providerMembershipModal.plan}
                  onChange={(e) => setProviderMembershipModal((prev) => ({ ...prev, plan: e.target.value }))}
                  className="mt-1.5 w-full rounded-xl border border-white/[0.1] bg-[rgba(3,6,14,0.65)] px-3 py-2.5 text-sm text-white outline-none transition focus:border-teal-400/40 focus:ring-2 focus:ring-teal-400/20"
                >
                  {availablePlanOptions.map((planSlug) => (
                    <option key={planSlug} value={planSlug}>
                      {planSlug}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-500">Estado membresia</span>
                <select
                  value={providerMembershipModal.membership_status}
                  onChange={(e) => setProviderMembershipModal((prev) => ({ ...prev, membership_status: e.target.value }))}
                  className="mt-1.5 w-full rounded-xl border border-white/[0.1] bg-[rgba(3,6,14,0.65)] px-3 py-2.5 text-sm text-white outline-none transition focus:border-teal-400/40 focus:ring-2 focus:ring-teal-400/20"
                >
                  {MEMBERSHIP_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setProviderMembershipModal({ open: false, provider: null, plan: "", membership_status: "none" })}
                  className="rounded-lg border border-white/[0.12] px-3 py-1.5 text-sm text-slate-200"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={actionLoading === `provider-membership-${providerMembershipModal.provider.user_id}`}
                  onClick={() => void saveProviderMembership()}
                  className="rounded-lg bg-teal-400 px-3 py-1.5 text-sm font-semibold text-slate-950 disabled:opacity-60"
                >
                  Guardar
                </button>
              </div>
            </div>
          </ModalShell>
        )}

        {providerDeleteModal.open && providerDeleteModal.provider && (
          <DangerModal
            title={providerDeleteModal.step === 1 ? `¿Suspender y eliminar a ${providerDeleteModal.provider.full_name}?` : "Confirmacion final"}
            description={
              providerDeleteModal.step === 1
                ? "Esta accion desactivara la cuenta del proveedor."
                : "Esta accion es irreversible. ¿Eliminar proveedor?"
            }
            confirmLabel={providerDeleteModal.step === 1 ? "Continuar" : "Eliminar"}
            loading={actionLoading === `provider-delete-${providerDeleteModal.provider.user_id}`}
            onCancel={() => setProviderDeleteModal({ open: false, provider: null, step: 1 })}
            onConfirm={() => {
              if (providerDeleteModal.step === 1) {
                setProviderDeleteModal((prev) => ({ ...prev, step: 2 }));
                return;
              }
              void deleteProviderConfirmed();
            }}
          />
        )}

        {clientDeleteModal.open && clientDeleteModal.client && (
          <DangerModal
            title={clientDeleteModal.step === 1 ? `¿Eliminar a ${clientDeleteModal.client.full_name}?` : "Confirmacion final"}
            description={
              clientDeleteModal.step === 1
                ? "La cuenta del cliente quedara desactivada inmediatamente."
                : "Esta accion es irreversible. ¿Eliminar cliente?"
            }
            confirmLabel={clientDeleteModal.step === 1 ? "Continuar" : "Eliminar"}
            loading={actionLoading === `client-delete-${clientDeleteModal.client.user_id}`}
            onCancel={() => setClientDeleteModal({ open: false, client: null, step: 1 })}
            onConfirm={() => {
              if (clientDeleteModal.step === 1) {
                setClientDeleteModal((prev) => ({ ...prev, step: 2 }));
                return;
              }
              void deleteClientConfirmed();
            }}
          />
        )}

        {clientOrdersModal.open && clientOrdersModal.client && (
          <ModalShell
            title={`Ordenes de ${clientOrdersModal.client.full_name}`}
            onClose={() => setClientOrdersModal({ open: false, client: null, orders: [] })}
          >
            <div className="max-h-[55vh] space-y-2 overflow-y-auto pr-1">
              {clientOrdersModal.orders.length === 0 ? (
                <p className="text-sm text-slate-400">Este cliente no tiene ordenes.</p>
              ) : (
                clientOrdersModal.orders.map((o) => (
                  <div key={o.id} className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="font-semibold text-white">#{o.id}</span>
                      <span className="text-slate-300">{o.status}</span>
                    </div>
                    <p className="mt-1 text-sm text-slate-300">{o.service_name}</p>
                    <p className="mt-1 text-xs text-slate-500">{new Date(o.created_at).toLocaleString()}</p>
                  </div>
                ))
              )}
            </div>
          </ModalShell>
        )}

        <Snackbar
          open={toast.open}
          message={toast.message}
          placement="top-end"
          onClose={() => setToast({ open: false, message: "" })}
          durationMs={3500}
        />
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

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-2xl border border-white/[0.12] bg-[#0b1324] p-5 shadow-2xl shadow-black/50">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-white">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/[0.12] px-2.5 py-1 text-xs text-slate-300 hover:bg-white/[0.05]"
          >
            Cerrar
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function DangerModal({
  title,
  description,
  confirmLabel,
  onCancel,
  onConfirm,
  loading = false,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
  loading?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-rose-500/35 bg-[#2a0f16] p-5 shadow-2xl shadow-rose-900/40">
        <h3 className="text-base font-semibold text-rose-100">{title}</h3>
        <p className="mt-2 text-sm text-rose-200/90">{description}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-white/[0.15] px-3 py-1.5 text-sm text-slate-200"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            className="rounded-lg bg-rose-500 px-3 py-1.5 text-sm font-semibold text-rose-50 disabled:opacity-60"
          >
            {loading ? "Procesando..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
