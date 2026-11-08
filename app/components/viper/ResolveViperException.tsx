"use client";

import { Button } from "@/app/components/design-system";


import {useViperCommand} from "./useViperCommand";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ResolveViperException({ exceptionId, version }: { exceptionId: string; version: number }) {
  const router = useRouter();
  const send=useViperCommand();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function resolve() {
    if (!note.trim() || busy) return;
    setBusy(true); setError(null);
    try {
      await send(`/api/viper/admin/exceptions/${exceptionId}/resolve`,version,{resolutionNote:note});
      router.refresh();
    } catch(e) { setError(e instanceof Error?e.message:'Mistet forbindelsen. Prøv igjen.'); }
    finally {setBusy(false);}
  }

  return (
    <div className="mt-4">
      <label className="text-sm font-semibold" htmlFor={`resolution-${exceptionId}`}>
        Forklaring
      </label>
      <textarea id={`resolution-${exceptionId}`} value={note}
        onChange={(event) => setNote(event.target.value)} rows={2}
        className="mt-1 w-full rounded-snake-control border border-snake-border-default p-3 text-snake-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-snake-focus" />
      <Button type="button" disabled={!note.trim() || busy} onClick={resolve}
        variant="primary" size="lg" className="h-auto py-3 whitespace-normal mt-2 min-h-12 w-full">
        {busy ? "Lagrer …" : "Marker som løst"}
      </Button>
      {error && <p role="alert" className="mt-2 text-sm font-semibold text-snake-danger">{error}</p>}
    </div>
  );
}
