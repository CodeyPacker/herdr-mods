export type Task = {id:string; done:boolean};
export function edit(tasks: readonly Task[], id: string, done: boolean): Task[] { return tasks.map(task => task.id === id ? {...task, done} : task); }
