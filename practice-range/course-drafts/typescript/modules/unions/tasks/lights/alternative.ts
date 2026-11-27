function nextLight(light: "red" | "green" | "yellow"): "red" | "green" | "yellow" {
  switch (light) {
    case "red": return "green";
    case "green": return "yellow";
    case "yellow": return "red";
  }
}
