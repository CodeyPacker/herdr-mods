function countdown(n: number): void {
  if (n === 0) {
    console.log("done");
    return;
  }
  console.log(n);
  countdown(n - 1);
  console.log("back", n);
}

countdown(2);
