interface Sent { kind: "sent"; receipt: string }
interface Failed { kind: "failed"; reason: string }
type Delivery = Sent | Failed;
