"use client";

import { useEffect, useState } from "react";
import SnakeNav from "../../components/SnakeNav";
import SnakeFooter from "../../components/SnakeFooter";
import SnakeHero from "../../components/SnakeHero";
import RoleGate from "../../components/auth/RoleGate";

type CountResult = {
  totalHtml: number;
  products: number;
  examples: string[];
};

type ParseResult = {
  products: number;
  outputFile: string;
};

export default function SPMPage() {
  const [importPath, setImportPath] = useState(
    "C:\\My Web Sites\\Elises Verden\\elisesverden.no"
  );

  const [limit, setLimit] = useState("20");
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const [result, setResult] = useState<CountResult | null>(null);
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [images, setImages] = useState<any>(null);
  const [csv, setCsv] = useState<any>(null);
  const [imageImport, setImageImport] = useState<any>(null);
  const [skuList, setSkuList] = useState("");

  const [testSku, setTestSku] = useState("");
  const [shopifyProduct, setShopifyProduct] = useState<any>(null);
  const [attachedImage, setAttachedImage] = useState<any>(null);
const [ai, setAi] = useState<any>(null);
const [aiUpdate, setAiUpdate] = useState<any>(null);
const [shopifyAi, setShopifyAi] = useState<any>(null);
  const [error, setError] = useState("");
const [shopifyIndex, setShopifyIndex] = useState<any>(null);
  async function handleCountProducts() {
    setLoadingAction("count");
    setError("");

    try {
      const response = await fetch("/api/spm/count", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ importPath }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Noe gikk galt");

      setResult(data);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Ukjent feil");
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleParseProducts() {
    setLoadingAction("parse");
    setError("");

    try {
      const response = await fetch("/api/spm/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ importPath }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Noe gikk galt");

      setParsed(data);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Ukjent feil");
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleConvertImages() {
    setLoadingAction("images");
    setError("");

    try {
      const response = await fetch("/api/spm/images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Noe gikk galt");

      setImages(data);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Ukjent feil");
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleBuildCsv() {
    setLoadingAction("csv");
    setError("");

    try {
      const response = await fetch("/api/spm/csv", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    limit,
  }),
});

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Noe gikk galt");

      setCsv(data);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Ukjent feil");
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleAttachImages() {
    setLoadingAction("attach-images");
    setError("");

    try {
      const response = await fetch("/api/spm/shopify/attach-images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Noe gikk galt");

      setImageImport(data);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Ukjent feil");
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleFindProduct() {
    setError("");
    setShopifyProduct(null);

    try {
      const response = await fetch("/api/spm/shopify/find-product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sku: testSku }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Noe gikk galt");

      setShopifyProduct(data);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Ukjent feil");
    }
  }

  async function handleAttachImage() {
    setLoadingAction("attach-image");
    setError("");
    setAttachedImage(null);

    try {
      const response = await fetch("/api/spm/shopify/attach-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sku: testSku }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Noe gikk galt");

      setAttachedImage(data);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Ukjent feil");
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleResetStatus() {
  await fetch("/api/spm/status/reset", {
    method: "POST",
  });

  setResult(null);
  setParsed(null);
  setImages(null);
  setCsv(null);
  setImageImport(null);
  setError("");
}

async function handleGenerateAi() {
  setLoadingAction("ai");
  setError("");

  try {
    const response = await fetch(
      "/api/spm/ai",
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          limit,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error || "Noe gikk galt"
      );
    }

    setAi(data);
  } catch (error) {
    setError(
      error instanceof Error
        ? error.message
        : "Ukjent feil"
    );
  } finally {
    setLoadingAction(null);
  }
}

async function handleUpdateAiProducts() {
  setLoadingAction("shopify-ai");
  setError("");

  try {
    const response = await fetch("/api/spm/shopify/update-ai-products", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        limit,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Noe gikk galt");
    }

    setShopifyAi(data);
  } catch (error) {
    setError(error instanceof Error ? error.message : "Ukjent feil");
  } finally {
    setLoadingAction(null);
  }
}

async function handleUpdateAiProduct() {
  setLoadingAction("update-ai");
  setError("");

  try {
    const response = await fetch(
      "/api/spm/shopify/update-ai-product",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sku: testSku,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error || "Noe gikk galt"
      );
    }

    setAiUpdate(data);
  } catch (error) {
    setError(
      error instanceof Error
        ? error.message
        : "Ukjent feil"
    );
  } finally {
    setLoadingAction(null);
  }
}

  useEffect(() => {
  async function loadStatus() {
    const response = await fetch("/api/spm/status");
    const data = await response.json();

    if (data.importPath) setImportPath(data.importPath);
    if (data.limit) setLimit(String(data.limit));

    if (data.count) setResult(data.count);
    if (data.parse) setParsed(data.parse);
    if (data.images) setImages(data.images);
    if (data.csv) setCsv(data.csv);
    if (data.shopifyImages) setImageImport(data.shopifyImages);
    if (data.ai) {
  setAi(data.ai);
}
if (data.shopifyAi) {
  setShopifyAi(data.shopifyAi);
}
  }

  loadStatus();
}, []);

  const steps = [
    {
      number: 1,
      title: "Analyser kilde",
      description: "Teller HTML-filer og finner produktsider.",
      status: loadingAction === "count" ? "running" : result ? "done" : "idle",
      button: "Kjør analyse",
      onClick: handleCountProducts,
      details: result
        ? [`${result.totalHtml} HTML-filer`, `${result.products} produkter funnet`]
        : [],
    },
    {
      number: 2,
      title: "Les produkter",
      description: "Henter tittel, SKU, pris, lager og beskrivelser.",
      status: loadingAction === "parse" ? "running" : parsed ? "done" : "idle",
      button: "Les produkter",
      onClick: handleParseProducts,
      details: parsed
        ? [`${parsed.products} produkter lagret`, "products.json opprettet"]
        : [],
    },
    {
      number: 3,
      title: "Klargjør bilder",
      description: "Konverterer produktbilder til Shopify-format.",
      status: loadingAction === "images" ? "running" : images ? "done" : "idle",
      button: "Klargjør bilder",
      onClick: handleConvertImages,
      details: images
        ? [`${images.converted} bilder konvertert`, `${images.failed} feilet`]
        : [],
    },
    {
      number: 4,
      title: "Lag Shopify-data",
      description: "Bygger CSV med priser, lager og kostpris.",
      status: loadingAction === "csv" ? "running" : csv ? "done" : "idle",
      button: "Lag CSV",
      onClick: handleBuildCsv,
      details: csv
        ? [`${csv.products} produkter i CSV`, "shopify-products.csv opprettet"]
        : [],
    },
    {
      number: 5,
      title: "Last opp bilder",
      description: "Kobler produktbilder til Shopify-produkter via SKU.",
      status:
        loadingAction === "attach-images"
          ? "running"
          : imageImport
          ? "done"
          : "idle",
      button: "Last opp bilder",
      onClick: handleAttachImages,
      details: imageImport
  ? [
      `${imageImport.success} bilder lastet opp`,
      `${imageImport.skipped ?? 0} hoppet over`,
      `${imageImport.failed} feilet`,
    ]
  : [],
    },
    {
  number: 6,
  title: "Snake AI",
  description:
    "Genererer SEO og tagger for produktene.",
  status:
    loadingAction === "ai"
      ? "running"
      : ai
      ? "done"
      : "idle",
  button: "Generer AI-data",
  onClick: handleGenerateAi,
  details: ai
    ? [
        `${ai.products} produkter behandlet`,
        "ai-products.json opprettet",
      ]
    : [],
},
{
  number: 7,
  title: "Oppdater Shopify med AI",
  description: "Sender AI-genererte titler, beskrivelser, SEO og tagger til draft-produktene.",
  status:
    loadingAction === "shopify-ai"
      ? "running"
      : shopifyAi
      ? "done"
      : "idle",
  button: "Oppdater Shopify",
  onClick: handleUpdateAiProducts,
  details: shopifyAi
    ? [
        `${shopifyAi.success} produkter oppdatert`,
        `${shopifyAi.skipped ?? 0} hoppet over`,
        `${shopifyAi.failed} feilet`,
      ]
    : [],
},
  ];

  const completedSteps = steps.filter((step) => step.status === "done").length;
const totalSteps = steps.length;

const attentionItems = [
  ...(imageImport?.results?.filter((item: any) => !item.success) ?? []),
  ...(shopifyAi?.results?.filter((item: any) => !item.success) ?? []),
];

const nextStep = steps.find((step) => step.status !== "done");

const stats = [
  {
    label: "HTML-filer",
    value: result?.totalHtml ?? "—",
  },
  {
    label: "Produkter funnet",
    value: result?.products ?? "—",
  },
  {
    label: "I denne kjøringen",
    value: limit || "Alle",
  },
  {
    label: "Krever sjekk",
    value: attentionItems.length,
  },
];

async function handleBuildIndex() {
  setLoadingAction("shopify-index");
  setError("");

  try {
    const response = await fetch("/api/spm/shopify/build-index", {
      method: "POST",
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Noe gikk galt");
    }

    setShopifyIndex(data);
  } catch (error) {
    setError(error instanceof Error ? error.message : "Ukjent feil");
  } finally {
    setLoadingAction(null);
  }
}

function parseSkuList(value: string) {
  return value
    .split(/\n|,|;/)
    .map((sku) => sku.trim())
    .filter(Boolean);
}

  return (
    <RoleGate allowedRoles={["admin"]}>
      <main className="min-h-screen bg-[#062f3b] text-white">
        <div className="mx-auto max-w-[1440px] px-4 py-4 sm:px-6 sm:py-5">
          <SnakeNav />

          <div className="mx-auto max-w-7xl px-6 py-8">
            <SnakeHero
              eyebrow="Snake Product Migrator"
              title="From stock to storefront."
              description="Importer, transformer og klargjør produkter fra nettbutikker, varepartier og rotete produktdata."
            />

            <section className="mt-8 rounded-3xl border border-white/10 bg-[#0d1720] p-6 shadow-xl">
              <label className="text-xs font-black uppercase tracking-[0.22em] text-[#b58a14]">
                Importmappe
              </label>

              <input
                value={importPath}
                onChange={(event) => setImportPath(event.target.value)}
                className="mt-3 w-full rounded-2xl border border-white/10 bg-[#071018] px-4 py-3 text-sm text-white outline-none focus:border-[#b58a14]"
              />

              <div className="mt-5 flex flex-wrap items-end gap-4">
                <div>
                  <label className="text-xs font-black uppercase tracking-[0.18em] text-white">
                    Antall
                  </label>
                  <input
                    value={limit}
                    onChange={(event) => setLimit(event.target.value)}
                    className="mt-2 w-28 rounded-2xl border border-white/10 bg-[#071018] px-4 py-3 text-sm text-white outline-none focus:border-[#b58a14]"
                    placeholder="5"
                  />
                </div>

                <div className="text-xs text-white">
                  Tomt felt = behandle alle.
                </div>
              </div>
            </section>

            <button
  type="button"
  onClick={handleResetStatus}
  className="rounded-2xl border border-red-500/30 px-5 py-3 text-sm font-bold text-red-300 transition hover:bg-red-950/30"
>
  Nullstill status
</button>

  

            {error && (
              <div className="mt-6 rounded-2xl border border-red-500/30 bg-red-950/30 p-4 text-sm text-red-200">
                {error}
              </div>
            )}

            <section className="mt-8 rounded-3xl border border-white/10 bg-[#0d1720] p-6 shadow-xl">
  <div className="flex flex-wrap items-start justify-between gap-4">
    <div>
      <div className="text-xs font-black uppercase tracking-[0.22em] text-[#b58a14]">
        SPM Dashboard
      </div>

      <h2 className="mt-2 text-3xl font-black">
        {completedSteps}/{totalSteps} steg fullført
      </h2>

      <p className="mt-2 text-sm text-white">
        {nextStep
          ? `Neste anbefalte steg: ${nextStep.title}`
          : "Alle steg er fullført."}
      </p>
    </div>

    {nextStep && (
      <button
        type="button"
        onClick={nextStep.onClick}
        disabled={loadingAction !== null}
        className="rounded-2xl bg-[#b58a14] px-5 py-3 text-sm font-black text-[#071018] transition hover:bg-[#d2a32c] disabled:opacity-50"
      >
        {loadingAction ? "Kjører..." : `Kjør: ${nextStep.title}`}
      </button>
    )}
  </div>

  <div className="mt-6 grid gap-3 md:grid-cols-4">
    {stats.map((item) => (
      <div
        key={item.label}
        className="rounded-2xl border border-white/10 bg-[#071018] p-4"
      >
        <div className="text-xs uppercase tracking-[0.18em] text-white">
          {item.label}
        </div>
        <div className="mt-2 text-3xl font-black">{item.value}</div>
      </div>
    ))}
  </div>

  <div className="mt-6 divide-y divide-white/10 rounded-2xl border border-white/10 bg-[#071018]">
    {steps.map((step) => (
      <details key={step.number} className="group">
        <summary className="flex cursor-pointer items-center justify-between gap-4 px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="w-8 text-sm font-black text-[#b58a14]">
              {step.number}
            </div>

            <div>
              <div className="font-black">{step.title}</div>
              <div className="text-xs text-white">
                {step.description}
              </div>
            </div>
          </div>

          <div className="text-sm font-bold text-slate-300">
            {step.status === "done" && "✅ Ferdig"}
            {step.status === "running" && "🔵 Kjører..."}
            {step.status === "idle" && "⚪ Ikke kjørt"}
          </div>
        </summary>

        <div className="px-4 pb-4">
          {step.details.length > 0 && (
            <div className="grid gap-3 md:grid-cols-3">
              {step.details.map((detail) => (
                <div
                  key={detail}
                  className="rounded-xl border border-white/10 bg-[#0d1720] px-4 py-3 text-sm text-slate-300"
                >
                  {detail}
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={step.onClick}
            disabled={loadingAction !== null}
            className="mt-4 rounded-2xl border border-white/10 px-5 py-3 text-sm font-bold text-white transition hover:border-[#b58a14]/60 disabled:opacity-50"
          >
            {step.status === "running" ? "Kjører..." : step.button}
          </button>
        </div>
      </details>
    ))}
  </div>
</section>


            {imageImport?.results?.some((item: any) => !item.success) && (
  <section className="mt-6 rounded-3xl border border-red-500/20 bg-red-950/20 p-6 shadow-xl">
    <div className="text-xs font-black uppercase tracking-[0.22em] text-red-300">
      Feil ved bildeimport
    </div>

    <div className="mt-4 space-y-2">
      {imageImport.results
        .filter((item: any) => !item.success)
        .map((item: any) => (
          <div
            key={`${item.sku}-${item.file}`}
            className="rounded-2xl border border-red-500/20 bg-[#071018] px-4 py-3 text-sm text-red-100"
          >
            <div className="font-bold">{item.sku}</div>
            <div className="text-xs text-red-200/80">{item.file}</div>
            <div className="mt-1 text-xs text-red-200/80">
              {item.error}
            </div>
          </div>
        ))}
    </div>
  </section>
)}

            {error && (
              <div className="mt-6 rounded-2xl border border-red-500/30 bg-red-950/30 p-4 text-sm text-red-200">
                {error}
              </div>
            )}
            

            <details className="mt-8 rounded-3xl border border-white/10 bg-[#0d1720] p-6 shadow-xl">
              <summary className="cursor-pointer text-sm font-black uppercase tracking-[0.18em] text-[#b58a14]">
                Avanserte Shopify-verktøy
              </summary>

              <textarea
  value={skuList}
  onChange={(event) => setSkuList(event.target.value)}
  placeholder={`SKU-liste, én per linje
1462-10-1
7691-10-1
8130-10-1`}
  className="min-h-[140px] w-full rounded-2xl border border-white/10 bg-[#071018] px-4 py-3 text-sm text-white outline-none placeholder:text-white/35"
/>

              <div className="mt-5 flex flex-wrap gap-3">
                <input
                  value={testSku}
                  onChange={(event) => setTestSku(event.target.value)}
                  placeholder="SKU, f.eks. 1057-50"
                  className="min-w-[260px] flex-1 rounded-2xl border border-white/10 bg-[#071018] px-4 py-3 text-sm text-white outline-none focus:border-[#b58a14]"
                />

                <button
                  type="button"
                  onClick={handleFindProduct}
                  className="rounded-2xl border border-white/10 px-5 py-3 text-sm font-bold text-white hover:border-[#b58a14]/60"
                >
                  Finn produkt
                </button>

                <button
                  type="button"
                  onClick={handleAttachImage}
                  disabled={loadingAction !== null}
                  className="rounded-2xl border border-white/10 px-5 py-3 text-sm font-bold text-white hover:border-[#b58a14]/60 disabled:opacity-50"
                >
                  {loadingAction === "attach-image"
                    ? "Laster opp..."
                    : "Importer ett bilde"}
                </button>

                <button
  type="button"
  onClick={handleBuildIndex}
  disabled={loadingAction !== null}
  className="rounded-2xl border border-white/10 px-5 py-3 text-sm font-bold text-white hover:border-[#b58a14]/60 disabled:opacity-50"
>
  {loadingAction === "shopify-index"
    ? "Bygger index..."
    : "Bygg Shopify Index"}
</button>
              </div>

              <button
  type="button"
  onClick={handleUpdateAiProduct}
  disabled={
    loadingAction === "update-ai" ||
    !testSku.trim()
  }
  className="rounded-2xl border border-emerald-500/30 px-5 py-3 text-sm font-bold text-emerald-300 transition hover:bg-emerald-950/30 disabled:opacity-50"
>
  {loadingAction === "update-ai"
    ? "Oppdaterer..."
    : "Oppdater med AI"}
</button>



              {shopifyProduct && (
                <pre className="mt-4 overflow-auto rounded-2xl bg-[#071018] p-4 text-xs text-slate-300">
                  {JSON.stringify(shopifyProduct, null, 2)}
                </pre>
              )}

              {attachedImage && (
                <pre className="mt-4 overflow-auto rounded-2xl bg-[#071018] p-4 text-xs text-slate-300">
                  {JSON.stringify(attachedImage, null, 2)}
                </pre>
              )}
            </details>

            {aiUpdate && (
  <pre className="mt-4 overflow-x-auto rounded-2xl border border-emerald-500/20 bg-[#071018] p-4 text-xs text-emerald-100">
    {JSON.stringify(aiUpdate, null, 2)}
  </pre>
)}

{shopifyIndex && (
  <pre className="mt-4 overflow-auto rounded-2xl bg-[#071018] p-4 text-xs text-slate-300">
    {JSON.stringify(shopifyIndex, null, 2)}
  </pre>
)}
            <SnakeFooter />
          </div>
        </div>
      </main>
    </RoleGate>
  );
}