// UI-safe registration. Course content and executable runners are loaded separately.
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
];
