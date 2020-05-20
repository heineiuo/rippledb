import Status from "../src/Status";

test("status", async () => {
  const status1 = new Status(
    new Promise((resolve, reject) =>
      setTimeout(() => {
        reject(new Error("error1"));
      }, 1000),
    ),
  );
  expect(await status1.ok()).toBe(false);
  expect(status1.message()).toBe("error1");
});
