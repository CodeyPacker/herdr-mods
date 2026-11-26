function extraHours(hours: number, included: number): number {
  let beyond = hours - included;
  if (beyond < 0) beyond = 0;
  return beyond;
}
