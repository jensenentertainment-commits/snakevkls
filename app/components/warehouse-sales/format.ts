export function formatMoney(minor: number) {
  return new Intl.NumberFormat("nb-NO", {
    style: "currency",
    currency: "NOK",
    minimumFractionDigits: 2,
  }).format(minor / 100);
}

export function formatSaleTime(value: string) {
  return new Intl.DateTimeFormat("nb-NO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function formatPaymentMethod(value: "vipps" | "cash") {
  return value === "cash" ? "Kontant" : "Vipps";
}

export function parseMoneyToMinor(value: string) {
  const normalized = value.replace(/\s/g, "").replace(",", ".");
  const number = Number(normalized);
  return Number.isFinite(number) && number >= 0
    ? Math.round(number * 100)
    : -1;
}
