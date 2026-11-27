class TaskQueue {
  private items: string[] = [];
  private head = 0;

  enqueue(title: string): void {
    this.items.push(title);
  }

  dequeue(): string | undefined {
    return this.items[this.head++];
  }

  get size(): number {
    return this.items.length - this.head;
  }
}
