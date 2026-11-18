import { describe, expect, it } from "vitest";
import { registrationFee } from "../src/lib/pricing";

describe("registration price", () => {
  it("uses the category price instead of the general amount", () => {
    for (const price of [12000, 15000, 20000]) {
      expect(
        registrationFee({ amount: 20000 }, { registration_fee: price }),
      ).toBe(price);
    }
  });
  it("keeps the general price for categories without an override", () => {
    expect(registrationFee({ amount: 20000 })).toBe(20000);
    expect(registrationFee({ amount: 20000 }, { registration_fee: null })).toBe(
      20000,
    );
  });
});
