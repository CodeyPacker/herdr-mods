export async function loadReport(read: (name: string) => Promise<string[]>, name: string): Promise<{ kind: "loaded"; count: number } | { kind: "missing"; name: string }> {
  let lines: string[];
  try {
    lines = await read(name);
  } catch {
    return { kind: "missing", name };
  }
  let count = 0;
  for (const line of lines) if (line.length > 0) count++;
  return { kind: "loaded", count };
}

export function catchesWrongCount(candidate: (lines: string[]) => number): boolean {
  return candidate([""]) === 0 && candidate(["x"]) === 1;
}
