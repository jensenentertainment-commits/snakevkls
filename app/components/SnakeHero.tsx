"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, Search } from "lucide-react";

export default function SnakeHero({
  eyebrow,
  title,
  description,
  searchValue,
  onSearchChange,
  searchPlaceholder,
  backHref,
  backLabel,
  right,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  backHref?: string;
  backLabel?: string;
  right?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="grid min-h-[160px] gap-7 border-t border-white/8 bg-gradient-to-br from-[#055a7d] via-[#063a46] to-[#042834] px-5 py-6 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] sm:px-8 sm:py-7 lg:grid-cols-[1fr_460px] lg:items-start lg:px-10">
      <div>
        {backHref && backLabel && (
          <Link
            href={backHref}
            className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-white/55 transition hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            {backLabel}
          </Link>
        )}

        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/55">
          {eyebrow}
        </p>

        <h1 className="mt-2 text-3xl font-semibold leading-none tracking-tight sm:text-4xl lg:text-[42px]">
          {title}
        </h1>

        <p className="mt-3 max-w-2xl text-sm leading-6 text-white/70">
          {description}
        </p>

        {children && <div className="mt-6">{children}</div>}
      </div>

      {right ? (
        <div className="w-full">{right}</div>
      ) : (
        typeof searchValue === "string" &&
        onSearchChange &&
        searchPlaceholder && (
          <div className="w-full">
            <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-white/50">
              Søk
            </label>

            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-400" />

              <input
                value={searchValue}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full rounded-2xl border border-white/20 bg-white/95 px-12 py-4 text-base font-medium text-neutral-950 shadow-lg outline-none transition placeholder:text-neutral-400 focus:border-[#b58a14]/70 focus:ring-2 focus:ring-[#b58a14]/15 sm:py-3.5 sm:text-sm"
              />
            </div>
          </div>
        )
      )}
    </div>
  );
}