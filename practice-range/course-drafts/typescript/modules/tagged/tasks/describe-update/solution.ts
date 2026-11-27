function describe(workout: Workout): string {
  if (workout.kind === "planned") return "Next: " + workout.title;
  return "Minutes: " + String(workout.minutes);
}
