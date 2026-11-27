type Size = "S" | "M" | "L";
function price(size: Size): number {
  if (size === "S") return 8;
  return 12;
}
