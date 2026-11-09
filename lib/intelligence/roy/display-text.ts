const named: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  ndash: "–", mdash: "—", hellip: "…", aelig: "æ", AElig: "Æ",
  oslash: "ø", Oslash: "Ø", aring: "å", Aring: "Å", eacute: "é",
};

// One pass only: &amp;lt; remains &lt;. Never parse as HTML or alter stored data.
export function displayProductName(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/giu, (whole, entity: string) => {
    if (!entity.startsWith("#")) return named[entity] ?? whole;
    const code = /^#x/i.test(entity) ? Number.parseInt(entity.slice(2), 16) : Number(entity.slice(1));
    return code >= 32 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff)
      ? String.fromCodePoint(code) : whole;
  });
}

// Retain the established escaping contract for other catalog values.
export function quoteRoyText(value: string): string {
  return `«${value.replace(/[\r\n\u2028\u2029]/gu, " ").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/[\\`*_{}\[\]()#!|]/g, "\\$&")}»`;
}
export function quoteRoyProductName(value: string): string {
  // Product names are React text nodes, never HTML or Markdown. React escapes
  // markup at render time; pre-escaping here would display entities literally.
  return `«${displayProductName(value).replace(/[\r\n\u2028\u2029]/gu, " ")}»`;
}
