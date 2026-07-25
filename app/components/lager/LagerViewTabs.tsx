"use client";

import { useRef, type KeyboardEvent } from "react";

export type LagerViewTab = {
  count?: number | string;
  id: string;
  label: string;
};

export type LagerViewTabsProps = {
  activeId: string;
  ariaLabel: string;
  items: LagerViewTab[];
  onChange: (id: string) => void;
};

export function LagerViewTabs({
  activeId,
  ariaLabel,
  items,
  onChange,
}: LagerViewTabsProps) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  function handleKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    let nextIndex: number | undefined;

    if (event.key === "ArrowRight") nextIndex = (index + 1) % items.length;
    if (event.key === "ArrowLeft")
      nextIndex = (index - 1 + items.length) % items.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = items.length - 1;

    if (nextIndex === undefined) return;

    event.preventDefault();
    const nextItem = items[nextIndex];
    onChange(nextItem.id);
    refs.current[nextIndex]?.focus();
  }

  return (
    <div
      aria-label={ariaLabel}
      className="flex flex-wrap items-center gap-2"
      role="tablist"
    >
      {items.map((item, index) => {
        const active = item.id === activeId;

        return (
          <button
            key={item.id}
            ref={(element) => {
              refs.current[index] = element;
            }}
            aria-selected={active}
            className={`rounded-snake-control border px-3 py-2 text-[length:var(--snake-text-body-small-size)] font-[var(--snake-font-weight-semibold)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-snake-focus-on-dark motion-reduce:transition-none ${
              active
                ? "border-snake-brand-border bg-snake-brand-soft text-snake-text-on-dark"
                : "border-snake-border-on-dark-subtle bg-snake-app-elevated text-snake-text-on-dark-muted hover:border-snake-border-on-dark-default hover:text-snake-text-on-dark"
            }`}
            onClick={() => onChange(item.id)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            role="tab"
            tabIndex={active ? 0 : -1}
            type="button"
          >
            {item.label}
            {item.count !== undefined ? (
              <span className="ml-1 opacity-70">{item.count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
