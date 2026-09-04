---
heist: codeguessr-poc-readiness
evidence: public-oss-organization-query-selection
observed-at: 2026-08-03T14:50:08Z
credential-material-recorded: false
---

# Public OSS Organization Query Selection

After the Don approved strict organization-scoped public open-source discovery,
paced count-only GitHub searches compared candidate marker scopes. No response
body, repository identity, commit identity, or source content was retained.

The selected profile uses three mutually disjoint organization populations:

1. The configured generated marker in Microsoft's public organization on
   2026-07-31: five results, complete.
2. The same configured marker in GitHub's public organization from 2026-01-01
   through 2026-07-31: two results, complete.
3. Ordinary `refactor` records in Facebook's public organization from
   2026-07-01 through 2026-07-31: 148 results, complete and within two pages.

The organizations and date ranges are project-controlled query qualifiers, not
seeded repository URLs. Repositories remain dynamically discovered and still
must pass public, enabled, non-archived, non-fork, allowlisted-SPDX, exact
licence, author, immutable-lineage, excerpt, and deduplication admission.

A complete Hugging Face organization co-author-marker population was also
observed but contained only one result; it was not selected because it offers
less admission resilience. Other checked public organizations produced empty
or incomplete populations. These are dated observations only. Under signed
Contract revision 8 at the time of observation, every live run was required to
reject incomplete, over-ceiling, changing, or malformed results. Revision 9
supersedes only the exact provider-incomplete behavior for its three literal
authorized query tuples.

Public qualifier reference:

- `https://docs.github.com/en/search-github/searching-on-github/searching-commits`

No token, credential, account value, query URL, response body, commit,
repository, email, or source content is preserved.
