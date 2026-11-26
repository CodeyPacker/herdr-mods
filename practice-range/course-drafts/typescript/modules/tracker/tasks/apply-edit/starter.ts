export type Task = {id:string; done:boolean};
export function edit(tasks: readonly Task[], _id: string, _done: boolean): Task[] { return [...tasks]; }
