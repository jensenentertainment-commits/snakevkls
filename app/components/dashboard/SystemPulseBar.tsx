type Props = {
  activeProducts: number;
  emptyLocations: number;
  snakeHealth: number;
  lastSyncOk: boolean;
};

function PulseChip({
  children,
  ok = true,
}: {
  children: React.ReactNode;
  ok?: boolean;
}) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.045] px-3 py-2 text-xs font-medium text-white/70">
      <span
        className={`h-2 w-2 rounded-full ${
          ok ? "bg-emerald-400" : "bg-amber-400"
        }`}
      />
      {children}
    </div>
  );
}

export default function SystemPulseBar({
  activeProducts,
  emptyLocations,
  snakeHealth,
  lastSyncOk,
}: Props) {
  return (
    <div className="mb-5 flex flex-wrap items-center gap-2">
      <PulseChip ok={lastSyncOk}>
        Shopify-sync {lastSyncOk ? "aktiv" : "ustabil"}
      </PulseChip>

      <PulseChip>
        {activeProducts} aktive produkter
      </PulseChip>

      <PulseChip ok={emptyLocations === 0}>
        {emptyLocations} tomme lokasjoner
      </PulseChip>

      <PulseChip ok={snakeHealth >= 70}>
        Snake Health {snakeHealth}/100
      </PulseChip>
    </div>
  );
}