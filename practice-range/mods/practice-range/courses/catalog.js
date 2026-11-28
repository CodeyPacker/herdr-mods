// UI-safe registration. Course content and executable runners are loaded separately.
/** Highest completion percentage first. Keep the existing order when progress is equal.
 * @template {{done?: number, total: number, enrolledVersion?: string}} T
 * @param {T[]} courses @returns {T[]}
 */
export function sortCourses(courses) {
  /** @param {T} course */
  const progress = course => (course.done ?? 0) / Math.max(1, course.total);
  return [...courses].sort((a, b) => progress(b) - progress(a) || Number(Boolean(b.enrolledVersion)) - Number(Boolean(a.enrolledVersion)));
}

export const bundledCourses = [
  { id: "course:ts-foundations", languageId: "typescript", file: "typescript-foundations.json" },
  { id: "course:cs-foundations", languageId: "csharp", file: "csharp-foundations.json" },
  { id: "course:sql-foundations", languageId: "sql", file: "sql-foundations.json" },
  // A second course in a language shares that language's runner.
  { id: "course:dsa", languageId: "typescript", file: "dsa.json" },
  // A reading course has no language.
  { id: "course:api-design", file: "api-design.json" },
  { id: "course:docker", file: "docker.json" },
  { id: "course:ci-cd", file: "ci-cd.json" },
  { id: "course:networking", file: "networking.json" },
  { id: "course:system-design", file: "system-design.json" },
  { id: "course:databases", file: "databases.json" },
  { id: "course:security", file: "security.json" },
  { id: "course:linux", file: "linux.json" },
];
