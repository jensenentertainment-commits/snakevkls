"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Play } from "lucide-react";

export default function StartPickButton({ pickJobId }: { pickJobId: string }) {
  const router = useRouter();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startPick() {
    if (starting) return;

    setStarting(true);
    setError(null);

    try {
      const response = await fetch(`/api/viper/picks/${pickJobId}/start`, {
        method: "POST",
      });
      const result = (await response.json()) as { error?: string; pickJobId?: string };

      if (!response.ok) {
        setError(result.error ?? "Kunne ikke starte plukket");
        return;
      }

      router.push(`/viper/picks/${result.pickJobId ?? pickJobId}`);
    } catch {
      setError("Mistet forbindelsen. Prøv igjen.");
    } finally {
      setStarting(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        disabled={starting}
        onClick={startPick}
        className="flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl bg-[#b58a14] px-6 py-4 text-base font-black text-white shadow-lg shadow-[#b58a14]/20 transition hover:bg-[#a57c0f] disabled:cursor-wait disabled:opacity-70"
      >
        <Play className="h-5 w-5 fill-current" />
        {starting ? "Starter plukk …" : "Start plukk"}
      </button>

      {error && (
        <p role="alert" className="mt-3 text-center text-sm font-semibold text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
