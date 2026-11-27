function inorder(root: TreeNode | null): number[] {
  if (root === null) return [];
  return [root.value, ...inorder(root.left), ...inorder(root.right)];
}
