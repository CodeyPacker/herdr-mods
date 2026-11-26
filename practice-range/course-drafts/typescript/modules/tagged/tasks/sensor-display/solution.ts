function display(reading: Reading): string {
  if (reading.ok) return String(reading.degrees) + " C";
  return reading.message;
}
