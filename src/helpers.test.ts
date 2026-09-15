import { describe, expect, it } from "vitest";

import { configItem, hashKey, parseQuery } from "./helpers.ts";

describe("configItem", () => {
  it("wraps the element with label and title", () => {
    const el = document.createElement("input");
    const wrapper = configItem("field-id", el, "Field Label", "A hint");

    expect(wrapper.className).toBe("config-item");
    expect(wrapper.getAttribute("title")).toBe("A hint");

    const label = wrapper.querySelector("label");
    expect(label?.getAttribute("for")).toBe("field-id");
    expect(label?.textContent).toBe("Field Label");
    expect(wrapper.contains(el)).toBe(true);
  });

  it("omits the title attribute and label element when not given", () => {
    const el = document.createElement("input");
    const wrapper = configItem("field-id", el);

    expect(wrapper.hasAttribute("title")).toBe(false);
    expect(wrapper.querySelector("label")).toBeNull();
  });
});

describe("hashKey", () => {
  it("URL-encodes the key when there's no hash length", () => {
    expect(hashKey("hello world", null)).toBe("hello%20world");
  });

  it("hashes the key to a fixed-length base64 string when given a hash length", () => {
    const result = hashKey("hello", 6);
    expect(result).toHaveLength(6);
    expect(hashKey("hello", 6)).toBe(result);
    expect(hashKey("goodbye", 6)).not.toBe(result);
  });
});

describe("parseQuery", () => {
  it("parses key/value pairs without a hash length", () => {
    expect(parseQuery("a=1&b=2", null)).toStrictEqual({ a: "1", b: "2" });
  });

  it("URL-decodes values", () => {
    expect(parseQuery("a=hello%20world", null)).toStrictEqual({
      a: "hello world",
    });
  });

  it("returns an empty object for an empty query", () => {
    expect(parseQuery("", null)).toStrictEqual({});
  });

  it("parses fixed-length hashed keys", () => {
    const key = hashKey("field", 6);
    expect(parseQuery(`${key}value`, 6)).toStrictEqual({ [key]: "value" });
  });
});
