type Notice = { kind: "waiting"; place: number } | { kind: "finished"; title: string };

function line(n: Notice): string {
  if (n.kind === "waiting") return "Place " + String(n.place);
  return n.title;
}

console.log(line({ kind: "waiting", place: 0 }));
console.log(line({ kind: "finished", title: "Pack" }));
