function levelSums(root: TreeNode | null): number[] {
  const sums: number[] = [];
  function visit(node: TreeNode | null, depth: number): void {
    if (node === null) return;
    sums[depth] = (sums[depth] ?? 0) + node.value;
    visit(node.left, depth + 1);
    visit(node.right, depth + 1);
  }
  visit(root, 0);
  return sums;
}
