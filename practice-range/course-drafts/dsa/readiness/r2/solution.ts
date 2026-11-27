function mergeLists(a: ListNode | null, b: ListNode | null): ListNode | null {
  const before: ListNode = { value: 0, next: null };
  let tail = before;
  while (a !== null && b !== null) {
    if (a.value <= b.value) {
      tail.next = a;
      a = a.next;
    } else {
      tail.next = b;
      b = b.next;
    }
    tail = tail.next;
  }
  tail.next = a ?? b;
  return before.next;
}
