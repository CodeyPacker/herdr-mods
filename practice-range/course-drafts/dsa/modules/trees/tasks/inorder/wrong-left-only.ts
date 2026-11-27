function inorder(root: TreeNode | null): number[] {
  if (root === null) return [];
  return [...inorder(root.left), root.value];
}
