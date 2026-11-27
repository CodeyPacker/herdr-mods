function countNodes(head: ListNode | null): number {
  return head === null ? 0 : 1 + countNodes(head.next);
}
