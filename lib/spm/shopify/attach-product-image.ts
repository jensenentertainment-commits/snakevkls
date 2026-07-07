import fs from "fs/promises";
import path from "path";
import { shopifyGraphql } from "@/lib/shopify/shopify-admin";
import { findProductBySku } from "./find-product-by-sku";

const STAGED_UPLOADS_CREATE = `
  mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
    stagedUploadsCreate(input: $input) {
      stagedTargets {
        url
        resourceUrl
        parameters {
          name
          value
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const PRODUCT_CREATE_MEDIA = `
  mutation productCreateMedia($productId: ID!, $media: [CreateMediaInput!]!) {
    productCreateMedia(productId: $productId, media: $media) {
      media {
        ... on MediaImage {
          id
          image {
            url
          }
        }
      }
      mediaUserErrors {
        field
        message
      }
    }
  }
`;

type StagedUploadsResponse = {
  stagedUploadsCreate: {
    stagedTargets: {
      url: string;
      resourceUrl: string;
      parameters: {
        name: string;
        value: string;
      }[];
    }[];
    userErrors: {
      field: string[] | null;
      message: string;
    }[];
  };
};

type ProductCreateMediaResponse = {
  productCreateMedia: {
    media: {
      id: string;
      image?: {
        url: string;
      } | null;
    }[];
    mediaUserErrors: {
      field: string[] | null;
      message: string;
    }[];
  };
};

function getMimeType(fileName: string) {
  if (fileName.toLowerCase().endsWith(".webp")) return "image/webp";
  if (fileName.toLowerCase().endsWith(".png")) return "image/png";
  return "image/jpeg";
}

export async function attachProductImageBySku(sku: string) {
  const product = await findProductBySku(sku);

  if (!product) {
    throw new Error(`Fant ikke produkt med SKU ${sku}`);
  }

  const imagesDir = path.join(process.cwd(), "spm-output", "images");
  const files = await fs.readdir(imagesDir);

  const imageFile = files.find((file) =>
    file.toLowerCase().startsWith(sku.toLowerCase())
  );

  if (!imageFile) {
    throw new Error(`Fant ikke bilde for SKU ${sku}`);
  }

  const imagePath = path.join(imagesDir, imageFile);
  const imageBuffer = await fs.readFile(imagePath);
  const mimeType = getMimeType(imageFile);

  const staged = await shopifyGraphql<StagedUploadsResponse>({
    query: STAGED_UPLOADS_CREATE,
    variables: {
      input: [
        {
          filename: imageFile,
          mimeType,
          resource: "IMAGE",
          httpMethod: "POST",
        },
      ],
    },
  });

  const stagedErrors = staged.stagedUploadsCreate.userErrors;

  if (stagedErrors.length > 0) {
    throw new Error(stagedErrors.map((e) => e.message).join(", "));
  }

  const target = staged.stagedUploadsCreate.stagedTargets[0];

  if (!target) {
    throw new Error("Shopify returnerte ingen upload target");
  }

  const formData = new FormData();

  for (const parameter of target.parameters) {
    formData.append(parameter.name, parameter.value);
  }

  formData.append(
    "file",
    new Blob([imageBuffer], { type: mimeType }),
    imageFile
  );

  const uploadResponse = await fetch(target.url, {
    method: "POST",
    body: formData,
  });

  if (!uploadResponse.ok) {
    const text = await uploadResponse.text();
    throw new Error(`Upload til Shopify feilet: ${text}`);
  }

  const media = await shopifyGraphql<ProductCreateMediaResponse>({
    query: PRODUCT_CREATE_MEDIA,
    variables: {
      productId: product.productId,
      media: [
        {
          originalSource: target.resourceUrl,
          mediaContentType: "IMAGE",
          alt: product.productTitle,
        },
      ],
    },
  });

  const mediaErrors = media.productCreateMedia.mediaUserErrors;

  if (mediaErrors.length > 0) {
    throw new Error(mediaErrors.map((e) => e.message).join(", "));
  }

  return {
    sku,
    productTitle: product.productTitle,
    imageFile,
    media: media.productCreateMedia.media,
  };
}