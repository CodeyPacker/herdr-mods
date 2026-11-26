// Supplied tracker types. The checks call your code directly.
type TaskStatus = "open" | "blocked" | "done";
interface TrackerTask { id: string; title: string; status: TaskStatus; owner?: string }
