# Handshake

A network lab with the course beside the tools: read packets layer by layer, measure your connection, and learn how it all works.

[Open Handshake](https://jali.ramizrahman.com/apps/handshake/?preset=course) · [Source](https://github.com/ramiz-rahman/jali/tree/master/examples/handshake)

## What it shows

Each link opens Handshake in the state that shows it, so you can try it at once.

- **[A lesson drives the tools](https://jali.ramizrahman.com/apps/handshake/?preset=course)**: Step through a lesson: each step selects a packet, a probe or a scan, and the tools beside it follow. Following, two deep. ([how it works](https://jali.ramizrahman.com/learn/following))
- **[Four followers of one packet](https://jali.ramizrahman.com/apps/handshake/?preset=lab)**: Pick a packet: the dissection, the bytes, the layers and the sequence diagram each show it their own way. ([how it works](https://jali.ramizrahman.com/learn/following))
- **[Another component system](https://jali.ramizrahman.com/apps/handshake/?preset=connection)**: Built with CyberSpec's components, with Jali's frames, tabs and ⌘K set from CyberSpec's tokens. ([how it works](https://jali.ramizrahman.com/guides/theming))

## Its data

Bundled captures are generated, and say so. Your own .pcap files are read in the tab and never uploaded. Live measurements come from public endpoints, each named.

## Run it yourself

Run `pnpm handshake` at the repository's root, then open http://localhost:5360.
