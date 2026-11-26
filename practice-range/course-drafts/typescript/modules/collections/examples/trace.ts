const tasks = [{ title: "Mail", open: true }, { title: "Pay", open: false }, { title: "Mail", open: true }];
const titles = tasks.filter(t => t.open).map(t => t.title);
console.log(titles.join(", "));
