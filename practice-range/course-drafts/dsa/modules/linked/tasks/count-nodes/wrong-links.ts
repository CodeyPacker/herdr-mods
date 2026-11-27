function countNodes(head: ListNode | null): number {
  let count = 0;
  let node = head;
  while (node !== null && node.next !== null) {
    count++;
    node = node.next;
  }
  return count;
}
