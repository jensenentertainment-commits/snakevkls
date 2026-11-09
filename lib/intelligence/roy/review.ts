export const REVIEW_RULES = {
  content_unknown: ['Datagrunnlag mangler', 'Produktinnhold er ikke observert.', 'Undersøk katalogens datadekning før produktet vurderes.'],
  collections_unknown: ['Ufullstendig collection-grunnlag', 'Collection-observasjonen er ikke komplett.', 'Kontroller datadekningen; dette betyr ikke at produktet mangler collections.'],
  description_empty: ['Tom produktbeskrivelse', 'Lagret beskrivelse er tom.', 'Vurder en nyttig produktbeskrivelse i Shopify.'],
  image_missing: ['Ingen bildereferanse', 'Lagret featured-image-referanse mangler.', 'Kontroller produktbildet i Shopify. Bildekvalitet er ikke vurdert.'],
  category_missing: ['Kategori ikke angitt', 'Shopify-kategori er ikke registrert.', 'Vurder om en kategori er relevant. Dette er ikke automatisk en feil.'],
  type_missing: ['Produkttype ikke angitt', 'Det valgfrie produkttypefeltet er tomt.', 'Fyll ut bare dersom det er nyttig for organiseringen.'],
  vendor_missing: ['Leverandør ikke angitt', 'Lagret leverandørfelt er tomt.', 'Vurder om leverandør bør registreres.'],
  seo_title_default: ['Ingen SEO-titteloverstyring', 'Eksplisitt SEO-tittel er ikke angitt.', 'Shopify kan bruke standardtittel. Ingen handling kreves alene av dette.'],
  seo_description_default: ['Ingen SEO-beskrivelsesoverstyring', 'Eksplisitt SEO-beskrivelse er ikke angitt.', 'Shopify kan bruke standardverdier. Vurder bare ved et konkret behov.'],
  sku_missing: ['SKU ikke angitt', 'Varianten har ikke SKU.', 'SKU er valgfri. Variant-ID er identiteten; ingen retting kreves.'],
  sku_shared: ['SKU brukes av flere varianter', 'Flere aktive varianter har samme SKU.', 'Dette er tillatt. Bruk Variant-ID ved presise oppslag; ikke slå sammen produktene.'],
} as const;
export type ReviewRule = keyof typeof REVIEW_RULES;
export type ReviewFinding = {
  id: string; entity_id: string; rule: ReviewRule; priority: number; label: string;
  state: 'open' | 'resolved' | 'out_of_scope'; assessment: 'known' | 'unknown';
  event: 'new' | 'resolved' | 'reopened' | 'out_of_scope' | null;
  first_seen_at: string; last_seen_at: string;
};
export type ReviewSummary = Record<'products'|'variants'|'dataGaps'|'recommendations'|'information'|'uncertain'|'new'|'resolved'|'reopened',number> & {sourceOldest: string|null; sourceNewest: string|null};
export type ReviewReport = {run: {id:string; shop:string; completed_at:string; rule_version: number; summary:ReviewSummary}|null; findings:ReviewFinding[]; total:number};
export function parseReview(value: unknown): ReviewReport {
  const fail = () => { throw new Error('Invalid Roy report'); };
  if (!value || typeof value !== 'object') return fail();
  const r = value as ReviewReport;
  if (!Number.isSafeInteger(r.total) || r.total<0 || !Array.isArray(r.findings) || r.findings.length>50) return fail();
  const date = (v: unknown) => typeof v==='string' && Number.isFinite(Date.parse(v));
  if (r.run) {
    if (typeof r.run.id!=='string' || typeof r.run.shop!=='string' || !date(r.run.completed_at) || r.run.rule_version!==1 || !r.run.summary) return fail();
    for (const k of ['products','variants','dataGaps','recommendations','information','uncertain','new','resolved','reopened'] as const) {
      if (!Number.isSafeInteger(r.run.summary[k]) || r.run.summary[k]<0) return fail();
    }
    for (const k of ['sourceOldest','sourceNewest'] as const) if (r.run.summary[k]!==null && !date(r.run.summary[k])) return fail();
  } else if (r.run!==null || r.total!==0 || r.findings.length!==0) return fail();
  for (const f of r.findings) {
    if (!f || typeof f.id!=='string' || typeof f.entity_id!=='string' || typeof f.label!=='string' || f.label.length>240
      || !Object.hasOwn(REVIEW_RULES,f.rule) || ![1,2,3].includes(f.priority)
      || !['open','resolved','out_of_scope'].includes(f.state) || !['known','unknown'].includes(f.assessment)
      || ![null,'new','resolved','reopened','out_of_scope'].includes(f.event) || !date(f.first_seen_at) || !date(f.last_seen_at)) return fail();
  }
  return r;
}
export function reviewIntroduction(s: ReviewSummary): string {
  const main = s.recommendations
    ? `Jeg fant ${s.recommendations} ${s.recommendations === 1 ? 'anbefaling' : 'anbefalinger'} om beskrivelser og bildereferanser som bør vurderes først.`
    : 'Jeg fant ingen manglende beskrivelser eller bildereferanser i det kjente datagrunnlaget.';
  const gap = s.dataGaps || s.uncertain ? ' Deler av grunnlaget er ufullstendige; tidligere funn er ikke erklært løst uten ny evidens.' : '';
  return `Jeg har kontrollert ${s.products} produkter og ${s.variants} varianter i den lagrede katalogen. ${main}${gap} Valgfrie felt er holdt utenfor prioriteringen.`;
}
export function reviewError(code?: string): string {
  if (code==='55P03') return 'Katalogen eller en kontroll er i bruk. Ingen ny rapport ble lagret. Prøv igjen senere.';
  if (code==='55000') return 'Kontrollen krever én katalogbutikk og ingen uferdig katalogsynkronisering. Forrige rapport er beholdt.';
  if (code==='40001') return 'Rapporten er oppdatert. Last siden på nytt.';
  return 'Kontrollen kunne ikke fullføres. Forrige rapport er beholdt. Ingen katalogdata er endret.';
}
