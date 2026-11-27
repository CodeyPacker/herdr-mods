type ListNode = { value: number; next: ListNode | null };

const third: ListNode = { value: 30, next: null };
const second: ListNode = { value: 20, next: third };
const first: ListNode = { value: 10, next: second };

let hops = 0;
for (let node: ListNode | null = first; node !== null; node = node.next) {
  console.log(node.value);
  hops++;
}
console.log(hops);
