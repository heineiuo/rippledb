import { hash } from "../src/Hash";
import { Buffer } from "../src/Buffer";

// @ts-ignore make jest happy
global.TextEncoder = require("util").TextEncoder;

test("filter", () => {
  expect(hash(Buffer.fromString("kadff"), 1) % 15).toBe(4);
  const seed1 = Math.floor(Math.random() * 2e32);
  expect(hash(Buffer.fromString("adf132"), seed1) % 15).toBe(7);
});
