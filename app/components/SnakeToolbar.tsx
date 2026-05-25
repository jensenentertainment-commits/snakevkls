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
  <div className="border-t border-white/8 bg-[#062f3b]/92 px-5 py-3 backdrop-blur-xl sm:px-8 lg:px-10">
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        {left}
      </div>

      {right && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {right}
        </div>
      )}
    </div>

    {bottom && (
      <div className="mt-4 border-t border-white/6 pt-4">
        {bottom}
      </div>
    )}
  </div>
);
}