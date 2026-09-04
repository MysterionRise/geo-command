---
heist: codeguessr-poc-readiness
phase: the-sit-down
observed-at: 2026-07-31T12:56:18Z
subject: The Stack v2 revision and terms
---

# The Stack v2 Revision Observation

## Observed provider state

- The public Hugging Face dataset metadata endpoint for
  `bigcode/the-stack-v2` reported repository SHA
  `7408bfbcfd48e5833d62fd3dba48afd20d109473` and last modification time
  `2024-04-23T15:52:32.000Z`.
- The dataset card at that immutable revision lists `v2.1.0` as the newest
  changelog release. Its description says repositories opting out before
  2024-04-09 and unreachable or private repositories were removed.
- The gated terms require original-licence compliance and require the user to
  update to the most recent usable Stack v2 version as validated removals are
  enacted.
- The card says bulk content download requires a Software Heritage and INRIA
  agreement. It documents metadata streaming and selected content retrieval
  from the Software Heritage S3 bucket with externally configured AWS
  credentials.

## Sources

- Current provider metadata authority:
  `https://huggingface.co/api/datasets/bigcode/the-stack-v2`
- Immutable governing card and changelog:
  `https://huggingface.co/datasets/bigcode/the-stack-v2/blob/7408bfbcfd48e5833d62fd3dba48afd20d109473/README.md`
- Immutable terms:
  `https://huggingface.co/datasets/bigcode/the-stack-v2/blob/7408bfbcfd48e5833d62fd3dba48afd20d109473/README.md#terms-of-use-for-the-stack-v2`

## Evidence boundary

This observation proves only the provider state returned at the recorded time.
The mutable metadata endpoint can change, and the project cannot inspect private
maintainer email. Contract revision 5 therefore binds both the immutable pin and
a live head check, and requires the account holder to acknowledge the latest
usable revision before preparation.
