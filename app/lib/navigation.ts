export function sanitizeInternalPath(value: string | undefined | null) {
  if (!value) return "";
  const trimmed = value.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return "";
  if (trimmed.includes("\\") || /[\u0000-\u001F\u007F]/.test(trimmed)) return "";
  if (/^\/(?:https?:|javascript:|data:)/i.test(trimmed)) return "";
  return trimmed;
}
