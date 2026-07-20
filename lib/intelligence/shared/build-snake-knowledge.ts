import { getSnakeKnowledge } from "./snake-knowledge";

export function buildSnakeKnowledgePrompt() {
  const k = getSnakeKnowledge();

  return `
# Snake OS

Navn:
${k.identity.name}

Formål:
${k.identity.purpose}

Retning:
${k.direction.roleOfSnake}

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

---

# Prioriteringer

Nå:

${k.priorities.current.map((p) => `- ${p}`).join("\n")}

Senere:

${k.priorities.later.map((p) => `- ${p}`).join("\n")}
`;
}