function height(root: TreeNode | null): number {
  if (root === null) return 0;
  return 1 + Math.max(height(root.left), height(root.right));
}
