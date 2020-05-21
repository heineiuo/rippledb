import { Buffer } from "../build/Buffer";

function bufferFromArrayBuffer(number: number, times: number): Buffer {
  let i = 0;
  let buf;
  while (i < times) {
    buf = Buffer.fromUnknown(new ArrayBuffer(number));
    i++;
  }
  return buf;
}

function bufferAlloc(number: number, times: number): Buffer {
  let i = 0;
  let buf;
  while (i < times) {
    buf = Buffer.alloc(number);
    i++;
  }
  return buf;
}

function bench(number, times): void {
  console.time(`bufferFromArrayBuffer number=${number} times=${times}`);
  bufferFromArrayBuffer(number, times);
  console.timeEnd(`bufferFromArrayBuffer number=${number} times=${times}`);
  console.time(`bufferFromAllocBuffer number=${number} times=${times}`);
  bufferAlloc(number, times);
  console.timeEnd(`bufferFromAllocBuffer number=${number} times=${times}`);
  console.log("");
}

function main(): void {
  bufferFromArrayBuffer(100, 100);
  bufferAlloc(100, 100);

  bench(100, 10000);
  bench(200, 10000);
  bench(300, 10000);
  bench(400, 10000);
  bench(500, 10000);
  bench(1000, 10000);
  bench(2000, 10000);
  bench(3000, 10000);
}

main();
