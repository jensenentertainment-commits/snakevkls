import type { ProductRow, ZoneOption } from "./types";

type ToastTone = "success" | "error";

type Args = {
  products: ProductRow[];
  zones: ZoneOption[];

  inlineZone: Record<string, string>;
  inlineSaving: string | null;
  setInlineZone: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setInlineSaving: React.Dispatch<React.SetStateAction<string | null>>;

  syncingShopify: boolean;
  setSyncingShopify: React.Dispatch<React.SetStateAction<boolean>>;
  setLastShopifySync: React.Dispatch<React.SetStateAction<string | null>>;

  selected: string[];
  setSelected: React.Dispatch<React.SetStateAction<string[]>>;
  batchZone: string;
  setBatchZone: React.Dispatch<React.SetStateAction<string>>;
  batchSaving: boolean;
  setBatchSaving: React.Dispatch<React.SetStateAction<boolean>>;
  setBatchOpen: React.Dispatch<React.SetStateAction<boolean>>;

  editing: ProductRow | null;
  setEditing: React.Dispatch<React.SetStateAction<ProductRow | null>>;
  newZone: string;
  setNewZone: React.Dispatch<React.SetStateAction<string>>;
  newLocation: string;
  setNewLocation: React.Dispatch<React.SetStateAction<string>>;
  newQuantity: string;
  setNewQuantity: React.Dispatch<React.SetStateAction<string>>;
  saveSaving: boolean;
  setSaveSaving: React.Dispatch<React.SetStateAction<boolean>>;

  movementProduct: ProductRow | null;
  setMovementProduct: React.Dispatch<React.SetStateAction<ProductRow | null>>;
  movementQty: string;
  setMovementQty: React.Dispatch<React.SetStateAction<string>>;
  movementReason: string;
  setMovementReason: React.Dispatch<React.SetStateAction<string>>;
  movementNote: string;
  setMovementNote: React.Dispatch<React.SetStateAction<string>>;
  movementSaving: boolean;
  setMovementSaving: React.Dispatch<React.SetStateAction<boolean>>;

  loadData: () => Promise<void>;
  showToast: (message: string, tone?: ToastTone) => void;
  setRecentlyUpdated: React.Dispatch<React.SetStateAction<boolean>>;
};

export function useProductsActions({
  zones,

  inlineZone,
  inlineSaving,
  setInlineZone,
  setInlineSaving,

  syncingShopify,
  setSyncingShopify,
  setLastShopifySync,

  selected,
  setSelected,
  batchZone,
  setBatchZone,
  batchSaving,
  setBatchSaving,
  setBatchOpen,

  editing,
  setEditing,
  newZone,
  setNewZone,
  newLocation,
  setNewLocation,
  newQuantity,
  setNewQuantity,
  saveSaving,
  setSaveSaving,

  movementProduct,
  setMovementProduct,
  movementQty,
  setMovementQty,
  movementReason,
  setMovementReason,
  movementNote,
  setMovementNote,
  movementSaving,
  setMovementSaving,

  loadData,
  showToast,
  setRecentlyUpdated,
}: Args) {
  async function handleShopifySync() {
    if (syncingShopify) return;

    setSyncingShopify(true);

    try {
      const res = await fetch("/api/shopify/sync-products", {
        method: "POST",
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result?.error || "Shopify sync feilet");
      }

      if (result.status === "completed") {
        setLastShopifySync(
          new Date().toLocaleTimeString("nb-NO", {
            hour: "2-digit",
            minute: "2-digit",
          })
        );

        showToast("Shopify sync fullført");
        await loadData();
      } else if (result.acquired === false) {
        showToast("En Shopify-sync kj\u00f8rer allerede");
      } else {
        showToast(
          `Shopify-sync lagret fremdrift etter ${result.processedCount ?? 0} produkter. Start igjen for \u00e5 fortsette.`
        );
        await loadData();
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Ukjent feil ved Shopify sync";

      showToast(message, "error");
    } finally {
      setSyncingShopify(false);
    }
  }

  async function handleBatchSave() {
    if (!batchZone || selected.length === 0 || batchSaving) return;

    setBatchSaving(true);

    try {
      const res = await fetch("/api/inventory/batch-zone", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          productIds: selected,
          zoneId: batchZone,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result?.error || "Batch assign feilet");
      }

      const zoneName =
        zones.find((zone) => zone.id === batchZone)?.code ?? "valgt sone";

      setBatchOpen(false);
      setSelected([]);
      setBatchZone("");

      showToast(`${result.updated} produkter → ${zoneName}`);

      await loadData();

      setRecentlyUpdated(true);
      setTimeout(() => setRecentlyUpdated(false), 1800);

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Batch assign feilet";

      showToast(message, "error");
    } finally {
      setBatchSaving(false);
    }
  }

  async function handleInlineSave(product: ProductRow) {
    const zoneId = inlineZone[product.id];

    if (!zoneId || inlineSaving) return;

    setInlineSaving(product.id);

    const existing = product.inventory?.[0];
    const quantity = existing?.quantity ?? product.shopify_quantity ?? 0;

    try {
      const res = await fetch("/api/inventory/set-location", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          productId: product.id,
          inventoryId: existing?.id ?? null,
          zoneId,
          locationId: null,
          quantity,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result?.error || "Kunne ikke lagre sone");
      }

      setInlineZone((prev) => {
        const next = { ...prev };
        delete next[product.id];
        return next;
      });

      showToast("Sone satt");

      await loadData();

      setRecentlyUpdated(true);
      setTimeout(() => setRecentlyUpdated(false), 1800);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Kunne ikke lagre sone";

      showToast(message, "error");
    } finally {
      setInlineSaving(null);
    }
  }

  async function handleSave() {
    if (!editing || saveSaving) return;

    const quantity = Number(newQuantity);

    if (Number.isNaN(quantity) || quantity < 0) {
      showToast("Antall må være 0 eller høyere", "error");
      return;
    }

    setSaveSaving(true);

    const existing = editing.inventory?.[0];

    try {
      const res = await fetch("/api/inventory/set-location", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          productId: editing.id,
          inventoryId: existing?.id ?? null,
          zoneId: newZone || null,
          locationId: newLocation || null,
          quantity,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result?.error || "Kunne ikke lagre plassering");
      }

      setEditing(null);
      setNewZone("");
      setNewLocation("");
      setNewQuantity("0");

      showToast("Plassering lagret");

      await loadData();

      setRecentlyUpdated(true);
      setTimeout(() => setRecentlyUpdated(false), 1800);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Kunne ikke lagre plassering";

      showToast(message, "error");
    } finally {
      setSaveSaving(false);
    }
  }

  async function handleStockMovement() {
    if (!movementProduct || movementSaving) return;

    const quantity = Number(movementQty);

    if (Number.isNaN(quantity) || quantity <= 0) {
      showToast("Antall må være høyere enn 0", "error");
      return;
    }

    setMovementSaving(true);

    try {
      const res = await fetch("/api/inventory/stock-movement", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          productId: movementProduct.id,
          quantity,
          reason: movementReason,
          note: movementNote.trim() || null,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result?.error || "Kunne ikke registrere lagerhendelse");
      }

      setMovementProduct(null);
      setMovementQty("1");
      setMovementReason("manual_sale");
      setMovementNote("");

      showToast("Lagerhendelse registrert");

      await loadData();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Kunne ikke registrere lagerhendelse";

      showToast(message, "error");
    } finally {
      setMovementSaving(false);
    }
  }

  return {
    handleShopifySync,
    handleBatchSave,
    handleInlineSave,
    handleSave,
    handleStockMovement,
  };
}
