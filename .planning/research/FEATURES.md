# Feature Landscape: AI-Powered Code Review Tools

**Domain:** Local AI code review CLI / slash command tool
**Researched:** 2026-04-03
**Confidence:** HIGH — sourced from multiple current reviews, vendor documentation, and practitioner articles (March 2026)

---

## Context: What rms Already Has Decided

Before categorizing features, anchor to what PROJECT.md already commits to:

- Slash command entry point (OpenCode + Cursor)
- Three isolated agents: reviewer → validator → writer
- 11 review dimensions
- Severity-grouped report (critical → high → medium → low → info)
- Each finding: file, line reference, explanation, suggestion, finding ID
- Fix command: by ID or interactive selection
- All role outputs persisted (full audit trail)
- No external service dependencies (uses editor's model)
- Language agnostic
- No auto-fix — user must invoke fix explicitly

These are **already decided**. Research below informs what else matters and what to deliberately avoid.

---

## Table Stakes

Features users expect. Missing = tool feels incomplete or untrustworthy.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Severity classification** | Every tool (CodeRabbit, Copilot, SonarQube) groups by severity. Users have been trained to expect critical/high/medium/low triage. | Low | Already in spec. Confirm `info` tier is important — informational findings without severity help reviewers understand intent without inflating counts. |
| **Per-finding explanations** | Users don't act on `"potential null dereference"` alone. They need WHY it's a problem and WHAT could break. All major tools provide natural language explanations. | Low | Already in spec. Each finding's `explanation` field. Don't just describe — explain the consequence. |
| **Concrete suggestions per finding** | Findings without remediation paths are noise. Even Copilot (the weakest on this) provides inline code suggestions. | Low–Med | Already in spec. The `suggestion` field. Suggestions should be actionable ("use parameterized query") not vague ("fix this"). |
| **File + line attribution** | Every tool from SonarQube to Greptile pins findings to specific file + line. Without this, users can't navigate to the problem. | Low | Already in spec. Line reference required. |
| **Finding IDs** | Required for the fix workflow. CodeRabbit uses commit-suggestion IDs; DeepSource uses finding IDs for autofix; Qodo uses IDs for one-click patches. | Low | Already in spec. IDs must be stable across report updates. |
| **Coverage of security dimensions** | Security (SQLi, XSS, hardcoded secrets, insecure patterns) is expected in every modern review tool. Tools without it are perceived as incomplete. | Med | Already in 11-dimension scope (security dimension). The reviewer must explicitly call it out as a first-class category. |
| **Coverage of bug/logic errors** | Core purpose. Tools that only catch style are dismissed as "fancy linters." The reviewer must catch null deref, missing error handling, off-by-one, unhandled async, etc. | Med–High | Already in 11-dimension scope. The depth here is what separates rms from simpler tools. |
| **PR/diff scope control** | Users expect to choose what they're reviewing — local uncommitted, local diff, or PR diff. Every tool from CodeRabbit to PR-Agent supports scoping. | Low–Med | Already in spec: "git diff (local) or PR diff (remote), choosing per-review." |
| **Focus area control** | Users who know where to look expect to narrow the scope ("focus on security" or "focus on this file"). Reduces noise on targeted reviews. | Low | Already in spec: "user can optionally specify a focus area." |
| **Report persisted to disk** | File-based output is expected for async workflows. Most PR tools post inline; a local tool must write to disk since there's no PR comment thread. | Low | Already in spec: `.reviews/` directory structure. |
| **Language agnosticism** | Modern tools (CodeRabbit, Copilot, Greptile) all cover 30+ languages. Baking in language assumptions immediately limits the audience. | Med (discipline) | Already in spec. The challenge is prompt discipline, not code complexity. |

---

## Differentiators

Features that give rms competitive advantage. Not universally expected, but meaningfully valued when present.

### 1. Adversarial Validator (Isolation-Based Quality)
**Value:** Every existing tool uses a single-pass agent. Even multi-agent tools like Qodo run 15 specialized agents **in parallel** on dimensions — none uses a second agent that adversarially challenges the first's findings. The validator-as-adversary pattern is unique.

**Why it matters:** Reviewer's blind spots are structural. An agent that generated a finding will not challenge its own reasoning. A second agent that only sees structured output (not the reviewer's chain of thought) brings genuine independence.

**Complexity:** High — requires true agent isolation. Context must be partitioned.

**What the research shows:** The Cotera study found that even the best tools missed cross-file consistency issues and pattern-level violations. A validator that re-examines structured findings for false positives, missed implications, and confidence calibration would catch a category of problems that no current tool addresses.

---

### 2. Full Audit Trail (Role-Specific Output Files)
**Value:** No current tool exposes its intermediate reasoning. CodeRabbit posts comments — no trail. Copilot generates review — no trail. SonarQube stores results — no intermediate reasoning. rms exposes every role's output.

**Why it matters:** Trust in AI review depends on verifiability. "The validator challenged this finding and here's why" is more actionable than "AI said so." The audit trail enables retrospectives, debugging of false positives, and gradual trust-building.

**Complexity:** Low (file I/O) — but high value because it's structurally rare.

**Research insight:** The State of AI Code Review 2026 identifies "trust and verification" as one of the top adoption barriers. Teams need to understand *why* AI flagged something before acting on it. The audit trail directly addresses this.

---

### 3. Fix-by-ID Command (Selective Application)
**Value:** Most tools offer one-click fix for all findings or nothing. CodeRabbit's "apply suggestion" works per-comment in the GitHub PR UI. DeepSource Autofix applies one at a time. No tool offers a CLI-based `fix --id RMS-042` that applies a specific finding by stable ID.

**Why it matters:** Users want to accept some findings and reject others without navigating a PR UI. The by-ID interface treats findings as addressable units.

**Complexity:** Med — requires stable IDs, file editing, and diff application.

**Dependency:** Requires finding IDs (table stakes) + report structure (table stakes).

---

### 4. Focus Dimension Routing
**Value:** When a user says "focus on security," the reviewer should weight its analysis toward the security dimension and potentially skip or reduce depth on style/conventions. No existing tool does true dimension routing — they run all checks regardless.

**Why it matters:** Reduces review latency on targeted use cases. A security-focused review before a production deploy is a distinct workflow from a full architectural review.

**Complexity:** Med — requires prompt engineering; no code infrastructure needed.

---

### 5. Writer Role as Synthesis Layer
**Value:** Current tools show raw findings. The writer role synthesizes reviewer + validator output into a coherent narrative — surfacing which findings were challenged, which survived, and why. This is editorially richer than a flat list of comments.

**Why it matters:** Flat finding lists create cognitive load. A synthesized report that groups by severity and explains relationships between findings reduces the time to understand the codebase's risk profile.

**Complexity:** Med — writer prompt complexity, not code complexity.

---

### 6. Cross-Finding Narrative
**Value:** If three findings relate to the same architectural problem, a skilled human reviewer calls that out. The writer can be prompted to identify patterns across findings ("four of the five critical findings stem from missing error propagation in the service layer").

**Why it matters:** Pattern-level insight is more valuable than individual finding lists. This is what senior engineers do in manual review that AI tools don't replicate.

**Complexity:** High — requires writer to reason across findings, not just summarize them. Risk of hallucination increases.

**Research note:** Mark as LOW confidence that this always works reliably. It's a stretch goal, not a v1 commitment.

---

### 7. Review Metadata / Header
**Value:** Tools like CodeRabbit generate PR summaries. For a local tool, a review header (what was reviewed, scope, model used, timestamp, dimensions covered) gives context before the findings.

**Why it matters:** Without metadata, a 3-week-old `.reviews/` file has no context. The header makes reports self-contained.

**Complexity:** Very low.

---

## Anti-Features

Features to explicitly NOT build. These are common in the ecosystem but are wrong for rms's design goals.

### 1. Auto-Fix Without Explicit Invocation
**Why to avoid:** Every tool that auto-applies fixes without user review trains developers to rubber-stamp AI suggestions. The value of rms's fix command is that the user must actively read and decide. Auto-fix removes the human in the loop.

**Research backing:** The "click accept" anti-pattern is explicitly called out in multiple 2026 practitioner articles. State of AI Code Review 2026: "how do you prevent the 'just click accept' anti-pattern where developers blindly apply AI suggestions without understanding the changes?"

**What to do instead:** Fix command is explicit and per-finding. Interactive mode for unspecified IDs.

---

### 2. CI/CD Pipeline Integration (v1)
**Why to avoid:** Pipeline tools have completely different design requirements — they need exit codes, machine-readable output, threshold configuration, parallel scanning, artifact management. Adding pipeline concerns to an interactive CLI creates conflicting trade-offs.

**Research backing:** The 2026 landscape clearly segments "dedicated AI PR reviewers" from "code quality platforms with quality gates." These are different products. Mixing them produces a mediocre version of each.

**What to do instead:** File-based output means CI could theoretically read it, but rms should not be designed around that use case in v1.

---

### 3. GitHub PR Comment Posting
**Why to avoid:** Requires OAuth flows, API credentials, rate limit management, and webhook complexity. Adds an external service dependency that violates rms's core constraint. Also, inline PR comments are a different interaction model than a local report.

**Research backing:** CodeRabbit and Copilot's PR integration requires significant infrastructure (webhooks, OAuth, API keys, platform support per git host). This is a product in itself.

**What to do instead:** File-based report in `.reviews/`. If users want to share findings, they share the file.

---

### 4. Built-in Linters / Static Analysis Rules
**Why to avoid:** Rule-based linters (ESLint, Pylint, SonarQube) require language-specific toolchain installation, rule library maintenance, and configuration management. They duplicate what developers already have in their CI pipeline.

**Research backing:** CodeRabbit's 40+ linters are a selling point because they're managed for users. But they also mean CodeRabbit is managing language runtimes, config files, and rule updates. For a local AI tool that uses the editor's model, this is scope creep.

**What to do instead:** The LLM-based review catches what static analysis misses (logic errors, semantic issues, cross-file patterns). If users want static analysis, they already have it.

---

### 5. Real-Time / Continuous Review
**Why to avoid:** Triggered-on-demand is fundamentally different from always-on analysis. Always-on requires background processes, IDE extension infrastructure, event handling, and de-duplication. It also creates interruption patterns that conflict with flow state.

**Research backing:** Cursor BugBot's in-editor approach requires deep IDE integration (extension APIs, event hooks, rendering infrastructure). This is a different product category.

**What to do instead:** Slash command invocation. Fast, intentional, on-demand.

---

### 6. Learnable Preferences / Feedback Loop
**Why to avoid:** CodeRabbit's adaptive preference system requires persistent storage of review history, feedback signals, and model fine-tuning or RAG pipelines. This is significant infrastructure for a local tool with no persistent state.

**Research backing:** CodeRabbit cites learnable preferences as a key differentiator — precisely because it requires ongoing infrastructure investment. It's a moat for them, not a quick feature.

**What to do instead:** Custom focus areas and the existing 11-dimension scope handle most configuration needs. If users want to tune behavior, they tune their invocation.

---

### 7. Multi-Platform Git Host Support
**Why to avoid:** Supporting GitHub + GitLab + Bitbucket + Azure DevOps is a major distribution and integration challenge. The value of rms is the local review workflow, not the git platform integration.

**Research backing:** CodeRabbit's multi-platform support is called out as a decisive differentiator specifically for teams not on GitHub. This is a platform play that requires separate integration work per host.

**What to do instead:** PR diff input via `gh pr diff` (GitHub CLI) is sufficient for PR scope. The tool doesn't need to know about the platform.

---

### 8. PR Summaries / Change Descriptions
**Why to avoid:** PR summary generation (what changed and why) is a generation task, not a review task. It conflates authoring assistance with quality review. Mixing these creates a confused product.

**Research backing:** Copilot's PR summaries are useful — but they're a separate feature from code review. Cotera's study found summaries save "reviewer orientation time" but that's distinct from finding quality issues.

**What to do instead:** The review report's header section provides context. But generating a PR description is out of scope.

---

### 9. Nitpick Avalanche (The Anti-Pattern to Design Against)
**Why to avoid:** The #1 code review anti-pattern identified in the Mesrai 2026 article is reviewers (AI or human) flooding PRs with style/formatting nitpicks instead of substantive issues. Tools that do this get turned off.

**What to do instead:** The writer role is specifically positioned to synthesize and filter. The severity system naturally deprioritizes style-only findings. The focus area option lets users exclude style entirely.

---

## Feature Dependencies

```
Finding IDs ──────────────────────────────→ Fix-by-ID command
Finding IDs ──────────────────────────────→ Cross-role audit trail
Severity classification ──────────────────→ Report structure (critical → info)
Three-agent isolation ────────────────────→ Adversarial validator value
Adversarial validator ───────────────────→ Full audit trail meaningfulness
Writer synthesis layer ──────────────────→ Cross-finding narrative (stretch)
Per-finding file+line ───────────────────→ Fix-by-ID command (needs target)
Report persisted to disk ────────────────→ Audit trail (must persist all role outputs)
PR diff input ───────────────────────────→ Focus area routing (PR-specific focus)
```

---

## Review Dimensions: What the Ecosystem Covers vs What rms Has

The 11 rms dimensions map well to what the research shows is expected:

| rms Dimension | Industry Coverage | Notes |
|--------------|------------------|-------|
| Bugs / logic errors | Universal — all tools | Core value. Must go deep here. |
| Security | Universal — all tools | High true-positive rate for AI review. Decisive. |
| Performance | Most tools | N+1 queries, unbounded operations, algorithmic issues. |
| Style / conventions | All tools | Table stakes but should not dominate findings. |
| Test coverage | Some tools (Qodo focuses here) | Harder for AI — can flag missing tests but not adequacy. |
| Architecture | Few tools excel here | Most AI tools are weak on architecture. rms's validator can help. |
| Error handling / resilience | Most tools | Missing error handling, unchecked returns, goroutine leaks. |
| Data integrity | Few tools | Transactions, consistency guarantees, migration correctness. |
| API & interface contracts | Some tools (with full-repo context) | Cross-file type violations, breaking changes. |
| Dependency & env risk | Some tools (DeepSource, Snyk) | Deprecated deps, version conflicts. |
| Consistency (doc-code, doc-doc, code-code) | Rare | rms's three sub-dimensions here are unusual and valuable. |

**Observation:** The dimensions where the ecosystem is weakest (architecture, consistency, data integrity) are exactly the dimensions where rms's adversarial validator adds the most value. An independent validator is better positioned to challenge architectural reasoning than a single-pass reviewer.

---

## Severity Systems: What the Ecosystem Uses

Most tools use 3–5 levels. rms's five-level system matches the upper end of the market:

| Tool | Severity Levels |
|------|----------------|
| CodeRabbit | Critical, Major, Minor, Informational |
| SonarQube | Blocker, Critical, Major, Minor, Info |
| Semgrep | Error, Warning, Info |
| DeepSource | Critical, Major, Minor |
| **rms** | Critical, High, Medium, Low, Info |

**rms's system is well-calibrated** — five levels matches SonarQube (the industry standard), and the Critical → High → Medium → Low → Info naming is the most intuitive in the market.

**Key insight from research:** The distinction between Critical and High matters. Critical should mean "this will cause a defect, security vulnerability, or data loss." High should mean "this is a significant problem that should be fixed before merge." Conflating them inflates Critical counts and trains users to ignore them.

---

## Audit Trail: What Exists vs What rms Provides

| Tool | Intermediate Reasoning | Role-Specific Output | Traceability |
|------|----------------------|---------------------|-------------|
| CodeRabbit | None (black box) | None | Comment thread only |
| GitHub Copilot | None (black box) | None | PR comment history |
| SonarQube | Rule ID + description | None | Dashboard history |
| Qodo | Some (agent steps visible) | Partial | Limited |
| **rms** | Full (each role output persisted) | Yes (per-role files) | Finding → role → reasoning |

**rms's audit trail is genuinely differentiated.** No existing tool exposes the reasoning that led to a finding AND the challenger reasoning that evaluated it. This is a trust-building feature that addresses the #1 adoption barrier identified in the 2026 state of AI code review.

---

## Report Format: Industry Patterns

**Most PR-integrated tools:**
- Inline comments on diff lines
- Summary comment at top of PR
- No persistent file outside the PR

**Most static analysis tools:**
- Dashboard with sortable findings
- Quality gate pass/fail
- Trend charts over time

**rms's approach (file-based, severity-grouped, Markdown):**
- Closest analog: SonarQube's exportable reports, but those are XML/JSON for machine consumption
- rms's Markdown format is optimized for human reading AND AI agent consumption
- The `.reviews/<review-name>/` directory structure enables tooling without requiring tooling

**What the research recommends for reports:**
- Group by severity (not by file, not by dimension) — this is what rms already does
- Each finding self-contained (don't require reading context to understand a finding)
- PR summary / walkthrough at the top (report header with metadata)
- Clear finding IDs for cross-referencing

---

## MVP Recommendation

Based on research, the rms spec already describes a coherent MVP. The features that are table stakes are already specced. The differentiators that are high-value and low-risk are already included (audit trail, validator isolation, finding IDs, fix command).

**Prioritize in v1:**
1. Three-agent isolation with persisted role outputs (the core differentiator)
2. Severity-grouped report with finding IDs (table stakes done right)
3. Fix-by-ID command (closes the review→fix loop)
4. Per-finding explanations with concrete suggestions (what makes findings actionable)
5. PR diff + local diff scope control (flexibility without complexity)

**Defer to later:**
- Cross-finding narrative in writer role (stretch goal — risk of hallucination, hard to test)
- Focus dimension routing beyond the basic focus area option (optimization, not core)
- Interactive fix selection (the by-ID path is more precise; interactive is a fallback)

**Explicitly out of scope (anti-features confirmed by research):**
- Auto-fix without invocation
- CI/CD pipeline mode
- GitHub PR comment posting
- Built-in linter integration
- Real-time / continuous review
- Learnable preferences
- PR summary generation as a distinct feature

---

## Sources

- Cotera: "AI Code Review on GitHub: Copilot vs CodeRabbit vs an Agent That Reads Your Codebase" (March 2026)
- AICodeReview.cc: "CodeRabbit vs GitHub Copilot for Code Review (2026)" (February 2026)
- AICodeReview.cc: "State of AI Code Review — Trends and Tools" (March 2026)
- AICodeReview.cc: "What Is AI Code Review? How It Works and Benefits" (March 2026)
- AICodeReview.cc: "AI Code Review vs Manual Review — When to Use Each (2026)" (February 2026)
- AwesomeAgents.ai: "Best AI Code Review Tools in 2026: 6 Options Tested and Compared" (February 2026)
- Mesrai: "10 Code Review Anti-Patterns That Slow Down Your Team" (February 2026)
- LowCode.Agency: "Cursor AI vs CodeRabbit: AI Code Review Compared" (February 2026)
