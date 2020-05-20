export default function assert(bool: boolean, message?: string): void {
  try {
    if (!bool) {
      throw new Error();
    }
  } catch (e) {
    throw new Error(`AssertError: ${message || e.stack[0]}`);
  }
}

assert.equal = function (value1: any, value2: any, message: string): void {
  try {
    if (value1 !== value2) {
      throw new Error();
    }
  } catch (e) {
    throw new Error(`AssertError: ${message || e.stack[0]}`);
  }
};
