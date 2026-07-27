---
heist: codeguessr-content-acquisition
phase: the-hit
territory: secure-operator-operations
status: accepted
timestamp: 2026-07-27T19:51:32+01:00
completed-wps: [WP-015, WP-016, WP-017]
---

# Secure Operator Operations Territory Report

## Accepted Outcomes

- Raw snapshots can be stored only under an explicit external, acquisition-owned root through authenticated AES-256-GCM encryption, owner-only permissions, no-follow operations, exclusive staging, durable synchronization, no-clobber publication, immutable identity verification, and authenticated reads.
- Retention uses authoritative receipt, detection, or final-decision time for immediate sensitive rejection, twenty-four-hour rejection, and thirty-day draft/review deadlines. Legal holds are explicit, deletion is verified, and forged lifecycle records or raw adapter failures fail categorically.
- Every required operator event has an exact metadata-only schema and monotonic tamper-evident chain. The real filesystem sink creates sequence-only immutable event files with exclusive no-follow writes and durable file/directory synchronization; it exposes no update, truncate, or delete capability.
- Acquisition is exported only from the Node-only `@codeguessr/content/operator/acquisition` subpath. The ordinary content package, game, browser, domain, and measurement surfaces do not import it.
- The root operator command uses exact `tsx@4.23.1`, which is a root development/operator dependency, and all `ops/**/*.ts` files participate in root typecheck.
- The command independently loads project-controlled policy and register artifacts, rejects descriptor authorities whose canonical hashes differ, derives repository, subtree, and purpose only from that trusted policy, and validates the actual host UID and host clock before network.
- The current MVP transport is deliberately unauthenticated and public-repository-only. It does not read a GitHub token or emit an `Authorization` header; authenticated transport remains disabled until credential scope can be independently attested.
- The bounded transport can return a deeply immutable receipt containing only parsed data and the canonical actual GitHub `Date`. The command reauthorizes against that real date and returns an immutable exact requested-child/single-parent commit receipt.

## TDD and Correction Evidence

The storage first pass was rejected for rename clobber races, lstat/read time-of-check races, incomplete cleanup, insecure reopen behavior, non-canonical authenticated metadata, caller-key mutation, and raw filesystem errors. Separate RED cases closed concurrent publication, symlink substitution, cleanup, reopen, canonical identity, key-copy, ownership/mode, and categorical-error behavior.

The lifecycle/audit first pass was rejected because exported records were forgeable and its hash chain was not durable. Correction RED cases added runtime recomputation, categorical deletion failures, exact full operator/time binding, monotonic events, different-event concurrency, symlink/tamper rejection, and a real append-only filesystem sink.

The command first pass was rejected because caller-supplied status strings could impersonate authorization, transport was a permanent stub, and the executable entrypoint failed. Later reviews also rejected caller-controlled repository scope, a receipt that discarded the actual GitHub date, self-signed descriptor authorities, caller-controlled preflight time, unverified credentials, and caller-controlled operating-system identity. The accepted correction uses independently loaded project controls, the actual host UID and clock, the real authorization parsers, policy-derived scope, unauthenticated bounded public transport, canonical response-date reauthorization, defensive cloning/freezing, exact workspace linkage, executable smoke coverage, and an ops TypeScript project.

The delayed audit also rejected shape-only audit authorization and stable-path-only storage checks. The accepted correction binds the durable sink to a validator-issued run and matching project register hash, carries the authorization validity interval into every run, rejects out-of-window events, and pins the root, object, and staging directory device/inode identities across critical operations.

Final independent verification:

- root workspace TAP: 1/1 pass;
- root Vitest: 53/53 files and 1,851/1,851 tests pass;
- focused corrected storage, audit, transport, and operator boundaries: 37/37 pass;
- root recursive TypeScript plus `ops/**/*.ts`: pass;
- diff hygiene, dependency/source boundary, and internal-ID scans: pass;
- all touched production functions are at most 50 lines;
- touched files meet the 300-line target.

## Resource Accounting

The original territory estimate was 7,000 tokens. The final authorized hard cap was 21,400 and reported consumption was approximately 20,500:

- WP-015: approximately 6,700;
- WP-016: approximately 4,700;
- WP-017 and its transport correction: approximately 9,100.

The variance came from rejected security and honesty failures in the filesystem, durable audit, policy-derived scope, executable command, and real response-date boundaries. Each correction was separately bounded before work continued.

## Residual Boundary

The command returns `AUTHORIZED_COMMIT_RECEIPT`; it does not claim completed acquisition or a draft. WP-024 owns the next orchestration from that receipt through tree/blob traversal, checkpointing, screening, encrypted storage, audit integration, and `DRAFT_REVIEW_REQUIRED` construction. That orchestration must pass the operator run and register hash from the same project-controlled authorization result into the durable audit sink.

Live use remains blocked by the deliberately non-effective project policy and operator registers. No approval, repository scope, marker documentation, named operator, token, or human review was fabricated.

The application can prevent audit mutation through its exposed capability and detect recorded-chain tampering. An external filesystem owner can still delete the final event file; platform-level WORM protection is not claimed.

Node 20 does not expose descriptor-relative `openat`/`renameat` operations. The store therefore combines final-component no-follow operations with pinned device/inode checks before and after critical path operations. A deliberately timed directory swap by the already-authorized same-UID owner remains outside the signed owner-trusted threat boundary and is recorded as defense-in-depth, not as protection from a hostile storage owner.
