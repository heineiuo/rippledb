import { SnapshotList } from "../src/Snapshot";

test("Snapshot and SnapshotList", () => {
  const list = new SnapshotList();
  expect(list.isEmpty()).toEqual(true);
  const snap1 = list.insert(10n);
  const snap2 = list.insert(20n);
  const snap3 = list.insert(30n);
  expect(list.newest()._sequenceNumber === 30n);
  expect(list.oldest()._sequenceNumber === 10n);
  list.delete(snap1);
  expect(list.isEmpty()).toEqual(false);
  list.delete(snap2);
  list.delete(snap3);
  expect(list.isEmpty()).toEqual(true);
});
