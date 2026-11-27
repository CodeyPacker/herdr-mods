function tally(items: Category[]): Record<Category, number> {
  return {
    fruit: items.filter(i => i === "fruit").length,
    veg: items.filter(i => i === "veg").length,
    dairy: items.filter(i => i === "dairy").length,
  };
}
