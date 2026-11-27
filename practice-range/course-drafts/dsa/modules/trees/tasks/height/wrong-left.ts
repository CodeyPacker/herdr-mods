function height(root: TreeNode | null): number {
  if (root === null) return 0;
  return 1 + height(root.left);
}
