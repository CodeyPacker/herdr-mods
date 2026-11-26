export async function countFrom(read: () => Promise<readonly boolean[]>): Promise<number> { try { return (await read()).filter(done => !done).length; } catch { return 0; } }
