const queue = ["a", "b", "c"];
let head = 0;
console.log(queue[head++], queue[head++]);
queue.push("d");
console.log(queue.slice(head).join(""), queue.length - head);
