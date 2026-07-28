type Props = {
  activeProducts: number;
  snakeHealth: number;
};

function PulseChip({
  children,
  ok = true,
}: {
  children: React.ReactNode;
  ok?: boolean;
}) {
  return (
    <div className="inline-flex items-center gap-2 rounded-snake-pill border border-snake-border-on-dark-default bg-snake-app-elevated px-3 py-2 text-[length:var(--snake-text-meta-size)] font-[var(--snake-font-weight-medium)] text-snake-text-on-dark-muted">
      <span
        className={`h-2 w-2 rounded-full ${
          ok ? "bg-snake-success" : "bg-snake-warning"
        }`}
      />
      {children}
    </div>
  );
}

export default function SystemPulseBar({
  activeProducts,
  snakeHealth,
}: Props) {
  return (
    <div
      className="mb-3 flex flex-wrap items-center gap-2"
      aria-label="Operativ lagerstatus"
    >
      <PulseChip>{activeProducts} aktive produkter</PulseChip>
      <PulseChip ok={snakeHealth >= 70}>
        Snake Health {snakeHealth}/100
      </PulseChip>
    </div>
  );
}
