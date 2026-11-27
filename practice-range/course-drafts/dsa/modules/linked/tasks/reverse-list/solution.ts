function reverseList(head: ListNode | null): ListNode | null {
  let previous: ListNode | null = null;
  let node = head;
  while (node !== null) {
    const next = node.next;
    node.next = previous;
    previous = node;
    node = next;
  }
  return previous;
}
