function reverseList(head: ListNode | null): ListNode | null {
  let previous: ListNode | null = null;
  let node = head;
  while (node !== null) {
    node.next = previous;
    previous = node;
    node = node.next;
  }
  return previous;
}
