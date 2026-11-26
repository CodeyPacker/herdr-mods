async function joinNotes(first: () => Promise<string>, second: () => Promise<string>): Promise<string> {
  const a=first(); const b=second(); return (await a)+"/"+(await b);
}
