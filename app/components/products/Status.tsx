type PlacementStatus = "location" | "zone" | "missing";

function StatusPill({
  text,
  tone,
}: {
  text: string;
  tone: "ok" | "warning" | "danger";
}) {
  const styles = {
    ok: "border-green-200 bg-green-50 text-green-700",
    warning: "border-[#a77e05]/20 bg-[#a77e05]/10 text-[#a77e05]",
    danger: "border-red-200 bg-red-50 text-red-700",
  };

  return (
    <span
      className={`inline-flex shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${styles[tone]}`}
    >
      {text}
    </span>
  );
}

export default function Status({
  status,
}: {
  status: PlacementStatus;
}) {
  if (status === "missing") {
    return <StatusPill text="Mangler" tone="danger" />;
  }

  if (status === "zone") {
    return <StatusPill text="Har sone" tone="warning" />;
  }

  return <StatusPill text="OK" tone="ok" />;
}