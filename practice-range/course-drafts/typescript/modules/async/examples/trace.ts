async function readName(): Promise<string> {
  return "Jo";
}
const name = await readName();
console.log("Hello " + name);
