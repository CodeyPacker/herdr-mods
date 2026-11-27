function levelSums(root: TreeNode | null): number[] {
  const sums: number[] = [];
  const queue: [TreeNode | null, number][] = [[root, 0]];
  for (let head = 0; head < queue.length; head++) {
    const [node, depth] = queue[head];
    if (node === null) continue;
    sums[depth] = (sums[depth] ?? 0) + node.value;
    queue.push([node.left, depth + 1], [node.right, depth + 1]);
  }
  return sums;
}
