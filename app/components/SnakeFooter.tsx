"use client";

import { useEffect, useState } from "react";
import { getSnakePulse } from "@/lib/intelligence/snake-pulse";

type SnakeFooterProps = {
  missingLocations?: number;
  quantityDiffs?: number;
  unresolvedIssues?: number;
  warehouseHealth?: number;
  pickEnabled?: boolean;
};

export default function SnakeFooter({
  missingLocations = 0,
  quantityDiffs = 0,
  unresolvedIssues = 0,
  warehouseHealth = 100,
  pickEnabled = false,
}: SnakeFooterProps) {
  const [time, setTime] = useState("");
  const [message, setMessage] = useState("");

useEffect(() => {
  const updateTime = () => {
    const now = new Date();

    setTime(
      now.toLocaleString("no-NO", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    );
  };

  const updateMessage = () => {
    setMessage(
      getSnakePulse({
        missingLocations,
        quantityDiffs,
        unresolvedIssues,
        warehouseHealth,
        pickEnabled,
      })
    );
  };

  updateTime();
  updateMessage();

  const interval = window.setInterval(() => {
    updateTime();
    updateMessage();
  }, 60000);

  return () => window.clearInterval(interval);
}, [
  missingLocations,
  quantityDiffs,
  unresolvedIssues,
  warehouseHealth,
  pickEnabled,
]);

  return (
    <footer className="mt-6 rounded-2xl border border-white/[0.06] bg-black/[0.15] px-6 py-4 text-sm text-white/60 backdrop-blur">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="font-medium">{time}</div>

        <div className="hidden flex-1 text-center text-white/60 md:block">
          {message}
        </div>

        <div className="uppercase tracking-[0.2em] text-white/35">
          Snake OS BY JENSEN DIGITAL
        </div>
      </div>
    </footer>
  );
}