class TaskQueue {
  private inbox: string[] = [];
  private outbox: string[] = [];

  enqueue(title: string): void {
    this.inbox.push(title);
  }

  dequeue(): string | undefined {
    if (this.outbox.length === 0) {
      while (this.inbox.length > 0) this.outbox.push(this.inbox.pop()!);
    }
    return this.outbox.pop();
  }

  get size(): number {
    return this.inbox.length + this.outbox.length;
  }
}
