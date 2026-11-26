export async function countFrom(read: () => Promise<readonly boolean[]>): Promise<number> { return (await read()).length; }
