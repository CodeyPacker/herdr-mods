async function joinNotes(first: () => Promise<string>, second: () => Promise<string>): Promise<string> {
  const a=await first(); const b=await second(); return b+"/"+a;
}
