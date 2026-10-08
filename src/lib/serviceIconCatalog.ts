export type ServiceIconAsset = {
  slug: string;
  icon: string;
  url: string;
};

const WEBP_PATH_RE = /^(\/uploads\/service-icons\/[a-z0-9]+(?:-[a-z0-9]+)*\.webp|https?:\/\/[^\s?#]+\/uploads\/service-icons\/[a-z0-9]+(?:-[a-z0-9]+)*\.webp)$/i;

export function isWebpServiceIconPath(value: string | null | undefined): boolean {
  if (!value || typeof value !== "string") return false;
  const trimmed = value.trim();
  if (/\.svg/i.test(trimmed)) return false;
  return WEBP_PATH_RE.test(trimmed);
}

export function iconPathForSlug(slug: string): string {
  return `/uploads/service-icons/${slug.trim()}.webp`;
}

export function slugFromIconPath(iconPath: string | null | undefined): string | null {
  if (!iconPath) return null;
  const match = iconPath.match(/\/uploads\/service-icons\/([^/?#]+)\.webp/i);
  return match ? match[1] : null;
}

/** Human-readable label from kebab-case slug (Spanish-friendly, no overwrite of user names). */
export function readableNameFromSlug(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function resolveIconUrlForSubmit(
  slug: string,
  iconUrl: string,
  assetsBySlug: Map<string, ServiceIconAsset>
): string | null {
  const trimmedIcon = iconUrl.trim();
  if (trimmedIcon) {
    if (!isWebpServiceIconPath(trimmedIcon)) {
      throw new Error("El icono debe ser una ruta WebP /uploads/service-icons/<slug>.webp");
    }
    return trimmedIcon;
  }
  const normalizedSlug = slug.trim().toLowerCase();
  if (!normalizedSlug) return null;
  const asset = assetsBySlug.get(normalizedSlug);
  return asset ? asset.icon : null;
}

export function assetExistsForSlug(slug: string, assetsBySlug: Map<string, ServiceIconAsset>): boolean {
  const key = slug.trim().toLowerCase();
  if (!key) return false;
  return assetsBySlug.has(key);
}
