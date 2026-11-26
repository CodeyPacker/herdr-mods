function catchesMissingLast(candidate: (values: number[]) => number): boolean {
  return candidate([4]) === 4;
}
