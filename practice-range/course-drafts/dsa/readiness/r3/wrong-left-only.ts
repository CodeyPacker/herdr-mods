function levelSums(root: TreeNode | null): number[] {
  const sums: number[] = [];
  let depth = 0;
  for (let node = root; node !== null; node = node.left) {
    sums[depth] = node.value;
    depth++;
  }
  return sums;
}
