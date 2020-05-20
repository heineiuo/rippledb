export default function assert(bool: boolean, message?: string): void {
  try {
    if (!bool) {
      throw new Error();
    }
  } catch (e) {
    throw new Error(`AssertError: ${message || e.stack[0]}`);
  }
}
