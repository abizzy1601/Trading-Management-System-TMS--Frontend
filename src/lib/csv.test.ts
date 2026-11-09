import { csvCell, toCsv } from "./csv";

describe("csv", () => {
  it("quotes cells with commas, quotes and newlines", () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("line\nbreak")).toBe('"line\nbreak"');
  });
  it("neutralises formula injection in text but leaves numbers alone", () => {
    expect(csvCell("=HYPERLINK(\"x\")")).toBe('"\'=HYPERLINK(""x"")"');
    expect(csvCell("+1+1")).toBe("'+1+1");
    expect(csvCell("-2")).toBe("'-2");
    expect(csvCell(-2.5)).toBe("-2.5");
  });
  it("builds rows", () => {
    expect(toCsv(["a", "b"], [[1, "x"], [null, "y,z"]])).toBe('a,b\r\n1,x\r\n,"y,z"');
  });
});
