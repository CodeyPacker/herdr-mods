function removeValue(head: ListNode | null, target: number): ListNode | null {
  let node = head;
  while (node !== null && node.next !== null) {
    if (node.next.value === target) node.next = node.next.next;
    else node = node.next;
  }
  return head;
}
