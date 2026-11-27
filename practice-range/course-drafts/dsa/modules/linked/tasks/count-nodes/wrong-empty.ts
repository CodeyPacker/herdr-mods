function countNodes(head: ListNode | null): number {
  let count = 1;
  let node = head!;
  while (node.next !== null) {
    count++;
    node = node.next;
  }
  return count;
}
