"use client";

import { Search } from "lucide-react";

export default function SnakeHero({
  eyebrow,
  title,
  description,
  searchValue,
  onSearchChange,
  searchPlaceholder,
}: {
  eyebrow: string;
  title: string;
  description: string;
  searchValue?: string;
onSearchChange?: (value: string) => void;
searchPlaceholder?: string;
}) {
 return (
  <div className="grid min-h-[170px] gap-8 bg-gradient-to-br from-[#055a7d] to-[#042834] px-5 py-6 text-white sm:px-8 sm:py-7 lg:grid-cols-[1fr_480px] lg:items-start lg:px-10 lg:py-8">
    <div>
      <p className="text-xs uppercase tracking-[0.22em] text-white/65">
        {eyebrow}
      </p>

      <h1 className="mt-2 text-3xl font-semibold leading-[0.95] tracking-tight sm:text-4xl lg:text-[44px]">
        {title}
      </h1>

      <p className="mt-3 max-w-2xl text-sm leading-6 text-white/75">
        {description}
      </p>
    </div>

    {typeof searchValue === "string" && onSearchChange && searchPlaceholder && (
      <div className="w-full">
        <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-white/60">
          Søk
        </label>

        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-400" />

          <input
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full rounded-2xl border border-white/20 bg-white px-12 py-4 text-base text-neutral-950 shadow-lg outline-none transition focus:border-[#b58a14] sm:py-3.5 sm:text-sm"
          />
        </div>
      </div>
    )}
  </div>
);
}