"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, Search } from "lucide-react";

export type LagerHeroProps = {
  backHref?: string;
  backLabel?: string;
  children?: ReactNode;
  description: string;
  eyebrow: string;
  onSearchChange?: (value: string) => void;
  right?: ReactNode;
  searchPlaceholder?: string;
  searchValue?: string;
  title: string;
};

export function LagerHero({
  backHref,
  backLabel,
  children,
  description,
  eyebrow,
  onSearchChange,
  right,
  searchPlaceholder,
  searchValue,
  title,
}: LagerHeroProps) {
  const hasSearch =
    typeof searchValue === "string" &&
    onSearchChange !== undefined &&
    searchPlaceholder !== undefined;

  return (
    <div className="grid min-h-40 gap-7 border-t border-snake-border-on-dark-subtle bg-snake-hero px-5 py-6 text-snake-text-on-dark shadow-snake-card sm:px-8 sm:py-7 lg:grid-cols-[1fr_460px] lg:items-start lg:px-10">
      <div>
        {backHref && backLabel ? (
          <Link
            className="mb-6 inline-flex items-center gap-2 rounded-snake-sm text-[length:var(--snake-text-body-small-size)] font-[var(--snake-font-weight-medium)] text-snake-text-on-dark-muted transition-colors hover:text-snake-text-on-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-snake-focus-on-dark"
            href={backHref}
          >
            <ArrowLeft aria-hidden="true" size={16} />
            {backLabel}
          </Link>
        ) : null}

        <p className="text-[length:var(--snake-text-eyebrow-size)] font-[var(--snake-font-weight-semibold)] uppercase leading-[var(--snake-text-eyebrow-line-height)] tracking-[var(--snake-text-eyebrow-tracking)] text-snake-text-on-dark-muted">
          {eyebrow}
        </p>
        <h1 className="mt-2 text-[length:var(--snake-text-display-page-mobile-size)] font-[var(--snake-font-weight-semibold)] leading-[var(--snake-text-display-page-mobile-line-height)] sm:text-[length:var(--snake-text-display-page-size)] sm:leading-[var(--snake-text-display-page-line-height)]">
          {title}
        </h1>
        <p className="mt-3 max-w-2xl text-[length:var(--snake-text-body-small-size)] leading-[var(--snake-text-body-small-line-height)] text-snake-text-on-dark-muted">
          {description}
        </p>
        {children ? <div className="mt-6">{children}</div> : null}
      </div>

      {right ? (
        <div className="w-full">{right}</div>
      ) : hasSearch ? (
        <label className="block w-full">
          <span className="mb-2 block text-[length:var(--snake-text-eyebrow-size)] font-[var(--snake-font-weight-semibold)] uppercase leading-[var(--snake-text-eyebrow-line-height)] tracking-[var(--snake-text-eyebrow-tracking)] text-snake-text-on-dark-muted">
            Søk
          </span>
          <span className="relative block">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-snake-text-muted"
              size={20}
            />
            <input
              className="w-full rounded-snake-control border border-snake-border-default bg-snake-surface px-12 py-4 text-[length:var(--snake-text-body-size)] font-[var(--snake-font-weight-medium)] text-snake-text-primary shadow-snake-card outline-none transition-shadow placeholder:text-snake-text-disabled focus:border-snake-focus focus:ring-2 focus:ring-snake-focus sm:py-3.5 sm:text-[length:var(--snake-text-body-small-size)]"
              onChange={(event) => onSearchChange?.(event.target.value)}
              placeholder={searchPlaceholder}
              type="search"
              value={searchValue}
            />
          </span>
        </label>
      ) : null}
    </div>
  );
}
