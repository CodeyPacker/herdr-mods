async function joinNotes(first: () => Promise<string>, second: () => Promise<string>): Promise<string> {
  return (await first()) + "/" + (await second());
}
