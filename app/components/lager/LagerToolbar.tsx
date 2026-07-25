import type { ReactNode } from "react";

export type LagerToolbarProps = {
  bottom?: ReactNode;
  left: ReactNode;
  right?: ReactNode;
};

export function LagerToolbar({ bottom, left, right }: LagerToolbarProps) {
  return (
    <div
      aria-label="Handlinger og filtre"
      className="border-t border-snake-border-on-dark-subtle bg-snake-app-elevated px-5 py-3 text-snake-text-on-dark sm:px-8 lg:px-10"
      role="group"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">{left}</div>
        {right ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {right}
          </div>
        ) : null}
      </div>
      {bottom ? (
        <div className="mt-4 border-t border-snake-border-on-dark-subtle pt-4">
          {bottom}
        </div>
      ) : null}
    </div>
  );
}
