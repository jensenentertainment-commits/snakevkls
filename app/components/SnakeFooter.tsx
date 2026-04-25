"use client";

import { useEffect, useState } from "react";

const MESSAGES = [
  "Systemet fungerer som forventet.",
  "Ingen feil registrert. Det er mistenkelig.",
  "Lageret er strukturert. Foreløpig.",
  "Plukk er ikke aktivert. Det er sikkert greit.",
  "Data er konsistent. For nå.",
  "Avvik eksisterer. De bare vises ikke enda.",
  "Alt er riktig. Inntil noen sjekker.",
  "Systemet overvåker. Ikke omvendt.",
  "Ingen kritiske avvik registrert. Foreløpig.",
"Lagerdata vurderes som tilstrekkelig ryddig.",
"Systemstatus: Stabil, men ikke overmodig.",
"Plukkemodul avventer modenhet.",
"Lokasjonsstruktur under kontroll. Nesten.",
];

export default function SnakeFooter() {
  const [time, setTime] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();

      const formatted = now.toLocaleString("no-NO", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

      setTime(formatted);
    };

    updateTime();
    const interval = setInterval(updateTime, 60000);

    // tilfeldig melding ved load
    setMessage(MESSAGES[Math.floor(Math.random() * MESSAGES.length)]);

    return () => clearInterval(interval);
  }, []);

  return (
    <footer className="mt-6 flex items-center justify-between rounded-2xl border border-white/[0.06] bg-black/[0.15] px-6 py-4 text-xs text-white/50 backdrop-blur">
      
      <div className="font-medium">
        {time}
      </div>

      <div className="hidden md:block text-white/40">
        {message}
      </div>

      <div className="uppercase tracking-[0.2em] text-white/35">
        Snake VKLS
      </div>
    </footer>
  );
}