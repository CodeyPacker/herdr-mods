type TreeNode = { value: number; left: TreeNode | null; right: TreeNode | null };
const leaf = (value: number): TreeNode => ({ value, left: null, right: null });

const root: TreeNode = {
  value: 8,
  left: { value: 3, left: leaf(1), right: leaf(6) },
  right: leaf(10),
};

function path(target: number): number[] {
  const looked: number[] = [];
  let node: TreeNode | null = root;
  while (node !== null) {
    looked.push(node.value);
    if (target === node.value) break;
    node = target < node.value ? node.left : node.right;
  }
  return looked;
}

console.log(path(6).join(" "));
console.log(path(9).join(" "));
