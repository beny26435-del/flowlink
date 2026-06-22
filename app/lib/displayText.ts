const INTERNAL_VERSION_LABELS = [
  /\bFlowLinkV4\b/gi,
  /\bFlowLinkV3\b/gi,
  /\bFlowLinkV2\b/gi,
  /\bFlowLinkV1\b/gi,
  /\bversion\s+4\b/gi,
  /\bversion\s+3\b/gi,
  /\bversion\s+2\b/gi,
  /\bversion\s+1\b/gi,
  /\bv4\b/gi,
  /\bv3\b/gi,
  /\bv2\b/gi,
  /\bv1\b/gi,
  /\blegacy\b/gi,
  /\bmigration\b/gi,
];

export function productText(value: string | undefined | null) {
  if (!value) return "";

  return INTERNAL_VERSION_LABELS.reduce((text, pattern) => text.replace(pattern, "Arclet"), value).replace(
    /smoke-Arclet/gi,
    "smoke"
  );
}
