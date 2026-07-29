---
evidence-class: vendor-document-capture
publisher: Anthropic
source-url: https://code.claude.com/docs/en/settings.md
captured-at: 2026-07-29T11:01:50Z
captured-byte-count: 272483
captured-content-sha256: c6722f96333874c974a157de6ac12dbff17e5cc3dcebcd570054483e120dbbcb
excerpt-lines: 485-505
excerpt-sha256: aa64fc816b8fa864e57c3f064af11a08b02a19733d9651f93965af37b49c8471
status: CAPTURED_NOT_APPROVED
---

# Anthropic Claude Code attribution capture

## Captured statement

Anthropic's Claude Code settings documentation states that Claude Code adds
attribution to Git commits, that commits use Git trailers such as
`Co-Authored-By` by default, and that the model name in the trailer reflects
the active model for the session.

The captured default example was:

```text
Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
```

## Narrow policy interpretation

This document supports only the following proposed interpretation:

- a commit containing the exact documented trailer form records Claude Code
  participation;
- when the trailer includes a model name, the recorded claim may be classified
  as `NAMED_MODEL_RECORDED`;
- the evidence does not prove exclusive authorship, line-level authorship, or
  absence of human participation;
- an exact commit-specific trailer must still match an approved marker rule.

The source document is mutable. The capture metadata above binds the complete
Markdown response received at capture time, while this project-controlled file
retains the relevant statement and its narrow interpretation. Approval remains
separate.
