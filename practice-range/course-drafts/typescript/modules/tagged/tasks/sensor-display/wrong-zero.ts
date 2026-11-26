function display(reading: Reading): string {
  if (reading.ok) return reading.degrees ? reading.degrees + " C" : "";
  return reading.message;
}
