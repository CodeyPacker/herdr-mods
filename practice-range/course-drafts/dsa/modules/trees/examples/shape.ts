type TreeNode = { value: number; left: TreeNode | null; right: TreeNode | null };
const leaf = (value: number): TreeNode => ({ value, left: null, right: null });

//        8
//       / \
//      3   10
//     / \
//    1   6
const root: TreeNode = {
  value: 8,
  left: { value: 3, left: leaf(1), right: leaf(6) },
  right: leaf(10),
};

function visit(node: TreeNode | null, depth: number): void {
  if (node === null) return;
  visit(node.left, depth + 1);
  console.log(node.value, depth);
  visit(node.right, depth + 1);
}

visit(root, 0);
