/** The probe store's reads: a domain not yet probed reads the same every time, as React's store hook needs. */
import { isPending, probeOf, probeStore } from "./probe";

describe("probe store", () => {
  it("gives one blank probe per domain until it is started", () => {
    const a = probeOf(probeStore.get(), "example.com");
    expect(probeOf(probeStore.get(), "example.com")).toBe(a);
    expect(probeOf(probeStore.get(), "example.org")).not.toBe(a);
    expect(a.rdap.status).toBe("idle");
    expect(isPending(a)).toBe(false);
  });
});
