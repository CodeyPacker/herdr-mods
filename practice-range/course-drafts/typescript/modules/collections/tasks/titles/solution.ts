function stockedNames(products: Product[]): string[] {
  return products.filter(p => p.inStock).map(p => p.name);
}
