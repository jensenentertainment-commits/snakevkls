import type { ProductRow } from "./types";

type ToastTone = "success" | "error";

type Args = {
  products: ProductRow[];
  syncingShopify: boolean;
  setSyncingShopify: React.Dispatch<React.SetStateAction<boolean>>;
  setLastShopifySync: React.Dispatch<React.SetStateAction<string | null>>;

  editing: ProductRow | null;
  setEditing: React.Dispatch<React.SetStateAction<ProductRow | null>>;
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
  syncingShopify,
  setSyncingShopify,
  setLastShopifySync,

  editing,
  setEditing,
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

  async function handleSave() {
    if (!editing || saveSaving) return;
    if (!newLocation) { showToast("Velg en konkret lokasjon", "error"); return; }

    const quantity = Number(newQuantity);

    if (!Number.isInteger(quantity) || quantity < 0) {
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
          locationId: newLocation || null,
          quantity,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result?.error || "Kunne ikke lagre plassering");
      }

      setEditing(null);
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
    handleSave,
    handleStockMovement,
  };
}
