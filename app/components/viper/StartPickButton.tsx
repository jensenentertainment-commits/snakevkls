"use client";

import { Button } from "@/app/components/design-system";


import {useViperCommand} from "./useViperCommand";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Play } from "lucide-react";

export default function StartPickButton({ pickJobId, version }: { pickJobId: string; version: number }) {
  const router = useRouter();
  const send=useViperCommand();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startPick() {
    if (starting) return;

    setStarting(true);
    setError(null);

    try {
      const result=await send(`/api/viper/picks/${pickJobId}/start`,version);

      router.push(`/viper/picks/${result.pickJobId ?? pickJobId}`);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Mistet forbindelsen. Prøv igjen.");
    } finally {
      setStarting(false);
    }
  }

  return (
    <div>
      <Button
        type="button"
        disabled={starting}
        onClick={startPick}
        variant="primary" size="lg" className="h-auto py-3 whitespace-normal min-h-14 w-full"
      >
        <Play className="inline-block h-5 w-5 fill-current" />
        {starting ? "Starter plukk …" : "Start plukk"}
      </Button>

      {error && (
        <p role="alert" className="mt-3 text-center text-sm font-semibold text-snake-danger">
          {error}
        </p>
      )}
    </div>
  );
}
