const values = [5, 2, 4, 1];
for (let i = 1; i < values.length; i++) {
  const current = values[i];
  let j = i - 1;
  while (j >= 0 && values[j] > current) {
    values[j + 1] = values[j];
    j--;
  }
  values[j + 1] = current;
  console.log(values.join(" "));
}
