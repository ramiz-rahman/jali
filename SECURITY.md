# Security

## Supported versions

Jali is before 1.0: only the latest release of `jali-layout` on npm gets security fixes.

## Reporting a vulnerability

Please don't open a public issue. Report it privately through GitHub: **[Report a vulnerability](https://github.com/ramiz-rahman/jali/security/advisories/new)** (the repository's Security tab, then "Report a vulnerability").

Say what an attacker can do, which version and entry (`jali-layout`, `jali-layout/react`, `jali-layout/url`, …) it is in, and how to reproduce it. A small page or a test that shows it is the most helpful.

You'll hear back within a week. Once it's confirmed, the fix is made in a private fork, released, and published as a GitHub security advisory that credits you, unless you'd rather not be named.

## What counts

Jali runs in the page of the app that uses it, so the reports that matter most are those where content an app doesn't control gets to act: a pane title, a stored layout, a URL or a pasted value that runs script, reads another pane's data, or escapes a pop-out window. The example apps and the docs site are demos; a problem there is welcome, but it is not a vulnerability in the package.

## Releases

Each release is published from GitHub Actions by npm's trusted publishing, with [provenance](https://docs.npmjs.com/generating-provenance-statements): `npm audit signatures` checks that the package you installed was built from this repository.
