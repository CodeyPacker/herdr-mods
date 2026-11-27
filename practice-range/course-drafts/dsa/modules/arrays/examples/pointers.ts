const letters = ["a", "b", "c", "d", "e"];
let left = 0;
let right = letters.length - 1;
while (left < right) {
  const held = letters[left];
  letters[left] = letters[right];
  letters[right] = held;
  left++;
  right--;
}
console.log(letters.join(""));
console.log(left, right);
