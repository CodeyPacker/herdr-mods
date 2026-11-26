function display(reading: Reading): string {
  if (reading.ok === false) return reading.message;
  return reading.degrees + " C";
}
