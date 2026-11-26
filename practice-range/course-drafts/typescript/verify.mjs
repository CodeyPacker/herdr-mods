// Kept so the documented command still works. The shared verifier is scripts/verify-course.mjs.
process.argv.splice(2, 0, "typescript");
await import("../../scripts/verify-course.mjs");
