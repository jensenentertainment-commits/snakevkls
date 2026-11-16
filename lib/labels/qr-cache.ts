export type QrVariant = "standard" | "a4";
export const QR_OPTIONS = {
  standard: { width: 360, margin: 1 },
  a4: { width: 600, margin: 4 },
} as const;

/** Per mounted labels page. Share pending work as well as completed images. */
export function createLabelQrCache(generate: (url: string, options: { width: number; margin: number }) => Promise<string>) {
  const images = new Map<string, Promise<string>>();
  return {
    get(url: string, variant: QrVariant) {
      const key = JSON.stringify([url, variant]);
      const existing = images.get(key);
      if (existing) return existing;
      const pending = Promise.resolve().then(() => generate(url, QR_OPTIONS[variant]));
      images.set(key, pending);
      void pending.catch(() => { if (images.get(key) === pending) images.delete(key); });
      return pending;
    },
  };
}
