function display(reading: Reading): string {
  if (reading.ok) return reading.degrees + " C";
  return "offline";
}
