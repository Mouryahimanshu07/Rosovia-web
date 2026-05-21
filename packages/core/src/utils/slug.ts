/**
 * Generates a URL-safe slug from a display name.
 *
 * "Ravi Clay Artist" → "ravi-clay-artist"
 */
export function generateSlug(displayName: string): string {
  return displayName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '') // remove non-alphanumeric (keep spaces and hyphens)
    .replace(/\s+/g, '-')          // spaces → hyphens
    .replace(/-+/g, '-')           // collapse repeated hyphens
    .replace(/^-|-$/g, '')         // trim leading/trailing hyphens
    .slice(0, 60);                 // max 60 chars
}

/**
 * Splits a comma-separated string into a trimmed, non-empty string array.
 * Used for skills and languages inputs.
 *
 * "Pottery, Sculpture, " → ["Pottery", "Sculpture"]
 */
export function parseCommaSeparated(value: string | null | undefined): string[] {
  if (!value) return [];
  const items = value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return Array.from(new Set(items));
}
