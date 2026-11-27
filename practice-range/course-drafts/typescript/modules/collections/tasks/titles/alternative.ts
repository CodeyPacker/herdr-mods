function stockedNames(products: Product[]): string[] {
  const names: string[] = [];
  for (const product of products) {
    if (product.inStock) names.push(product.name);
  }
  return names;
}
