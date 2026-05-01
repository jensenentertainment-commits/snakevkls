"use client";

import type { ReactNode } from "react";

export default function SnakeToolbar({
  left,
  right,
  bottom,
}: {
  left: ReactNode;
  right?: ReactNode;
  bottom?: ReactNode;
}) {
  return (
    <div className="min-h-[112px] border-t border-white/10 bg-[#042834] px-5 py-5 sm:px-8 lg:px-10">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">{left}</div>

        {right && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {right}
          </div>
        )}
      </div>

      {bottom && <div className="mt-4">{bottom}</div>}
    </div>
  );
}