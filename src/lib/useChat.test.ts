import { mergeMessages } from "./useChat";
import type { ChatMessage } from "./types";

const msg = (id: number, content = `m${id}`): ChatMessage => ({ id, room: "general", user_id: 1, user_name: "A B.", content, created_at: "2026-01-01T00:00:00Z" });

describe("mergeMessages", () => {
  it("dedupes by id and keeps ascending order", () => {
    const out = mergeMessages([msg(3), msg(1)], [msg(2), msg(3, "newer"), msg(4)]);
    expect(out.map((m) => m.id)).toEqual([1, 2, 3, 4]);
    expect(out[2]!.content).toBe("newer");
  });
  it("handles empty inputs", () => {
    expect(mergeMessages([], [])).toEqual([]);
    expect(mergeMessages([msg(1)], []).length).toBe(1);
  });
});
