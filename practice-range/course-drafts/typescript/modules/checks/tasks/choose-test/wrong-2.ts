function catchesMissingLast(candidate: (values: number[]) => number): boolean {
  return candidate([]) === 0;
}
