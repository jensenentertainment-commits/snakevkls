"use client";

export type LagerDropdownOption = {
  label: string;
  value: string;
};

export type LagerDropdownProps = {
  onChange: (value: string) => void;
  options: LagerDropdownOption[];
  value: string;
  variant?: "light" | "dark";
  width?: string;
};

export function LagerDropdown({
  onChange,
  options,
  value,
  variant = "light",
  width = "w-[240px]",
}: LagerDropdownProps) {
  const dark = variant === "dark";

  return (
    <select
      aria-label="Velg filter"
      className={`${width} h-10 rounded-snake-control border px-3 text-[length:var(--snake-text-body-small-size)] font-[var(--snake-font-weight-semibold)] outline-none transition-colors focus:ring-2 ${
        dark
          ? "border-snake-border-on-dark-default bg-snake-app-elevated text-snake-text-on-dark focus:border-snake-focus-on-dark focus:ring-snake-focus-on-dark"
          : "border-snake-border-default bg-snake-surface text-snake-text-primary shadow-snake-card focus:border-snake-focus focus:ring-snake-focus"
      }`}
      onChange={(event) => onChange(event.target.value)}
      value={value}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
