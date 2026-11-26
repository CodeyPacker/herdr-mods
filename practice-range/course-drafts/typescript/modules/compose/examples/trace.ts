class Counter {
 constructor(public readonly title: string, private count: number) {}
 value(): number { return this.count; }
}
const counter = new Counter("Open", 2);
const double = (value: number): number => value * 2;
console.log(counter.title);
console.log(double(counter.value()));
