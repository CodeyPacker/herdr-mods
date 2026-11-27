function nextLight(light: "red" | "green" | "yellow"): "red" | "green" | "yellow" {
  if (light === "red") return "yellow";
  if (light === "yellow") return "green";
  return "red";
}
