import { describe, expect, it } from "vitest";

import { equals, satisfies } from "./condition.ts";

describe("satisfies", () => {
  it("carries the path and tests the value with the given predicate", () => {
    const condition = satisfies(["plan"], (value: string) => value === "pro");

    expect(condition.path).toEqual(["plan"]);
    expect(condition.test("pro")).toBe(true);
    expect(condition.test("free")).toBe(false);
  });

  it("negate inverts the test while keeping the path", () => {
    const condition = satisfies(["plan"], (value: string) => value === "pro");
    const negated = condition.negate();

    expect(negated.path).toEqual(["plan"]);
    expect(negated.test("pro")).toBe(false);
    expect(negated.test("free")).toBe(true);
  });
});

describe("equals", () => {
  it("tests strict equality against the given value", () => {
    const condition = equals<string, readonly ["plan"]>(["plan"], "pro");

    expect(condition.path).toEqual(["plan"]);
    expect(condition.test("pro")).toBe(true);
    expect(condition.test("free")).toBe(false);
  });
});
