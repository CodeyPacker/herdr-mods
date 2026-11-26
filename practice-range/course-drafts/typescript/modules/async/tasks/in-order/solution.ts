async function joinNotes(first: () => Promise<string>, second: () => Promise<string>): Promise<string> {
  const left = await first();
  const right = await second();
  return left + "/" + right;
}
