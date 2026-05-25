type PlacementStatus = "location" | "zone" | "missing";

function StatusPill({
  text,
  tone,
}: {
  text: string;
  tone: "ok" | "warning" | "danger";
}) {
  const styles = {
    ok: "border-[#14565b]/30 bg-[#14565b]/10 text-[#14565b]",
    warning: "border-[#a77e05]/25 bg-[#a77e05]/10 text-[#8a6704]",
    danger: "border-[#b45454]/20 bg-[#b45454]/10 text-[#9f3f3f]",
  };

  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] ${styles[tone]}`}
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
    return <StatusPill text="Kun sone" tone="warning" />;
  }

  return <StatusPill text="Plassert" tone="ok" />;
}