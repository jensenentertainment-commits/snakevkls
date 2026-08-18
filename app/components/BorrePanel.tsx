import Link from "next/link";
import { Info } from "lucide-react";

type BorrePanelVariant = "hero" | "panel" | "note";

type Props = {
  title?: string;
  eyebrow?: string;
  message: string;
  pulse?: string;
  observation?: string;
  actionHref?: string;
  actionLabel?: string;
  variant?: BorrePanelVariant;
};

export default function BorrePanel({
  title = "Børre",
  eyebrow = "Snake Intelligence",
  message,
  pulse,
  observation,
  actionHref,
  actionLabel = "Åpne",
  variant = "panel",
}: Props) {
  const isHero = variant === "hero";

  return (
    <section
      className={[
        "relative overflow-hidden bg-[#04424c] text-white",
        isHero ? "rounded-[28px] px-7 py-6" : "px-6 py-5",
      ].join(" ")}
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#0b6673]/70 via-transparent to-[#062f3b]/40" />

      <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-[#b58a14]">
              {title} / {eyebrow}
            </p>
            <Info className="h-4 w-4 text-emerald-300/70" />
          </div>

          <p className="mt-3 text-base font-semibold leading-6 text-white">
            {message}
          </p>

          {observation ? (
            <p className="mt-2 text-sm leading-6 text-white/65">
              {observation}
            </p>
          ) : null}

          {pulse ? (
            <p className="mt-1 text-xs italic text-white/40">{pulse}</p>
          ) : null}
        </div>

        {actionHref ? (
          <Link
            href={actionHref}
            className="inline-flex shrink-0 items-center justify-center rounded-2xl bg-[#12d6a0] px-5 py-3 text-sm font-black text-[#052f35] shadow-lg shadow-black/25 transition hover:bg-emerald-300"
          >
            {actionLabel} →
          </Link>
        ) : null}
      </div>
    </section>
  );
}
