import { describe, expect, it } from "vitest";

import { ariaSortFor, nextSort, pageRange, sortRows, type SortState } from "./table";

describe("nextSort", () => {
  it("cycles none -> asc -> desc -> none for any column", () => {
    let state: SortState = null;
    state = nextSort(state, "a");
    expect(state).toEqual({ column: "a", dir: "asc" });
    state = nextSort(state, "a");
    expect(state).toEqual({ column: "a", dir: "desc" });
    state = nextSort(state, "a");
    expect(state).toBeNull();
  });

  it("a default descending sort moves to the next state of the same cycle", () => {
    expect(nextSort({ column: "started", dir: "desc" }, "started")).toBeNull();
    expect(nextSort({ column: "started", dir: "asc" }, "started")).toEqual({ column: "started", dir: "desc" });
  });

  it("switching column starts ascending", () => {
    expect(nextSort({ column: "a", dir: "desc" }, "b")).toEqual({ column: "b", dir: "asc" });
  });
});

describe("ariaSortFor", () => {
  it("reports the state per column", () => {
    const state: SortState = { column: "a", dir: "desc" };
    expect(ariaSortFor(state, "a")).toBe("descending");
    expect(ariaSortFor(state, "b")).toBe("none");
    expect(ariaSortFor(null, "a")).toBe("none");
    expect(ariaSortFor({ column: "a", dir: "asc" }, "a")).toBe("ascending");
  });
});

describe("sortRows", () => {
  const rows = [{ n: 3 }, { n: null }, { n: 1 }, { n: 2 }];
  it("sorts numbers both ways and keeps missing values last", () => {
    expect(sortRows(rows, (r) => r.n, "asc").map((r) => r.n)).toEqual([1, 2, 3, null]);
    expect(sortRows(rows, (r) => r.n, "desc").map((r) => r.n)).toEqual([3, 2, 1, null]);
  });
  it("sorts text naturally and ignores case", () => {
    const names = [{ s: "run 10" }, { s: "Run 2" }, { s: "run 1" }];
    expect(sortRows(names, (r) => r.s, "asc").map((r) => r.s)).toEqual(["run 1", "Run 2", "run 10"]);
  });
  it("does not mutate the input", () => {
    const input = [{ n: 2 }, { n: 1 }];
    sortRows(input, (r) => r.n, "asc");
    expect(input[0].n).toBe(2);
  });
});

describe("pageRange", () => {
  it("is 1-based and inclusive", () => {
    expect(pageRange(0, 10, 34)).toEqual({ from: 1, to: 10 });
    expect(pageRange(3, 10, 34)).toEqual({ from: 31, to: 34 });
    expect(pageRange(0, 10, 0)).toEqual({ from: 0, to: 0 });
  });
});
