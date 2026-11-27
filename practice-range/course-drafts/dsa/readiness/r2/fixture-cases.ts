type ListNode = { value: number; next: ListNode | null };

/** Builds a linked list from an array and returns its first node. */
function listOf(values: number[]): ListNode | null {
  let head: ListNode | null = null;
  for (let index = values.length - 1; index >= 0; index--) head = { value: values[index], next: head };
  return head;
}

/** Reads a linked list back into an array. It stops after 1,000 nodes. */
function toArray(head: ListNode | null): number[] {
  const values: number[] = [];
  for (let node = head; node !== null && values.length < 1000; node = node.next) values.push(node.value);
  return values;
}
