"use client";

import { useEffect, useRef, useState } from "react";

type Option = {
  value: string;
  label: string;
};

export default function SnakeDropdown({
  value,
  options,
  onChange,
  width = "w-[240px]",
}: {
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  width?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  const selected = options.find((option) => option.value === value);

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
        className="flex w-full items-center justify-between rounded-xl border border-white/20 bg-white px-3 py-2 text-left text-sm text-neutral-950 outline-none"
      >
        <span className="truncate">{selected?.label ?? "Velg"}</span>
        <span className="ml-3 text-xs text-neutral-500">▾</span>
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
              className={`block w-full px-3 py-2 text-left text-sm hover:bg-neutral-100 ${
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