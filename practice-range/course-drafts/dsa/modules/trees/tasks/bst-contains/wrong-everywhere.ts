function bstContains(root: TreeNode | null, target: number): boolean {
  if (root === null) return false;
  if (root.value === target) return true;
  return bstContains(root.left, target) || bstContains(root.right, target);
}
