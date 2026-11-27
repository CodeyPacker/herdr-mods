function hasPairSum(values: number[], target: number): boolean {
  let found = false;
  values.forEach((first, i) => {
    values.forEach((second, j) => {
      if (i < j && first + second === target) found = true;
    });
  });
  return found;
}
