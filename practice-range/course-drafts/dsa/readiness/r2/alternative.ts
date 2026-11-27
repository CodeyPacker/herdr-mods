function mergeLists(a: ListNode | null, b: ListNode | null): ListNode | null {
  if (a === null) return b;
  if (b === null) return a;
  if (a.value <= b.value) {
    a.next = mergeLists(a.next, b);
    return a;
  }
  b.next = mergeLists(a, b.next);
  return b;
}
