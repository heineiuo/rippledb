# SnapShots

## API

```ts

type SnapShot = {
  _prev: Snapshot
  _next: Snapshot
  sequenceNumber: SequenceNumber | bigint
}

type SnapshotList = {
  isEmpty(): boolean
  insert(): Snapshot
  newest(): Snapshot
  oldest(): Snapshot
  delete(snapshot: Snapshot): void
}

// methods in class Database: 
public getSnapShot(): SnapShot
public releaseSnapShot(snapshot: Snapshot): void

// properties in class Database:
private _snaphostList: SnapshotList

```

## Mechanism

Every record has a `sequence`(`type bigint`) slice, higher `squence` 
means newer record. Call `getSnapshot` method will 
get current `sequence`(named 'a'), use this `sequence` cal always `get`
or `iterator` records older then `sequence` 'a'.

If a snapshot is created, compaction will keep the records that has `sequence` 
bigger then or equal with this snapshot's `sequence`. So entire records will 
kept in query lifecycle.

In a single-statement transaction, lifecycle look like this steps:

1. Get a snapshot and then `get` or `iterate` records with this snapshot
2. Create a `WriteBatch` and commit changes to it
3. Batch this `WriteBatch` if transaction success
4. Drop this `WriteBatch` (Just do nothing) as a transaction rollback
5. Release the snapshot

## Questions

### 1. Will two transactions make conflict changes?

No. Newer operation will always overwrite older operation. 