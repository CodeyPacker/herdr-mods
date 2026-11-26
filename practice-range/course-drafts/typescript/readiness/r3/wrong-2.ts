export async function loadReport(read: (name: string) => Promise<string[]>, name: string): Promise<{ kind: "loaded"; count: number } | { kind: "missing"; name: string }> {
  try {
    const lines = await read(name);
    return { kind: "loaded", count: lines.filter(line => line !== "").length };
  } catch {
    return { kind: "missing", name };
  }
}

export function catchesWrongCount(candidate: (lines: string[]) => number): boolean {
  return candidate(["a", "b"]) === 2;
}
