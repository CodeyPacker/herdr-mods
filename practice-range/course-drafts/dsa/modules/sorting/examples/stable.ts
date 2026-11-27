const tasks = [
  { title: "write", priority: 2 },
  { title: "call", priority: 1 },
  { title: "plan", priority: 2 },
  { title: "mail", priority: 1 },
];
tasks.sort((a, b) => a.priority - b.priority);
console.log(tasks.map(task => task.title).join(" "));

const numbers = [10, 9, 1, 100];
console.log([...numbers].sort().join(" "));
console.log([...numbers].sort((a, b) => a - b).join(" "));
