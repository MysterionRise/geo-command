---
evidence-class: target-qualification
qualified-at: 2026-07-29T11:01:50Z
status: QUALIFIED_PENDING_POLICY_AND_OPERATOR_APPROVAL
repository: mysterionrise/encrypted-information-retrieval
commit: 8f8183fb80fb90165e321d96df7a3a5f4ccd445e
parent: 6694a44fdb6050e26c209ff4e79d5cc2fb6b4d79
child-tree: 995a54fa3e7e59af5226d386e10647b17148d1ba
parent-tree: 410a17ae10ac7d0eb46e0bbeaab5dfd644b2dd3b
subtree: src
provenance-path: src/encrypted_ir/fpe.py
parent-blob: 077bc7c768ba65836e14d1b9c2eea0fc1b797e59
child-blob: 64c5272aa147e3efd8f201259830e3c65026a6f9
excerpt-lines: 82-86
excerpt-sha256: ae408e14bdb4d5b5a742bef7b208df02a85a3136b159c2476cf910b71512d61b
license: MIT
license-blob-sha: 4bc5c2962c10958c1e58c4e52d5b4d338d0a7ab2
---

# Real-content target qualification

## Decision

Use one pinned source change as the KISS target for the first real-content PoC:

- repository:
  [MysterionRise/encrypted-information-retrieval](https://github.com/MysterionRise/encrypted-information-retrieval);
- commit:
  [`8f8183fb80fb90165e321d96df7a3a5f4ccd445e`](https://github.com/MysterionRise/encrypted-information-retrieval/commit/8f8183fb80fb90165e321d96df7a3a5f4ccd445e);
- approved-subtree proposal: `src`;
- provenance candidate path: `src/encrypted_ir/fpe.py`;
- proposed purposes: `LANGUAGE_CANDIDATE` and
  `RECORDED_AGENT_PARTICIPATION_CANDIDATE`.

The same immutable revision may supply both initial drafts. The language
candidate remains subject to deterministic safe-file selection within `src`;
the provenance candidate is the only modified path in this commit. This
minimizes live requests and policy surface while keeping the two review and
promotion decisions separate.

## Qualification evidence

The GitHub commit response observed on 2026-07-29 identifies one parent,
`6694a44fdb6050e26c209ff4e79d5cc2fb6b4d79`, and one modified Python file at
the same path in the parent and child revisions. The edit adds a Bandit
suppression to an AES block-encryption statement. Its deterministic excerpt is
bounded to the surrounding method and contains an eligible changed code line.
It is small, but unlike the original `requirements.txt` example it is actual
executable code and fits the current twenty-one-line provenance limit.

The production screening and changed-line algorithms were run locally against
the exact pinned parent and child GitHub blob responses. Both blobs passed
screening. The result binds parent blob `077bc7c…`, child blob `64c5272…`,
lines 82–86, changed line 84, and excerpt SHA-256
`ae408e14bdb4d5b5a742bef7b208df02a85a3136b159c2476cf910b71512d61b`.

The richer
[`a316e3a…`](https://github.com/MysterionRise/encrypted-information-retrieval/commit/a316e3a12028d29bfcd73f4334f50110fa7ba671)
credit-scoring change was considered and rejected for the first provenance
run because its eligible changes span more than the current deterministic
excerpt limit. It remains a future candidate if excerpt selection is
deliberately revised under test.

The commit message contains the exact line:

```text
Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

The proposed classification is `NAMED_MODEL_RECORDED`, with public model name
`Claude Opus 4.6`. This records repository evidence only; it does not assert
exclusive authorship or AI detection.

The pinned `LICENSE` file reports MIT and has Git blob SHA
  `4bc5c2962c10958c1e58c4e52d5b4d338d0a7ab2` and is 1,075 bytes.
Repository-level license screening is satisfied for admission only. File
coverage, embedded or third-party material, required notices, redistribution,
delayed attribution, and final display text still require the separate rights
decision.

The supporting vendor capture is
[`vendor/2026-07-29-anthropic-claude-code-attribution.md`](vendor/2026-07-29-anthropic-claude-code-attribution.md).

## Remaining gates

This qualification does not authorize network acquisition. Before a live run:

1. the Repository Admission and Attribution Marker policies must be finalized,
   hashed, and approved by distinct Don and Rights/Safety Reviewer identities;
2. the operator register must name the actual operator and OS identity and be
   approved by distinct Release Operator and Security Reviewer identities;
3. the external owner-only state root and encrypted-volume attestation must be
   prepared;
4. each run descriptor must bind the final policy/register hashes and an
   observation time within five minutes of the live run.

Until those facts exist, the project controls remain deliberately
non-effective and no `DRAFT_REVIEW_REQUIRED` artifact may be claimed.
