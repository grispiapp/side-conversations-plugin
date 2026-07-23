import { htmlToText } from "../html-to-text";

describe("htmlToText", () => {
  it("strips tags from a typical Grispi comment body (UAT Defect 1)", () => {
    expect(htmlToText("<p>Yeni ambalaj örneği gönderildi.</p> (TEST)")).toBe(
      "Yeni ambalaj örneği gönderildi. (TEST)"
    );
  });

  it("yields only the inner text of a script tag — never markup (T-01)", () => {
    expect(htmlToText("<script>alert(1)</script>")).toBe("alert(1)");
    expect(htmlToText('<img src=x onerror="alert(1)">merhaba')).toBe("merhaba");
  });

  it("decodes basic entities", () => {
    expect(htmlToText("A &amp; B &lt;tag&gt; &quot;q&quot; &#39;s&#39;")).toBe(
      "A & B <tag> \"q\" 's'"
    );
    expect(htmlToText("bo&nbsp;şluk")).toBe("bo şluk");
  });

  it("does not double-decode (&amp;lt; stays a literal &lt;)", () => {
    expect(htmlToText("&amp;lt;p&amp;gt;")).toBe("&lt;p&gt;");
  });

  it("collapses whitespace across block tags and trims", () => {
    expect(htmlToText("<p>ilk</p>\n<p>ikinci   satır</p>")).toBe(
      "ilk ikinci satır"
    );
  });

  it("passes plain text through unchanged", () => {
    expect(htmlToText("Merhaba, sipariş durumu nedir?")).toBe(
      "Merhaba, sipariş durumu nedir?"
    );
    expect(htmlToText("")).toBe("");
  });
});
