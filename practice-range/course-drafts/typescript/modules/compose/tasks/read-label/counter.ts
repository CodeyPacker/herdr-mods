export class Counter { constructor(public readonly title: string, private count: number) {} value(): number { return this.count; } }
