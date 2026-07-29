---
heist: codeguessr-content-acquisition
phase: the-hit
territory: live-control-activation
status: storage-prepared-awaiting-real-reviewer
timestamp: 2026-07-29T13:57:19Z
operator-os-identity: uid:501
---

# Operator Storage Preflight

## Verified Preparation

- The host command `fdesetup status` reported `FileVault is On`.
- The external acquisition root is
  `/Users/konstantinp/Documents/CodeGuessr-acquisition-state`.
- The root is outside the source workspace, resolves as a real directory, is
  owned by UID 501 and has mode `0700`.
- A newly generated 32-byte acquisition key is stored in macOS Keychain under
  service `io.codeguessr.acquisition` and account `uid:501`. Verification
  decoded exactly 32 bytes without printing or writing the key.
- The real `prepareOperatorState` preflight passed using the project-pinned
  Node 20 runtime, the FileVault-backed root, the Keychain-held key and the
  exact volume/ownership attestations.
- The preflight created only empty `snapshots` and `audit` child directories.
  Both are owned by UID 501 and have mode `0700`.

An initial preflight invocation resolved an older system Node that did not
support `--import`; no operator-state code ran in that attempt. The corrected
invocation used `/Users/konstantinp/.nvm/versions/node/v20.18.0/bin/node`.

## Boundary

No secret was written to the repository or displayed in command output. No
GitHub request, raw snapshot, audit event, acquisition draft, promotion or
playable activation occurred.

Storage is mechanically ready. The active policy and operator registers remain
non-effective because no real Rights/Safety Reviewer or Security Reviewer
approval has been recorded. Agent or placeholder identities must not be used.

The next action is to obtain the real reviewer identifier and their explicit
approval of both review scopes, then create the effective registers, fresh
purpose-specific descriptors and the two controlled draft runs.
