type TreeNode = { value: number; left: TreeNode | null; right: TreeNode | null };

/** Builds a tree node. Leave out a child to make it empty. */
function tree(value: number, left: TreeNode | null = null, right: TreeNode | null = null): TreeNode {
  return { value, left, right };
}

//            8
//          /   \
//         3     10
//        / \      \
//       1   6      14
//          / \    /
//         4   7  13
const __sample = tree(8, tree(3, tree(1), tree(6, tree(4), tree(7))), tree(10, null, tree(14, tree(13))));

// The checks count how many times your code reads a node's value in the large tree.
let __looks = 0;
function __build(low: number, high: number): TreeNode | null {
  if (low > high) return null;
  const middle = Math.floor((low + high) / 2);
  return {
    get value() { __looks++; return middle * 2; },
    left: __build(low, middle - 1),
    right: __build(middle + 1, high),
  };
}
const __large = __build(0, 4094);
function __countLooks(action: () => unknown): number {
  __looks = 0;
  action();
  return __looks;
}
