export class Problem extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}
export function requireThat(
  condition: unknown,
  message: string,
  status = 400,
): asserts condition {
  if (!condition) throw new Problem(message, status);
}
