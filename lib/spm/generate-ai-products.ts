import fs from "fs/promises";
import path from "path";
import OpenAI from "openai";

type Product = {
  title: string;
  description: string;
  category: string;
  sku: string;
  price: string;
};

type AiProduct = {
  sku: string;
  title: string;
  description: string;
  seoTitle: string;
  seoDescription: string;
  tags: string[];
  collections: string[];
};

const allowedCollections = [
  "Alle produkter",
  "Interiør & Dekor",
  "Kunstige blomster & planter",
  "Snittblomster",
  "Kranser, buketter & borddekorasjoner",
  "Blomster",
  "Grønne planter & trær",
  "Palmer & kaktus",
  "Girlander & lysmansjetter",
  "Kunstige matvarer",
];

const artificialWords = [
  "blomst",
  "blomster",
  "rose",
  "orkide",
  "orkidé",
  "tulipan",
  "hortensia",
  "krysantemum",
  "plante",
  "planter",
  "tre",
  "trær",
  "palme",
  "palmer",
  "kaktus",
  "frukt",
  "eple",
  "pære",
  "sitron",
  "appelsin",
  "drue",
  "bakverk",
  "kake",
  "kjeks",
  "baguette",
  "cupcake",
  "muffins",
];

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function enforceCollectionRules(product: Product, collections: string[]) {
  const text = `${product.title} ${product.description} ${product.category}`.toLowerCase();

  const next = new Set<string>();

  next.add("Alle produkter");
  next.add("Interiør & Dekor");

  for (const collection of collections) {
    if (allowedCollections.includes(collection)) {
      next.add(collection);
    }
  }

  const foodWords = [
    "bakverk",
    "kake",
    "kjeks",
    "baguette",
    "frukt",
    "grønt",
    "salat",
    "matvare",
    "matvarer",
    "matdekor",
  ];

  const flowerPlantWords = [
    "blomst",
    "blomster",
    "plante",
    "planter",
    "tre",
    "trær",
    "palme",
    "palmer",
    "kaktus",
    "krans",
    "kranser",
    "bukett",
    "buketter",
    "girlander",
    "lysmansjett",
    "lysmansjetter",
  ];

  

  if (foodWords.some((word) => text.includes(word))) {
    next.add("Kunstige matvarer");
  }

  if (flowerPlantWords.some((word) => text.includes(word))) {
    next.add("Kunstige blomster & planter");
  }

  return [...next].filter((collection) =>
    allowedCollections.includes(collection)
  );
}

function ensureArtificialTitle(title: string, product: Product) {
  const text = `${title} ${product.description} ${product.category}`.toLowerCase();

  const shouldBeArtificial = artificialWords.some((word) =>
    text.includes(word)
  );

  if (
    shouldBeArtificial &&
    !title.toLowerCase().startsWith("kunstig ") &&
    !title.toLowerCase().startsWith("kunstige ")
  ) {
    return `Kunstig ${title}`;
  }

  return title;
}

function fallbackAiProduct(product: Product): AiProduct {
  return {
    sku: product.sku,
    title: ensureArtificialTitle(product.title, product),
    description: product.description,
    seoTitle: `${product.title} | Varekompaniet`,
    seoDescription: `${product.title} til outletpris hos Varekompaniet. Norsk nettbutikk med rask levering.`,
    tags: ["migrert", product.category].filter(Boolean),
    collections: enforceCollectionRules(product, []),
  };
}

async function generateProductWithOpenAi(product: Product): Promise<AiProduct> {
  const response = await client.responses.create({
    model: "gpt-4.1-mini",
    input: [
      {
        role: "system",
        content:
          "Du er Snake AI for Varekompaniet. Skriv SEO-vennlige norske produkttekster for nettbutikk. Tekstene skal være naturlige og informative. Bruk informasjon som finnes i produktdata, og trekk forsiktige konklusjoner om typiske bruksområder som dekorasjon, interiør, utstillinger og gaveartikler når det er naturlig. Ikke finn opp materialer, merkevarer eller tekniske egenskaper som ikke er oppgitt",
      },
      {
        role: "user",
        content: JSON.stringify(
          {
            task: "Lag forbedret Shopify-produktdata.",
            allowedCollections,
            rules: {
              title:
                "Lag en tydelig norsk produkttittel. Behold viktige mål som cm, stk, farge og type. Ikke gjør tittelen for lang.",
              description:
                "Lag 1–2 korte avsnitt på 40–120 ord.Inkluder produktnavn, størrelse, antall og naturlige bruksområder.Beskriv hvordan produktet kan brukes til dekorasjon, interiør, utstillinger eller styling når det passer.Teksten skal være SEO-vennlig, men ikke overdrevet.",
              seoTitle: "Maks ca. 60 tegn. Skal passe Varekompaniet.",
              seoDescription:
                "Maks ca. 155 tegn. Kort og salgbart, men ikke overdrevet.",
              tags:
                "Lag 4-8 relevante norske tags med små bokstaver. Ikke bruk hashtags.",
              collections:
                "Velg 2-4 collections fra allowedCollections. Ikke finn på nye collections. Bruk alltid 'Alle produkter' og 'Interiør & Dekor'. Hvis produktet handler om kunstig mat, bakverk, kake, kjeks, baguette, frukt, grønt, salat eller matdekor, MÅ collections inneholde 'Kunstige matvarer'. Hvis produktet handler om kunstige blomster, planter, trær, palmer, kaktus, kranser, buketter, girlander eller lysmansjetter, MÅ collections inneholde 'Kunstige blomster & planter'. Velg deretter den mest presise underkategorien.",
            },
            collectionHints: {
              "Snittblomster":
                "snittblomst, stilk, kvist, gren, enkeltblomst",
              "Kranser, buketter & borddekorasjoner":
                "krans, bukett, borddekorasjon, dekorasjon til bord",
              Blomster:
                "blomst, rose, tulipan, orkide, hortensia, krysantemum",
              "Grønne planter & trær":
                "grønn plante, tre, busk, bladplante, eucalyptus, ficus",
              "Palmer & kaktus": "palme, kaktus, sukkulent",
              "Girlander & lysmansjetter":
                "girlander, lysmansjett, mansjett",
              "Kunstige matvarer":
                "bakverk, kake, kjeks, baguette, frukt, grønt, salat, matvare",
            },
            product,
          },
          null,
          2
        ),
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "spm_ai_product",
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            sku: { type: "string" },
            title: { type: "string" },
            description: { type: "string" },
            seoTitle: { type: "string" },
            seoDescription: { type: "string" },
            tags: {
              type: "array",
              items: { type: "string" },
            },
            collections: {
              type: "array",
              items: {
                type: "string",
                enum: allowedCollections,
              },
            },
          },
          required: [
            "sku",
            "title",
            "description",
            "seoTitle",
            "seoDescription",
            "tags",
            "collections",
          ],
        },
      },
    },
  });

  const parsed = JSON.parse(response.output_text) as AiProduct;

 return {
  ...parsed,
  sku: product.sku,
  title: ensureArtificialTitle(parsed.title, product),
  collections: enforceCollectionRules(product, parsed.collections ?? []),
};
}

export async function generateAiProducts(limit?: number) {
  const outputRoot = path.join(process.cwd(), "spm-output");

  const products = JSON.parse(
    await fs.readFile(path.join(outputRoot, "products.json"), "utf8")
  ) as Product[];

  const productsToProcess =
    limit && limit > 0 ? products.slice(0, limit) : products;

  const aiProducts: AiProduct[] = [];

  for (const product of productsToProcess) {
    try {
      const aiProduct = await generateProductWithOpenAi(product);
      aiProducts.push(aiProduct);
    } catch (error) {
      console.error("Snake AI feilet for produkt:", product.sku, error);
      aiProducts.push(fallbackAiProduct(product));
    }
  }

  const outputFile = path.join(outputRoot, "ai-products.json");

  await fs.writeFile(outputFile, JSON.stringify(aiProducts, null, 2), "utf8");

  return {
    products: aiProducts.length,
    outputFile,
  };
}
