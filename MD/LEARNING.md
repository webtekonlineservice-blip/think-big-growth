A self-improving system that discovers new skills from GitHub, converts them into Agent Skills, and grows its capabilities over time.

## Core Idea
Turn GitHub into a continuous learning engine for your agent. Every new workflow, architecture, or pattern is automatically scouted, evaluated, extracted, and integrated — with humans only doing final review.

## High-Level Architecture
- **Continuous Learning Loop** centered around a **Skill Library** (persistent knowledge base of approved, reusable skills).
- 8 specialized agents handle discovery → filtering → extraction → validation → packaging → review → publishing.

## The 8 Agents
1. **Scout** — Continuously finds new AI repositories and workflows.
2. **Filter** — Removes obvious noise using deterministic rules.
3. **Reader** — Efficiently reads documentation and code.
4. **Extractor** — Pulls reusable workflows into standardized format.
5. **Skill Score** — Objective scoring (confidence, reusability, etc.).
6. **Skill Generator** — Builds complete skill packages with examples and tests.
7. **Reviewer** — Human-like quality gate ("Would an engineer install this?").
8. **Publisher** — Creates PRs for human approval.

## Benefits
- Automation handles everything up to final human review.
- The library grows smarter over time → better discoveries.
- Agents evolve continuously instead of becoming stale.