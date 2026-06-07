export function safeJsonStringify(value: unknown) {
  const seen = new WeakSet<object>();

  return JSON.stringify(
    normalizeJsonValue(value, seen),
    (_key, innerValue) => {
      if (typeof innerValue === "bigint") return innerValue.toString();
      if (typeof innerValue === "undefined") return "[undefined]";
      return innerValue;
    },
    2
  ) ?? "[undefined]";
}

function normalizeJsonValue(value: unknown, seen: WeakSet<object>): unknown {
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "undefined") return "[undefined]";
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }
  if (!value || typeof value !== "object") return value;
  if (seen.has(value)) return "[Circular]";

  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => normalizeJsonValue(item, seen));
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, normalizeJsonValue(entry, seen)])
  );
}
