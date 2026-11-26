function catchesMissingLast(candidate: (values: number[]) => number): boolean {
  return candidate([2, 5]) === 7;
}
