function reverseInPlace(values: number[]): void {
  let left = 0;
  let right = values.length - 1;
  while (left < right) {
    const held = values[left];
    values[left] = values[right];
    values[right] = held;
    left++;
    right--;
  }
}
