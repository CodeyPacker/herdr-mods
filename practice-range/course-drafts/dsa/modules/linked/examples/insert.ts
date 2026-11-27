type ListNode = { value: number; next: ListNode | null };

const c: ListNode = { value: 3, next: null };
const a: ListNode = { value: 1, next: c };

// Insert b between a and c. Copy the old link first.
const b: ListNode = { value: 2, next: a.next };
a.next = b;

console.log(a.next.value, b.next?.value, c.next);
