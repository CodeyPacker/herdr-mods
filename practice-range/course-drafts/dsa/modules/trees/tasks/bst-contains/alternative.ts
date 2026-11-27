function bstContains(root: TreeNode | null, target: number): boolean {
  if (root === null) return false;
  const value = root.value;
  if (target === value) return true;
  return target < value ? bstContains(root.left, target) : bstContains(root.right, target);
}
