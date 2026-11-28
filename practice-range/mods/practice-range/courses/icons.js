import { image, svg } from "gpui-kit";
import { h_flex } from "gpui-base";

/** @type {Record<string, string>} */
const brands = {
  "course:ts-foundations": "typescript",
  "course:cs-foundations": "csharp",
  "course:sql-foundations": "postgresql",
  "course:docker": "docker",
  "course:linux": "linux",
};
/** @type {Record<string, string>} */
const topics = {
  "course:dsa": "algorithms", "course:api-design": "api", "course:ci-cd": "pipeline",
  "course:networking": "network", "course:system-design": "system",
  "course:databases": "database", "course:security": "security",
};

/** @param {import("../kit/theme.js").Theme} t @param {string} id @param {number} [size] */
export function courseIcon(t, id, size = 36) {
  const brand = brands[id];
  const path = `mods/practice-range/courses/icons/${brand ?? topics[id] ?? "api"}.svg`;
  return h_flex().size(size).flex_none().items_center().justify_center().rounded(8)
    .bg(brand ? "#ffffff" : t.popover)
    .child(brand ? image(path).size(size - 8) : svg(path).size(size - 12).text_color(t.accent));
}
