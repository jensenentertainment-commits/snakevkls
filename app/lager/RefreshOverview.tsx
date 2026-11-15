"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/app/components/design-system/Button";
export function RefreshOverview() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return <Button size="sm" loading={pending} loadingLabel="Henter oversikt" onClick={() => startTransition(() => router.refresh())}>
    <span className="inline-flex items-center gap-2"><RefreshCw size={15} aria-hidden="true" />Oppdater</span>
  </Button>;
}
