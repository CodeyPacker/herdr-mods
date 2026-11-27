function height(root: TreeNode | null): number {
  let tallest = 0;
  const waiting: [TreeNode | null, number][] = [[root, 1]];
  while (waiting.length > 0) {
    const [node, depth] = waiting.pop()!;
    if (node === null) continue;
    tallest = Math.max(tallest, depth);
    waiting.push([node.left, depth + 1], [node.right, depth + 1]);
  }
  return tallest;
}
