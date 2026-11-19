import { describe, expect, it } from "vitest";

import { CsvError, parseCsv, parseCsvObjects } from "./csv";

describe("parseCsv", () => {
  it("parses simple rows with LF and CRLF line ends", () => {
    expect(parseCsv("a,b\n1,2\r\n3,4")).toEqual([
      ["a", "b"],
      ["1", "2"],
      ["3", "4"],
    ]);
  });

  it("handles quoted commas, doubled quotes and line breaks inside quotes", () => {
    expect(parseCsv('x,"a, b","say ""hi""","line1\nline2"')).toEqual([
      ["x", "a, b", 'say "hi"', "line1\nline2"],
    ]);
  });

  it("strips a UTF-8 BOM and skips blank lines", () => {
    expect(parseCsv("﻿a,b\n\n,\n1,2\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("keeps empty fields", () => {
    expect(parseCsv("a,,c")).toEqual([["a", "", "c"]]);
  });

  it("rejects an unclosed quote", () => {
    expect(() => parseCsv('a,"oops')).toThrow(CsvError);
  });

  it("rejects stray quotes and text after a closing quote", () => {
    expect(() => parseCsv('ab"c,d')).toThrow(CsvError);
    expect(() => parseCsv('"abc"x,d')).toThrow(CsvError);
  });
});

describe("parseCsvObjects", () => {
  it("maps rows to lower-cased, trimmed headers", () => {
    expect(
      parseCsvObjects(" Prompt_Text , Intent \nbest shoes?, discovery \n"),
    ).toEqual([{ prompt_text: "best shoes?", intent: "discovery" }]);
  });

  it("fills missing trailing cells with empty strings", () => {
    expect(parseCsvObjects("a,b,c\n1")).toEqual([{ a: "1", b: "", c: "" }]);
  });

  it("returns nothing for empty input", () => {
    expect(parseCsvObjects("")).toEqual([]);
  });

  it("rejects duplicate or empty headers and over-long rows", () => {
    expect(() => parseCsvObjects("a,a\n1,2")).toThrow(CsvError);
    expect(() => parseCsvObjects("a,\n1,2")).toThrow(CsvError);
    expect(() => parseCsvObjects("a,b\n1,2,3")).toThrow(CsvError);
  });
});
