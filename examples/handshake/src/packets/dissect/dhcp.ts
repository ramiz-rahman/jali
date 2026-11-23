/**
 * DHCP (RFC 2131) on its BOOTP frame: the fixed fields, the magic cookie, and the options that matter on a home
 * network: message type, requested address, server identifier, lease times, router, DNS servers, host name and the
 * parameter request list (which, with the vendor class, fingerprints the client's OS).
 */
import { ipv4, mac, type Src } from "../bytes";
import { DHCP_OPTIONS, DHCP_TYPES, named } from "../names";
import { header, top, type Ctx, type Fields } from "./core";

const TYPE_WHY: Record<number, string> = {
  1: "A client with no address broadcasts from 0.0.0.0: is there a DHCP server here? DORA's D.",
  2: "A server offers an address, a lease and the network's settings. Several servers may offer; the client picks one.",
  3: "The client asks for the offered address by name, still broadcast, so the other servers learn they weren't chosen.",
  5: "The server commits the lease. Only now may the client use the address (after an ARP probe to check nobody else has it).",
  6: "The server refuses: the requested address is wrong for this network, as after moving a laptop between networks.",
  7: "The client gives the address back early.",
  8: "A client that already has an address asks only for settings.",
};

function duration(s: number) {
  if (s === 0xffffffff) return "infinite";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${s} s${h || m ? ` (${h ? `${h} h` : ""}${h && m ? " " : ""}${m ? `${m} min` : ""})` : ""}`;
}

function option(F: Fields, s: Src, at: number, code: number, len: number): { type?: number } {
  const v = s.sub(at + 2, len);
  const name = named(DHCP_OPTIONS, code, "Option");
  const key = `opt${code}_${at}`;
  const total = len + 2;
  switch (code) {
    case 53: {
      const type = v.u8(0);
      F.f(key, `Option (53) ${name}`, named(DHCP_TYPES, type, "Type"), at, total, TYPE_WHY[type]);
      return { type };
    }
    case 1:
    case 50:
    case 54:
    case 28:
      F.f(
        key,
        `Option (${code}) ${name}`,
        ipv4(v.bytes(0, 4)),
        at,
        total,
        code === 54
          ? "Which server this is about: in a Request, it tells every server which offer was taken."
          : code === 50
            ? "The address the client wants: the offered one, or the one it had last time on this network."
            : undefined,
      );
      return {};
    case 3:
    case 6:
    case 42: {
      const list: string[] = [];
      for (let i = 0; i + 4 <= len; i += 4) list.push(ipv4(v.bytes(i, 4)));
      F.f(
        key,
        `Option (${code}) ${name}`,
        list.join(", "),
        at,
        total,
        code === 3
          ? "The default gateway: where packets for anywhere off this subnet go."
          : code === 6
            ? "The resolver the client will use. Usually the router itself, which forwards to the ISP's: whoever runs it sees every name you look up."
            : undefined,
      );
      return {};
    }
    case 51:
    case 58:
    case 59:
      F.f(
        key,
        `Option (${code}) ${name}`,
        duration(v.u32(0)),
        at,
        total,
        code === 51
          ? "How long the address is the client's. At T1 (half of it) the client renews with this server directly; at T2 (7/8) with any server."
          : undefined,
      );
      return {};
    case 12:
    case 15:
    case 60:
      F.f(
        key,
        `Option (${code}) ${name}`,
        new TextDecoder().decode(v.bytes(0, len)),
        at,
        total,
        code === 12
          ? "The client's name, sent in the clear: it is how your router's device list knows the laptop is called that."
          : code === 60
            ? "The client's software, as it likes to call itself: 'android-dhcp-14', 'MSFT 5.0'."
            : undefined,
      );
      return {};
    case 55: {
      const list = Array.from(v.bytes(0, len), (c) => `${c}`);
      F.f(
        key,
        `Option (55) ${name}`,
        list.join(", "),
        at,
        total,
        "Which options the client wants, in its own order. The list and its order differ per OS release: fingerbank.org identifies devices by it.",
      );
      return {};
    }
    case 61:
      F.f(
        key,
        `Option (61) ${name}`,
        len === 7 && v.u8(0) === 1 ? `Ethernet ${mac(v.bytes(1, 6))}` : `${len} bytes`,
        at,
        total,
        "What the server keys the lease on: usually the MAC, so the same device gets the same address back.",
      );
      return {};
    default:
      F.f(key, `Option (${code}) ${name}`, `${len} bytes`, at, total);
      return {};
  }
}

export function dissectDhcp(ctx: Ctx, s: Src) {
  header(
    ctx,
    {
      proto: "dhcp",
      short: "DHCP",
      name: "Dynamic Host Configuration Protocol",
      layer: "app",
      s,
      i: 0,
      n: s.length,
    },
    (F, _size, h) => {
      const op = s.u8(0);
      const xid = s.u32(4);
      const flags = s.u16(10);
      const chaddr = s.bytes(28, 6);
      F.f("op", "Message type", op === 1 ? "Boot Request (1)" : "Boot Reply (2)", 0, 1);
      F.f("htype", "Hardware type", s.u8(1) === 1 ? "Ethernet (1)" : `${s.u8(1)}`, 1, 1);
      F.f("hlen", "Hardware address length", `${s.u8(2)}`, 2, 1);
      F.f(
        "hops",
        "Hops",
        `${s.u8(3)}`,
        3,
        1,
        "Relay agents count themselves here; on a home network it is 0.",
      );
      F.f(
        "xid",
        "Transaction ID",
        `0x${xid.toString(16).padStart(8, "0")}`,
        4,
        4,
        "Chosen by the client and echoed by the server: it ties the four DORA messages together, since the client has no address yet to be told apart by.",
      );
      F.f("secs", "Seconds elapsed", `${s.u16(8)}`, 8, 2);
      F.f(
        "flags",
        "Bootp flags",
        flags & 0x8000 ? "0x8000 (Broadcast)" : "0x0000 (Unicast)",
        10,
        2,
        "Broadcast asks the server to broadcast its reply, for clients that can't receive unicast before they have an address.",
      );
      F.f("ciaddr", "Client IP address", ipv4(s.bytes(12, 4)), 12, 4);
      F.f(
        "yiaddr",
        "Your (client) IP address",
        ipv4(s.bytes(16, 4)),
        16,
        4,
        "The address being offered or assigned.",
      );
      F.f(
        "siaddr",
        "Next server IP address",
        ipv4(s.bytes(20, 4)),
        20,
        4,
        "For network boot (PXE): where to fetch the boot file.",
      );
      F.f("giaddr", "Relay agent IP address", ipv4(s.bytes(24, 4)), 24, 4);
      F.f(
        "chaddr",
        "Client MAC address",
        mac(chaddr),
        28,
        16,
        "The client's hardware address. A phone using a private Wi-Fi address shows the randomised one here, so the router sees a 'new' device per network.",
      );
      F.f("sname", "Server host name", "not given", 44, 64);
      F.f("file", "Boot file name", "not given", 108, 128);
      F.f(
        "cookie",
        "Magic cookie",
        s.u32(236) === 0x63825363 ? "DHCP" : `0x${s.u32(236).toString(16)}`,
        236,
        4,
        "99.130.83.99: what makes a BOOTP packet a DHCP one.",
      );
      let at = 240;
      let type: number | undefined;
      let hostname = "";
      while (at < s.length) {
        const code = s.u8(at);
        if (code === 0) {
          at += 1;
          continue;
        }
        if (code === 255) {
          F.f(`end${at}`, "Option (255) End", "", at, 1);
          break;
        }
        const len = s.u8(at + 1);
        const got = option(F, s, at, code, len);
        if (got.type !== undefined) type = got.type;
        if (code === 12) hostname = new TextDecoder().decode(s.bytes(at + 2, len));
        at += 2 + len;
      }
      h.value = named(DHCP_TYPES, type ?? 0, "Type");
      h.why = type !== undefined ? TYPE_WHY[type] : undefined;
      const name =
        type !== undefined
          ? named(DHCP_TYPES, type, "message")
          : op === 1
            ? "BOOTP request"
            : "BOOTP reply";
      top(
        ctx,
        "DHCP",
        `DHCP ${name} - Transaction ID 0x${xid.toString(16)}${hostname ? ` (${hostname})` : ""}`,
      );
    },
  );
}
