function nextLight(light: "red" | "green" | "yellow"): "red" | "green" | "yellow" {
  if (light === "red") return "green";
  if (light === "green") return "yellow";
  return "red";
}
