class TaskQueue {
  private items: string[] = [];

  enqueue(title: string): void {
    this.items.push(title);
  }

  dequeue(): string | undefined {
    return this.items.pop();
  }

  get size(): number {
    return this.items.length;
  }
}
