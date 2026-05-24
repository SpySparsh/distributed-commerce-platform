export const escapeHtml = (value: unknown): string =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

export const toDisplayValue = (value: unknown, fallback = "N/A"): string => {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  return String(value);
};

export const toMoney = (value: unknown): string => {
  if (typeof value === "number") {
    return value.toFixed(2);
  }

  return toDisplayValue(value, "0.00");
};
