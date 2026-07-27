---
heist: code-guessing-startup
date: 2026-07-10
status: approved
---

# Reconnaissance Dossier: Code-Guessing Startup

## Objective

Build a simple, replayable browser game inspired by GeoGuessr's act of inferring an origin from partial clues, but using source code. The Don proposed progressive evidence—from a small snippet through a class or whole file—and possible rounds for identifying AI-generated code versus Stack Overflow code, programming language, country, algorithm, or source project. Source: Don brief in the 2026-07-10 conversation.

The product decision is not merely which modes are possible. It is which single mode can create a differentiated, testable MVP without first building an expensive ingestion, execution, or classification platform. This is a recommendation derived from the greenfield state and competitor evidence below.

## Codebase Overview

- The repository is an empty, initialized, non-bare Git repository on an unborn `master` branch. `.git/HEAD:1` points to `refs/heads/master`; `.git/config:1-5` declares the repository and `bare = false`.
- There are no tracked or working-tree project files, source directories, entry points, product features, or selected framework. Evidence: `git status --short --branch` returned `## No commits yet on master`; `git ls-files` and `rg --files -uu -g '!.git/**'` returned no files.
- There is therefore no legacy architecture to preserve and no prior implementation to migrate. This is an inference from the empty working tree and absent Git history above.

## Existing Test Coverage

- No tests, test framework, coverage configuration, or documented test command exist. Evidence: repository searches for `*test*`, `*spec*`, `pytest.ini`, `vitest.config.*`, `jest.config.*`, `playwright.config.*`, `package.json`, `pyproject.toml`, `Cargo.toml`, and `go.mod` returned no results.
- No tests were run because there is no application or test runner to execute. Source: Associate test/documentation survey, 2026-07-10, using the repository searches above.

## Dependencies

- No package, build, runtime, container, or lock manifests exist; there are no dependency names or versions to audit. Evidence: repository search for Node, Python, Go, Rust, Ruby, PHP, Java, .NET, Deno, Docker, Make, Maven, and Gradle manifests returned no results.
- Reproducible installation, build, lint, test, license inventory, and dependency auditing remain undefined until a stack is selected. This is a direct consequence of the missing manifests above.

## Documentation

- No README, product specification, API documentation, contribution guide, deployment instructions, TODOs, or inline code documentation existed before this dossier. Evidence: `rg --files -uu -g '!.git/**'` returned no project files before dossier creation.

## Relevant Ledger Entries

### Applicable Insights

- None. `docs/gangsta/insights/` did not exist when reconnaissance began.

### Applicable Negative Constraints

- None at project level. `docs/gangsta/fails/` and `docs/gangsta/constitution.md` did not exist when reconnaissance began.
- Framework-level Omerta still applies: state must be durable, claims must be sourced, agent coordination must be mediated, and implementation must trace to a signed specification. Source: Gangsta `omerta/SKILL.md`, Laws 1-5.

### Existing Heists and Checkpoints

- None. `docs/gangsta/` did not exist and Git had no commits before this dossier, so there is no earlier operation to resume. Evidence: the initial `ls -la` listed only `.git`; searches under `docs/gangsta` failed because the path was absent.

## Current Market Intel

The concept has market validation but weak novelty if framed only as “guess the language.” Current product evidence:

- `codeguessr.com` already uses the exact **CodeGuessr** name for a daily, Wordle-like code-output game with streaks, progress tracking, educator tooling, and Python/JavaScript challenges. Source: [CodeGuessr documentation](https://www.codeguessr.com/docs).
- A separate `codeguessr` package released on PyPI on 2026-02-22 calls itself “a GeoGuessr-style browser game for code.” It asks players to identify the file from a progressively revealed snippet in a local repository and supports 13 languages. Source: [PyPI: codeguessr 0.1.0](https://pypi.org/project/codeguessr/).
- FooGuessr already asks players to identify the programming language from 7-15 lines sourced from GitHub and reports support for 82 languages. Source: [FooGuessr](https://fooguessr.jasoncheng.me/).
- GitGuessr drops players into real GitHub repositories, masks lines, and asks them to reconstruct missing code; it positions the game as code-reading practice for the AI era. Source: [GitGuessr](https://www.gitguessr.com/).

Implications:

- The exact working name is already occupied by multiple adjacent products. Shipping under **CodeGuessr/CodeGuesser** should be blocked until a separate naming and trademark/domain clearance exercise is completed. This is risk management based on the products above, not a legal conclusion.
- “Guess the language” is suitable as a supporting round but is not a differentiated standalone startup thesis. This is an inference from FooGuessr and the multi-language features of the two CodeGuessr products.
- Progressive reveal remains useful as a mechanic, but the local-repository/file-identification implementation is already represented by the PyPI product. Differentiation must come from the provenance question, social format, content quality, or target customer. This is an inference from the cited feature overlap.

## Product Hypothesis

### Recommended wedge: “AI or Stack Overflow?”

Use a provocative but honest daily provenance quiz:

1. Show a curated code excerpt with syntax highlighting but no source metadata.
2. Ask whether it was generated by a named model or taken from a specific Stack Overflow answer.
3. Allow one or two progressive clues, such as a wider excerpt or the original problem statement, with a score penalty.
4. Reveal the verified origin, author/model, date, prompt or post link, license, and a short explanation of misleading and useful signals.
5. Produce a compact, spoiler-free result grid for sharing.

This should be presented as a curated game about developer intuition—not as a scientific AI-code detector. The labels come from recorded provenance, not probabilistic classification. This distinction is a product recommendation; no detector exists in the repository.

Why this wedge:

- It directly uses the Don's sharpest and most culturally current idea while avoiding the crowded language-only position. Sources: Don brief and competitor evidence above.
- It supports the GeoGuessr-like feeling of inferring origin from clues without needing code execution, a large repository index, or an ML classifier in the MVP. This is an architectural inference from the proposed curated format.
- Language and algorithm can later become bonus questions on the same content records, preserving the Don's broader vision without requiring multiple separate games at launch. This is a roadmap recommendation.

## Mode Triage

| Proposed mode | Ground truth | Differentiation | MVP disposition |
|---|---|---|---|
| AI-generated vs Stack Overflow | Strong only with recorded model runs and attributable posts | High as a humorous provenance game | **Lead mode** |
| Programming language | Objective for curated snippets | Low; several products already do it | Bonus question / later mode |
| Algorithm | Strong with manual expert tagging and explanations | Medium; educational value | Second mode after retention signal |
| Project | Strong for carefully selected open-source files | Medium, but overlaps file/repo guessing competitors | Later “famous repo” pack |
| Country where code was written | Undefined without choosing a proxy; author location, nationality, employer HQ, and repository owner location are different facts | Potentially novel but risks arbitrary or stereotyped labels | **Exclude from MVP** pending a defensible definition and ethics review |
| Snippet → class → file progressive reveal | A mechanic, not a separate content category | Useful, but already present in adjacent products | Use sparingly in lead mode |

The assessments in this table are recommendations based on the Don brief and cited competitor behavior; they are not implemented facts.

## Content and Rights Constraints

- Public visibility on GitHub is not a blanket license to reproduce code outside GitHub; without a license, default copyright applies. Curated repository content must be limited to compatible licenses with retained attribution and notices. Source: [GitHub: Licensing a repository](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/licensing-a-repository).
- GitHub's unauthenticated REST limit is 60 requests/hour and authenticated user requests generally receive 5,000 requests/hour. Live random ingestion would therefore add authentication, caching, rate-limit, and abuse-handling work. Source: [GitHub REST API rate limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api).
- Stack Overflow contributions use versioned CC BY-SA licenses based on contribution date, and the applicable license is attached to the post revision. Source: [Stack Overflow licensing](https://stackoverflow.com/help/licensing).
- Stack Overflow's API terms require applications to visually identify Stack Exchange as the source, while its current acceptable-use policy restricts automated scraping and data gathering. Source: [Stack Overflow API Terms](https://stackoverflow.com/legal/api-terms-of-use) and [Acceptable Use Policy](https://stackoverflow.com/legal/acceptable-use-policy).

Recommended consequence: launch with a small, manually reviewed, versioned content set acquired through permitted channels; store full provenance and attribution fields; do not implement live scraping in the MVP. This is a risk-control recommendation derived from the cited terms.

## Recommended MVP Scope

### In scope

- A responsive web game with one daily set of five “AI or Stack Overflow?” rounds.
- Two initial languages with broad recognition, proposed as Python and JavaScript; the exact pair remains a Sit-Down decision.
- One base excerpt and up to two progressively revealing clues per round.
- Scoring, end-of-round reveal, explanation, daily total, local streak, and spoiler-free share text.
- A versioned content schema containing at minimum: stable ID, source type, excerpt, clues, answer, language, explanation, source URL, author, source/revision date, applicable license, attribution text, and—when AI-generated—provider, model, prompt, generation date, and generation parameters available from the provider.
- A curated launch corpus target of 50-100 rounds, reviewed for provenance, license, accidental secrets, personal data, offensive content, and answer ambiguity.
- Minimal privacy-conscious product analytics sufficient to measure starts, completed rounds, completed games, clue usage, repeat days, and share-button use.
- Accessibility basics: keyboard play, readable contrast, screen-reader labels, and non-color-only answer states.

These are proposed boundaries for specification, not approved requirements.

### Explicitly out of scope

- User accounts, payments, leaderboards, multiplayer, comments, user-generated snippets, native mobile apps, classroom dashboards, or private-repository integrations.
- Executing arbitrary code in a sandbox.
- Training or marketing an AI-code detector.
- Live GitHub or Stack Overflow scraping.
- Country attribution.
- More than one primary game mode.
- A final public brand name.

### Validation target before expansion

Run a closed beta with at least 30 external developers and evaluate whether players understand the provenance question, complete the five-round session, use clues, return voluntarily, and share results. Numeric success thresholds should be signed during The Sit-Down rather than invented during reconnaissance.

## Architectural Direction for Debate

- Prefer a static-first browser application backed by versioned, validated content records; add only the smallest server/edge surface needed to release the daily set and record aggregate events. This minimizes operational cost and attack surface because the MVP neither executes code nor ingests arbitrary user content. This is a recommendation, not a selected stack.
- Separate game rules from presentation and content validation so future language, algorithm, and project packs can reuse the same round engine. This recommendation follows from the multi-mode roadmap.
- Treat provenance and license validation as build-time gates. A content record missing attribution, source evidence, or model metadata should fail validation and never ship. This recommendation follows from the cited GitHub and Stack Overflow requirements.
- Keep future puzzles out of the client bundle if answer inspection becomes material; early closed-beta anti-cheat can remain intentionally lightweight. This is a proposed tradeoff for The Grilling.

## Risks and Unknowns

1. **Brand collision:** the exact concept name is already used by adjacent products. Sources: CodeGuessr documentation and PyPI links above.
2. **Novelty:** language/file guessing alone has direct competitors. Sources: FooGuessr, GitGuessr, and PyPI links above.
3. **Content rights:** every non-generated snippet needs license and attribution review; Stack Overflow content additionally carries versioned share-alike duties and API/source-display terms. Sources: GitHub and Stack Overflow policy links above.
4. **Label integrity:** “AI-generated” is defensible only when the product generated or obtained the code with auditable provenance; source-style intuition cannot establish authorship. This is a logical constraint of the proposed label, not an external detector claim.
5. **Category ambiguity:** Stack Overflow code may have been edited, copied, or influenced by tools, so categories must describe the recorded source of the displayed artifact rather than the metaphysical identity of its author. This is a product-definition recommendation.
6. **Content supply:** 50-100 high-quality, license-compliant, balanced rounds require manual editorial work; no content exists in the repository today. Evidence: empty repository survey.
7. **Difficulty calibration:** recognizable boilerplate can make rounds trivial while short idiomatic code can make them arbitrary. User testing and clue telemetry are required; no current test data exists.
8. **Target customer and business model:** consumer daily game, education, recruiting, and team onboarding are different businesses. The Don has not selected one, and competitor evidence shows both consumer and education positions. Source: Don brief and CodeGuessr documentation.
9. **Country mode:** no defensible label definition, dataset, or user value has been established. Source: Don brief plus the unresolved distinctions recorded in Mode Triage.
10. **Stack choice:** no runtime, hosting target, analytics provider, budget, or deployment environment has been specified. Evidence: empty repository and missing manifests.

## Recommended Scope

Approve a narrow discovery-and-MVP heist for the curated daily “AI or Stack Overflow?” game, using progressive reveal and verified provenance. Carry language and algorithm as schema-ready future packs, defer project guessing until content/licensing operations are proven, and exclude country attribution. Keep **CodeGuessr** only as an internal concept label until naming clearance.

The next phase should pressure-test the wedge, category definitions, content acquisition, share loop, validation metrics, and static-first architecture before a binding Contract is drafted.
