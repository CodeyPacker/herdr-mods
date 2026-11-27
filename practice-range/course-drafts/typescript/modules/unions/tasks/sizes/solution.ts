type Size = "S" | "M" | "L";
function price(size: Size): number {
  if (size === "S") return 8;
  if (size === "M") return 10;
  return 12;
}
