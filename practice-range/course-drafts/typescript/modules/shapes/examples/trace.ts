type Task = { id: number; title: string };
const original: Task = { id: 4, title: "Mail" };
const renamed = { ...original, title: "Post" };
console.log(original.title);
console.log(renamed.title);
