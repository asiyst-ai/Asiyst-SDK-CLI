export function clearCommand(): void {
  process.stdout.write("\x1b[2J\x1b[3J\x1b[H");
}
