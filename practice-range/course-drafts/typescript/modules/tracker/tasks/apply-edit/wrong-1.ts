export type Task = {id:string; done:boolean};
export function edit(tasks: readonly Task[], _id:string, done:boolean): Task[] { return tasks.map(t => ({...t,done})); }
