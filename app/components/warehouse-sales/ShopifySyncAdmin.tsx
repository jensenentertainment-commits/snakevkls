"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

import {
  Button,
  Card,
  StatusBadge,
} from "@/app/components/design-system";

type Summary = {
  pendingCount: number;
  failedCount: number;
};

type WorkerResult = {
  status: "idle" | "synced" | "failed";
};

export function ShopifySyncAdmin() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    void fetchSummary().then((result) => {
      if (!active) return;
      setIsAdmin(result.isAdmin);
      setSummary(result.summary);
      setError(result.error);
    });

    return () => {
      active = false;
    };
  }, []);

  async function runNext() {
    setIsRunning(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/warehouse-sales/shopify-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
        result?: WorkerResult;
        summary?: Summary;
      };
      if (!response.ok || !body.result || !body.summary) {
        throw new Error(body.error ?? "Shopify kunne ikke oppdateres.");
      }

      setSummary(body.summary);
      setMessage(workerMessage(body.result));
    } catch (runError) {
      setError(
        runError instanceof Error
          ? runError.message
          : "Shopify kunne ikke oppdateres.",
      );
    } finally {
      setIsRunning(false);
    }
  }

  if (isAdmin !== true) return null;
  if (!summary) {
    return error ? (
      <Card as="section" className="mb-5" statusTone="danger" variant="status">
        <p role="alert">{error}</p>
      </Card>
    ) : null;
  }

  return (
    <Card as="section" className="mb-5" variant="subtle">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-snake-text-muted">
            Shopify-oppfølging
          </p>
          <h2 className="mt-1 text-lg font-semibold text-snake-text-primary">
            Salg som venter på oppdatering
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <StatusBadge
              label={`${summary.pendingCount} venter`}
              tone={summary.pendingCount > 0 ? "warning" : "success"}
            />
            <StatusBadge
              icon={
                summary.failedCount > 0 ? (
                  <AlertTriangle size={14} />
                ) : undefined
              }
              label={`${summary.failedCount} krever oppfølging`}
              tone={summary.failedCount > 0 ? "danger" : "neutral"}
            />
          </div>
        </div>

        <Button
          disabled={summary.pendingCount === 0}
          loading={isRunning}
          loadingLabel="Oppdaterer Shopify"
          onClick={runNext}
          variant="secondary"
        >
          <RefreshCw aria-hidden="true" size={17} />
          Synkroniser neste
        </Button>
      </div>

      {message ? (
        <p aria-live="polite" className="mt-4 text-sm text-snake-success">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="mt-4 text-sm text-snake-danger" role="alert">
          {error}
        </p>
      ) : null}
    </Card>
  );
}

async function fetchSummary(): Promise<{
  isAdmin: boolean;
  summary: Summary | null;
  error: string | null;
}> {
  try {
    const response = await fetch("/api/warehouse-sales/shopify-sync", {
      cache: "no-store",
    });
    if (response.status === 401 || response.status === 403) {
      return { isAdmin: false, summary: null, error: null };
    }

    const body = (await response.json().catch(() => ({}))) as {
      error?: string;
      summary?: Summary;
    };
    if (!response.ok || !body.summary) {
      return {
        isAdmin: true,
        summary: null,
        error: body.error ?? "Kunne ikke hente Shopify-status.",
      };
    }
    return { isAdmin: true, summary: body.summary, error: null };
  } catch {
    return {
      isAdmin: true,
      summary: null,
      error: "Kunne ikke hente Shopify-status.",
    };
  }
}

function workerMessage(result: WorkerResult) {
  if (result.status === "synced") {
    return "Én Shopify-oppdatering er fullført.";
  }
  if (result.status === "failed") {
    return "Oppdateringen krever oppfølging før den prøves igjen.";
  }
  return "Ingen salg ventet på Shopify.";
}
