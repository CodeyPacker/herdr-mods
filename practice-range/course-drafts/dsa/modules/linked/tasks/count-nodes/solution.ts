function countNodes(head: ListNode | null): number {
  let count = 0;
  for (let node = head; node !== null; node = node.next) count++;
  return count;
}
