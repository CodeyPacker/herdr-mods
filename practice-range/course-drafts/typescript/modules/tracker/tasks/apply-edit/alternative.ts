export type Task = {id:string; done:boolean};
export function edit(tasks: readonly Task[], id: string, done: boolean): Task[] { const out: Task[] = []; for (const task of tasks) out.push(task.id === id ? {id:task.id, done} : task); return out; }
