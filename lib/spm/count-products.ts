import fg from "fast-glob";

export async function countProducts(importPath: string) {
  const allHtml = await fg(`${importPath.replaceAll("\\", "/")}/**/*.html`, {
    onlyFiles: true,
    dot: true,
  });

  const productFiles = allHtml.filter((file) => {
    const normalized = file.replaceAll("\\", "/");

    return (
      normalized.includes("/produkt/") &&
      !normalized.includes("{3}") &&
      !normalized.endsWith("/produkt/index.html")
    );
  });

  return {
    totalHtml: allHtml.length,
    products: productFiles.length,
    examples: productFiles.slice(0, 10),
  };
}