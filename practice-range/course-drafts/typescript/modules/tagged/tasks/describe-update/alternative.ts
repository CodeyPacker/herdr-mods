function describe(workout: Workout): string {
  if (workout.kind === "done") return "Minutes: " + workout.minutes;
  return "Next: " + workout.title;
}
