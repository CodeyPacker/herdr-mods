function bstContains(root: TreeNode | null, target: number): boolean {
  let node = root;
  while (node !== null) {
    const value = node.value;
    if (target === value) return true;
    node = target < value ? node.left : node.right;
  }
  return false;
}
