function nextLight(light: "red" | "green" | "yellow"): "red" | "green" | "yellow" {
  if (light === "red") return "green";
  return "red";
}
