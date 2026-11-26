export type Task = {id:string; done:boolean};
export function edit(tasks: readonly Task[], id:string, done:boolean): Task[] { return tasks.map(t => { if(t.id===id) t.done=done; return t; }); }
