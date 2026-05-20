"use client";

import Link from "next/link";
import { ArrowRight, BrainCircuit } from "lucide-react";
import type { NextAction } from "@/lib/intelligence/get-next-action";

export default function SnakeIntelligenceCard({
  action,
}: {
  action: NextAction;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.045] p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/70">
          <BrainCircuit className="h-5 w-5" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">
            Snake Intelligence
          </p>

          <h2 className="mt-2 text-lg font-semibold text-white">
            {action.title}
          </h2>

          <p className="mt-2 text-sm leading-6 text-white/55">
            {action.description}
          </p>

          <Link
            href={action.href}
            className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-white/70 transition hover:text-white"
          >
            Start her
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}