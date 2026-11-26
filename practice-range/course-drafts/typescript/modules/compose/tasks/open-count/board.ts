export type Task = { title: string; done: boolean };
export class Board {
  constructor(private readonly tasks: readonly Task[]) {}
  all(): readonly Task[] { return this.tasks; }
}
