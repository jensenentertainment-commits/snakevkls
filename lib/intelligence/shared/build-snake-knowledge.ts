import { getSnakeKnowledge } from "./snake-knowledge";

export function buildSnakeKnowledgePrompt() {
  const k = getSnakeKnowledge();

  return `
# Snake OS

Navn:
${k.identity.name}

Formål:
${k.identity.purpose}

Virksomhet:
${k.identity.company}

Operativt brand/nettbutikk:
${k.identity.operatingBrand}

Retning:
${k.direction.roleOfSnake}

Varekompaniet:
${k.direction.roleOfVarekompaniet}

Fysisk lager:
${k.direction.roleOfWarehouse}

Shopify:
${k.direction.roleOfShopify}

---

# Digitale ansatte

Børre

Rolle:
${k.assistants.borre.role}

Formål:
${k.assistants.borre.purpose}

Arne

Rolle:
${k.assistants.arne.role}

Formål:
${k.assistants.arne.purpose}

---

# Prinsipper

${k.principles.map((p) => `- ${p}`).join("\n")}
`;
}
