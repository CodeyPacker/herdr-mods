function stockedNames(products: Product[]): string[] {
  return [...new Set(products.filter(p=>p.inStock).map(p=>p.name))];
}
