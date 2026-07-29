---
heist: codeguessr-content-acquisition
phase: the-hit
territory: public-real-content-smoke-crawl
status: verified-non-authorizing
timestamp: 2026-07-29T12:45:51Z
commit: 8f8183fb80fb90165e321d96df7a3a5f4ccd445e
---

# Public Real-Content Smoke Crawl

## Scope

A bounded, unauthenticated engineering smoke crawl queried the public GitHub
API for the already-qualified repository, pinned commit, recursive child tree,
licence blob, child source blob and parent source blob. Responses existed only
under `/tmp` for verification and were not admitted to the production
acquisition store, a draft, a catalogue or the playable application.

This was deliberately not an invocation of `pnpm acquire:content`. The active
policy and operator registers remain non-effective, so the production operator
correctly remains unavailable until real approvals and encrypted-state
authorization exist.

## Fresh Results

- GitHub returned the case-preserving repository identity
  `MysterionRise/encrypted-information-retrieval`; the repository is public,
  unarchived and reports MIT.
- Commit `8f8183fb80fb90165e321d96df7a3a5f4ccd445e` returned tree
  `995a54fa3e7e59af5226d386e10647b17148d1ba`, sole parent
  `6694a44fdb6050e26c209ff4e79d5cc2fb6b4d79`, and the exact
  `Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>` marker.
- The recursive tree was not truncated. It bound
  `src/encrypted_ir/fpe.py` to regular blob
  `64c5272aa147e3efd8f201259830e3c65026a6f9`, with 16,239 decoded bytes.
- Recomputing Git object identities from the returned bytes reproduced child
  blob `64c5272aa147e3efd8f201259830e3c65026a6f9` and licence blob
  `4bc5c2962c10958c1e58c4e52d5b4d338d0a7ab2`.
- The production `screenBlob` function accepted both the 16,225-byte parent
  and 16,239-byte child source blobs.
- The production `reconstructChangedLines` function found the single eligible
  executable change on line 84, selected lines 82–86, and reproduced excerpt
  SHA-256
  `ae408e14bdb4d5b5a742bef7b208df02a85a3136b159c2476cf910b71512d61b`.

The first shell invocation failed before making a request because zsh treated
the unquoted `?recursive=1` query as a filename pattern. Quoting that URL
resolved the invocation issue; it did not require a product-code change.

## Boundary

The smoke crawl verifies public network reachability, pinned-source stability,
Git identity continuity, content screening and deterministic changed-line
reconstruction. It does not exercise encrypted persistence, lifecycle audit,
rate-limit pause/resume, draft construction or production authorization.

WP-024 and WP-025 therefore remain pending. The next production step remains
activation of the real policy/operator registers and authorization of the
encrypted external state root.
