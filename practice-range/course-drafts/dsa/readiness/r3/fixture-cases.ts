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
