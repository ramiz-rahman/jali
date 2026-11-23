/** QUIC Initial protection against RFC 9001 Appendix A: keys, the header protection mask, and both sample packets. */
import { hex } from "./bytes";
import { CLIENT_CRYPTO_FRAME, CLIENT_INITIAL, SERVER_INITIAL } from "./fixtures/rfc9001";
import { fromHex, hpMask, initialKeys, openInitial, parseLong, sealInitial } from "./quic-crypto";

const DCID = fromHex("8394c8f03e515708");

describe("Initial keys (A.1)", () => {
  it("derives the client's", async () => {
    const k = await initialKeys(DCID, "client");
    expect(hex(k.secret)).toBe("c00cf151ca5be075ed0ebfb5c80323c42d6b7db67881289af4008f1f6c357aea");
    expect(hex(k.key)).toBe("1f369613dd76d5467730efcbe3b1a22d");
    expect(hex(k.iv)).toBe("fa044b2f42a3fd3b46fb255c");
    expect(hex(k.hp)).toBe("9f50449e04a0e810283a1e9933adedd2");
  });

  it("derives the server's", async () => {
    const k = await initialKeys(DCID, "server");
    expect(hex(k.key)).toBe("cf3a5331653c364c88f0f379b6067e37");
    expect(hex(k.iv)).toBe("0ac1493ca1905853b0bba03e");
    expect(hex(k.hp)).toBe("c206b8d9b9f0f37644430b490eeaa314");
  });
});

describe("header protection", () => {
  it("masks with AES-ECB emulated by one block of AES-CBC (A.2)", async () => {
    const k = await initialKeys(DCID, "client");
    expect(hex(await hpMask(k.hp, fromHex("d1b1c98dd7689fb8ec11d242b123dc9b")))).toBe("437b9aec36");
  });
});

describe("opening", () => {
  it("decrypts the client Initial (A.2)", async () => {
    const opened = await openInitial(fromHex(CLIENT_INITIAL), await initialKeys(DCID, "client"));
    if (typeof opened === "string") throw new Error(opened);
    expect(opened.pn).toBe(2);
    expect(opened.pnLength).toBe(4);
    expect(opened.plaintext.length).toBe(1162);
    const frame = fromHex(CLIENT_CRYPTO_FRAME);
    expect(hex(opened.plaintext.subarray(0, frame.length))).toBe(hex(frame));
    expect(opened.plaintext.subarray(frame.length).every((b) => b === 0)).toBe(true);
    expect(hex(opened.plain.subarray(0, 22))).toBe("c300000001088394c8f03e5157080000449e00000002");
  });

  it("decrypts the server Initial (A.3) with keys from the client's DCID", async () => {
    const opened = await openInitial(fromHex(SERVER_INITIAL), await initialKeys(DCID, "server"));
    if (typeof opened === "string") throw new Error(opened);
    expect(opened.pn).toBe(1);
    expect(hex(opened.plaintext)).toMatch(/^02000000000600405a020000560303eefce7f7b37ba1d163/);
    expect(hex(parseLong(opened.plain).scid)).toBe("f067a5502a4262b5");
  });

  it("says so when the keys are wrong", async () => {
    const opened = await openInitial(fromHex(SERVER_INITIAL), await initialKeys(DCID, "client"));
    expect(opened).toMatch(/did not verify/);
  });
});

describe("sealing", () => {
  it("reproduces the server Initial byte for byte (A.3)", async () => {
    const header = fromHex("c1000000010008f067a5502a4262b50040750001");
    const payload = fromHex(
      "02000000000600405a020000560303eefce7f7b37ba1d1632e96677825ddf73988cfc79825df566dc5430b9a045a1200" +
        "130100002e00330024001d00209d3c940d89690b84d08a60993c144eca684d1081287c834d5311bcf32bb9da1a002b00020304",
    );
    const sealed = await sealInitial(header, 2, 1, payload, await initialKeys(DCID, "server"));
    expect(hex(sealed)).toBe(hex(fromHex(SERVER_INITIAL)));
  });
});
