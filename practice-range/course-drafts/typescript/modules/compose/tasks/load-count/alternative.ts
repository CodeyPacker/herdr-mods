export async function countFrom(read: () => Promise<readonly boolean[]>): Promise<number> { let open = 0; for (const done of await read()) if (done === false) open++; return open; }
