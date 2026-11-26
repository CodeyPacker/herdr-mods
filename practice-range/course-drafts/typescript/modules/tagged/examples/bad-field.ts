type Notice = { kind: "waiting"; place: number } | { kind: "finished"; title: string };

function placeOf(n: Notice): number {
  return n.place;
}
