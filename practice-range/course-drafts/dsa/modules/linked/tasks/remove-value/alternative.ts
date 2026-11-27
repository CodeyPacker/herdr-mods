function removeValue(head: ListNode | null, target: number): ListNode | null {
  if (head === null) return null;
  head.next = removeValue(head.next, target);
  return head.value === target ? head.next : head;
}
