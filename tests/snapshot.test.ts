import { SnapshotList } from "../src/Snapshot";
import { SequenceNumber } from "../src/Format";

test("Snapshot and SnapshotList", () => {
  const list = new SnapshotList();
  expect(list.isEmpty()).toEqual(true);
  const snap1 = list.insert(new SequenceNumber(10));
  const snap2 = list.insert(new SequenceNumber(20));
  const snap3 = list.insert(new SequenceNumber(30));
  expect(list.newest()._sequenceNumber.value === 30);
  expect(list.oldest()._sequenceNumber.value === 10);
  list.delete(snap1);
  expect(list.isEmpty()).toEqual(false);
  list.delete(snap2);
  list.delete(snap3);
  expect(list.isEmpty()).toEqual(true);
});
