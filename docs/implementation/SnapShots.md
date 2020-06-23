# SnapShots

## API

```ts

type SnapShot = {
  prev(): T
  next(): T
  sequence: bigint
}

type LinkList<T> = {
  insertAfter(T): void
}

// methods in class Database: 
public getSnapShot():SnapShot
public releaseSnapShot(): void

// properties in class Database:
private snaphostList: LinkList<Snapshot>

```

## Mechanism

Every record has a `sequence`(`type bigint`) slice, higher `squence` means newer record. Call `getSnapshot` method will 
get current `sequence`(named 'a'), use this `sequence` cal always `get`
or `iterator` records older then `sequence` 'a'.

