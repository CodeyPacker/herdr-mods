type Size = "S" | "M" | "L";
function price(size: Size): number {
  switch (size) {
    case "S": return 8;
    case "M": return 10;
    case "L": return 12;
  }
}
