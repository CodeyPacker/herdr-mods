// A supplied class. It reads from a local source and never touches the network.
export class TaskStore {
  constructor(private readonly source: () => Promise<unknown>) {}
  async read(): Promise<unknown> {
    return this.source();
  }
}
