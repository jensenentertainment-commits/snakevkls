export const varekompanietKnowledge = {
  company: "Outlet Service AS",
  brand: "Varekompaniet",
  channel: "Shopify",
  facts: [
    "Varekompaniet er dagens operative B2C-brand og nettbutikk under Outlet Service AS.",
    "Shopify er dagens nettbutikk og salgskanal for Varekompaniet.",
    "Snake OS er den interne arbeidsplattformen og erstatter ikke Shopify.",
    "Den synkroniserte katalogen i Snake er Roys eneste produktkilde i v1.",
  ],
  unknowns: [
    "Merkevare-tone og redaksjonelle skriveregler er ikke dokumentert.",
    "Målgrupper og SEO-strategi er ikke dokumentert.",
    "Roy skal markere slike forhold som kunnskapshull og ikke gjette.",
  ],
} as const;

export function buildVarekompanietKnowledgePrompt() {
  return [
    "# Verifisert Varekompaniet-kunnskap",
    ...varekompanietKnowledge.facts.map((fact) => `- ${fact}`),
    "",
    "# Kjente kunnskapshull",
    ...varekompanietKnowledge.unknowns.map((item) => `- ${item}`),
  ].join("\n");
}
