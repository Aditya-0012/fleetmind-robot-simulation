/**
 * Binary Min-Heap based Priority Queue.
 *
 * Stored as an implicit complete binary tree inside an array:
 *   parent(i) = floor((i - 1) / 2),  left(i) = 2i + 1,  right(i) = 2i + 2
 *
 * Complexity:
 *   push      O(log n)  — append then sift up
 *   pop       O(log n)  — move last to root then sift down
 *   peek      O(1)
 *   size      O(1)
 *
 * A* and Dijkstra use "lazy deletion": when a node's priority improves we push a new
 * entry instead of performing decrease-key, and skip stale entries when popped.
 * This keeps the heap simple while preserving O((V + E) log V) behaviour.
 */
export class MinHeap<T> {
  private readonly data: T[] = [];
  private readonly compare: (a: T, b: T) => number;

  /** compare(a, b) < 0 means `a` has higher priority (comes out first). */
  constructor(compare: (a: T, b: T) => number) {
    this.compare = compare;
  }

  get size(): number {
    return this.data.length;
  }

  isEmpty(): boolean {
    return this.data.length === 0;
  }

  peek(): T | undefined {
    return this.data[0];
  }

  push(item: T): void {
    this.data.push(item);
    this.siftUp(this.data.length - 1);
  }

  pop(): T | undefined {
    const n = this.data.length;
    if (n === 0) return undefined;
    const top = this.data[0];
    const last = this.data.pop() as T;
    if (n > 1) {
      this.data[0] = last;
      this.siftDown(0);
    }
    return top;
  }

  toArray(): T[] {
    return [...this.data];
  }

  private siftUp(i: number): void {
    const d = this.data;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.compare(d[i], d[p]) >= 0) break;
      [d[i], d[p]] = [d[p], d[i]];
      i = p;
    }
  }

  private siftDown(i: number): void {
    const d = this.data;
    const n = d.length;
    for (;;) {
      const l = 2 * i + 1;
      const r = l + 1;
      let best = i;
      if (l < n && this.compare(d[l], d[best]) < 0) best = l;
      if (r < n && this.compare(d[r], d[best]) < 0) best = r;
      if (best === i) return;
      [d[i], d[best]] = [d[best], d[i]];
      i = best;
    }
  }
}
