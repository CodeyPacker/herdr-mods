function removeValue(head: ListNode | null, target: number): ListNode | null {
  const before: ListNode = { value: 0, next: head };
  let node = before;
  while (node.next !== null) {
    if (node.next.value === target) node.next = node.next.next;
    else node = node.next;
  }
  return before.next;
}
