export async function countFrom(read: () => Promise<readonly boolean[]>): Promise<number> { const flags = await read(); return flags.filter(done => !done).length; }
