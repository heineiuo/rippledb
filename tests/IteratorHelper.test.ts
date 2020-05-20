import IteratorHelper from "../src/IteratorHelper";

test("iterator helper", async (done) => {
  let asyncNumbersState = "none";
  let numbersState = "none";

  async function* asyncNumbers(): AsyncIterableIterator<number> {
    asyncNumbersState = "started";
    for (let i = 0; i < 100; i++) {
      yield i;
    }
    asyncNumbersState = "done";
  }

  function* numbers(): IterableIterator<number> {
    numbersState = "started";
    for (let i = 0; i < 100; i++) {
      yield i;
    }
    numbersState = "done";
  }

  for await (const i of IteratorHelper.wrap(asyncNumbers(), () => {
    asyncNumbersState = "break";
  })) {
    if (i > 10) break;
  }

  expect(asyncNumbersState).toBe("break");

  for (const i of IteratorHelper.wrap(numbers(), () => {
    numbersState = "break";
  })) {
    if (i > 10) break;
  }

  expect(numbersState).toBe("break");

  done();
});
