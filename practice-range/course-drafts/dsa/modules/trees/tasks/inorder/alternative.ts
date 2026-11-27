function inorder(root: TreeNode | null): number[] {
  const values: number[] = [];
  const waiting: TreeNode[] = [];
  let node = root;
  while (node !== null || waiting.length > 0) {
    while (node !== null) {
      waiting.push(node);
      node = node.left;
    }
    const next = waiting.pop()!;
    values.push(next.value);
    node = next.right;
  }
  return values;
}
