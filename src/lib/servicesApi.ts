export function getServicesApiBase(): string {
  const base = process.env.NEXT_PUBLIC_SERVICES_API_URL || "https://services-api.flupy.io";
  return base.replace(/\/$/, "");
}

export class ServicesApiError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

export async function servicesFetch<T>(
  path: string,
  options: RequestInit & { token?: string | null } = {}
): Promise<T> {
  const { token, headers, ...rest } = options;
  const url = path.startsWith("http")
    ? path
    : `${getServicesApiBase()}${path.startsWith("/") ? path : `/${path}`}`;
  const h = new Headers(headers);
  const method = (rest.method || "GET").toUpperCase();

  if (rest.body != null && typeof rest.body === "string" && method !== "GET" && method !== "HEAD") {
    h.set("Content-Type", "application/json");
  }
  if (token) h.set("Authorization", `Bearer ${token}`);

  const res = await fetch(url, {
    ...rest,
    headers: h,
    cache: rest.cache ?? "no-store",
  });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const msg =
      typeof data === "object" && data && "error" in data
        ? String((data as { error: string }).error)
        : res.statusText;
    throw new ServicesApiError(msg || "Request failed", res.status, data);
  }

  return data as T;
}
