import BitBuffer from "../src/BitBuffer";
import { Buffer } from "../third_party/buffer";

test("BitBuffer", (done) => {
  const arr1 = new BitBuffer(Buffer.alloc(Math.ceil(32 / 8)));
  arr1.set(20, true);
  arr1.set(35, true);
  arr1.set(40, false);

  const arr2 = new BitBuffer(arr1.buffer);

  expect(arr2.get(20)).toBe(true);
  expect(arr2.get(40)).toBe(false);
  expect(arr2.get(50)).toBe(false);
  done();
});
