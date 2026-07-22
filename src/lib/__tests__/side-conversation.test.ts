import { SIDE_CONVERSATION_PARENT_FIELD_KEY } from "../side-conversation";

describe("SIDE_CONVERSATION_PARENT_FIELD_KEY", () => {
  it("is exactly tu.side_conversation_parent (CORE-01 / D-01 / D-02 guard)", () => {
    expect(SIDE_CONVERSATION_PARENT_FIELD_KEY).toBe(
      "tu.side_conversation_parent"
    );
  });
});
