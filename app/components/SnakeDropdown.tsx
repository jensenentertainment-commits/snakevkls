"use client";

import { useEffect, useRef, useState } from "react";

type Option = {
  value: string;
  label: string;
};

type Variant = "light" | "dark";

export default function SnakeDropdown({
  value,
  options,
  onChange,
  width = "w-[240px]",
  variant = "light",
}: {
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  width?: string;
  variant?: Variant;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  const selected = options.find((option) => option.value === value);
  const isDark = variant === "dark";

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className={`relative ${width}`}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={`flex h-10 w-full items-center justify-between rounded-xl border px-3 text-left text-sm font-semibold outline-none transition ${
          isDark
            ? "border-white/10 bg-white/[0.06] text-white hover:bg-white/[0.09]"
            : "border-neutral-200 bg-white text-neutral-950 shadow-sm hover:border-neutral-300"
        }`}
      >
        <span className="truncate">{selected?.label ?? "Velg"}</span>
        <span
          className={`ml-3 text-xs transition ${isDark ? "text-white/45" : "text-neutral-500"}`}
        >
          ▾
        </span>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 max-h-72 w-full overflow-auto rounded-xl border border-neutral-200 bg-white py-1 text-neutral-950 shadow-2xl">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              className={`block w-full px-3 py-2 text-left text-sm transition hover:bg-neutral-100 ${
                option.value === value ? "bg-[#055a7d]/10 font-semibold" : ""
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}