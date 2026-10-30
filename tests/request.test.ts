import { describe, it, expect } from "vitest";
import { sameOrigin } from "../src/lib/request";
describe("Protección de origen", () => {
  it("permite el origen del host aunque el proxy use una URL interna", () =>
    expect(
      sameOrigin(
        new Request("http://0.0.0.0:3000/api/admin", {
          headers: { origin: "http://localhost:3000", host: "localhost:3000" },
        }),
      ),
    ).toBe(true));
  it("rechaza otros sitios", () =>
    expect(
      sameOrigin(
        new Request("https://seven.example/api/admin", {
          headers: { origin: "https://otro.example", host: "seven.example" },
        }),
      ),
    ).toBe(false));
  it("rechaza un origen ausente o malformado", () => {
    expect(sameOrigin(new Request("https://seven.example"))).toBe(false);
    expect(
      sameOrigin(
        new Request("https://seven.example", { headers: { origin: "null" } }),
      ),
    ).toBe(false);
  });
});
