"use client";

import { useEffect, useState } from "react";

const dateFormatter = new Intl.DateTimeFormat("no-NO", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const timeFormatter = new Intl.DateTimeFormat("no-NO", {
  hour: "2-digit",
  minute: "2-digit",
});

function formatClock(now: Date) {
  return {
    date: dateFormatter.format(now),
    dateTime: now.toISOString(),
    time: timeFormatter.format(now),
  };
}

export function AppClock() {
  const [clock, setClock] = useState<ReturnType<typeof formatClock> | null>(
    null,
  );

  useEffect(() => {
    const updateClock = () => setClock(formatClock(new Date()));
    const now = new Date();
    const millisecondsUntilNextMinute =
      (60 - now.getSeconds()) * 1000 - now.getMilliseconds();

    updateClock();
    let interval: number | undefined;
    const firstUpdate = window.setTimeout(() => {
      updateClock();
      interval = window.setInterval(updateClock, 60_000);
    }, millisecondsUntilNextMinute);

    return () => {
      window.clearTimeout(firstUpdate);
      if (interval !== undefined) window.clearInterval(interval);
    };
  }, []);

  if (!clock) {
    return (
      <span className="text-snake-text-on-dark-muted">Dato og klokkeslett</span>
    );
  }

  return (
    <time
      className="flex items-center gap-2 font-mono text-snake-text-on-dark-muted"
      dateTime={clock.dateTime}
    >
      <span>{clock.date}</span>
      <span aria-hidden="true">·</span>
      <span>{clock.time}</span>
    </time>
  );
}
