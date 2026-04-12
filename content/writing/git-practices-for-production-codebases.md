---
title: "Git Practices for Production Codebases"
date: 2024-11-14
description: "Atomic commits, conventional commit format, branch naming conventions, and rebasing strategies for teams shipping to production."
tags: ["engineering-practices"]
---

Git is the backbone of every software project. Whether you're squashing a bug, developing a feature, or tracing a production issue, Git quietly keeps track of everything. But let's face it -- Git can be as much of a headache as it is a lifesaver, especially if the history is messy or branches are all over the place.

Working in **highly critical, production-grade FinTech systems**, I've learned that Git isn't just a tool -- it's a shared language and a safety net. In environments where even minor mistakes can ripple across services, impacting compliance, customers, and trust, clean Git workflows become non-negotiable. Having managed **core banking systems** within this context, I always strive for structured commits, well-defined branches, and clear pull requests (PRs) to maintain the integrity of the codebase.

{{< callout type="note" >}}
In FinTech and regulated environments, every change must be auditable and traceable. Clean Git practices are not just about developer productivity -- they are a compliance requirement. Structured commit histories, well-scoped branches, and documented PRs form the paper trail that auditors and incident responders rely on.
{{< /callout >}}

Here's a guide to **Git best practices** I almost follow (and aspire to), aimed at keeping repositories clean, collaborative, and resilient in the face of production challenges.

---

## Commits: The Backbone of Your Codebase

A Git history should feel like a well-documented timeline of your project's development, not a chaotic log of random changes. In highly critical environments, where changes must be audited and traceable, well-structured commits are crucial.

### 1. Write Atomic Commits

An atomic commit focuses on one thing -- fixing a bug, adding a feature, or refactoring code. This ensures every commit is clear, self-contained, and easy to understand. It also makes debugging and rollbacks safer.

**Example:**

- **Good:**

```bash
feat: add endpoint for retrieving user account balances
fix: resolve timeout issue in interest calculation
```

- **Bad:**

```bash
misc: fix bugs and add features
```

In early career, I've learned *(the hard way)* that bundling unrelated changes into a single commit creates confusion and risks during rollbacks, especially when a quick fix is required for production.

---

### 2. Use Descriptive Commit Messages

Your commit message should explain **what changed** and, if needed, **why**. Following a consistent format helps everyone on the team (including your future self) understand what's going on.

```text
<type>(<scope>): <subject>
<BLANK LINE>
<body (optional)>
```

**Examples:**

- `fix(auth): resolve token expiration handling for API calls`
- `feat(worker): implement batch processing for interest accrual`

These messages don't just help during reviews -- they're lifesavers when digging through logs or debugging an issue six months down the line.

{{< callout type="tip" >}}
The [Conventional Commits Specification](https://www.conventionalcommits.org/) formalizes this format. It pairs well with tools like **commitlint** and enables automatic changelog generation, semantic versioning, and structured release notes from your commit history alone.
{{< /callout >}}

{{< mermaid >}}
graph LR
    A["feat(parser): add bitmap validation"]

    A --> B["<b>type</b><br/>feat"]
    A --> C["<b>scope</b><br/>parser"]
    A --> D["<b>description</b><br/>add bitmap validation"]

    style A fill:#64748b,color:#fff,stroke:none
    style B fill:#10b981,color:#fff,stroke:none
    style C fill:#6366f1,color:#fff,stroke:none
    style D fill:#f59e0b,color:#fff,stroke:none
{{< /mermaid >}}

---

### 3. Automate Commit Linting

No matter how disciplined we are, it's easy to slip up. That's where **Commitlint** comes in. It's a lightweight tool that ensures your commit messages follow a defined convention, like **Conventional Commits**.

**Tools for Commitlint:**

1. **[Commitlint by Conventional-Changelog](https://github.com/conventional-changelog/commitlint):**
   This is one of the most popular Commitlint tools. It's simple, extensible, and works seamlessly with Husky to enforce commit message rules during pre-commit or pre-push hooks.

2. **[Commitlint by ConventionalCommit](https://github.com/conventionalcommit/commitlint):**
   Written in **Golang**, this lightweight Commitlint tool is fast and easy to set up for smaller teams or those already using Go. It's perfect if you prefer tools that feel native to your tech stack. **My personal favorite**.

3. **[Conventional Commits Specification](https://www.conventionalcommits.org/)**
   A useful guide to the conventions enforced by these tools.

Setting up Commitlint is straightforward, simple and easy. The long-term benefits -- clear commit messages, consistent history -- are well worth the effort.

---

## Branches: Organized and Traceable

In highly critical systems, branch organization is non-negotiable. It's not just about avoiding confusion -- it's about making sure work can be traced back to its purpose, especially in microservices architectures where each service lives in its own repository.

### 1. Follow a Consistent Naming Convention

A good branch name starts with the task or issue identifier, making it easy to see what the branch is for. I always use this format:

**Format:**

```text
<JIRA-ticket-ID>-<type>-<short-description>
```

**Examples:**

- `JIRA-5678-fix-transaction-timeout`
- `JIRA-1234-feature-add-batch-processing`

This convention has saved me -- and my team -- countless hours when tracking work across multiple repositories.

---

### 2. Keep Branches Short-Lived

The longer a branch stays open, the more likely it is to diverge from the base branch. I aim to merge branches into `main` or `develop` frequently, keeping integration smooth and reducing conflicts.

---

### 3. Rebase for a Clean History

Rebasing instead of merging keeps your branch history linear, which is much easier to follow during debugging or reviews.

**Example Workflow:**

```bash
git checkout JIRA-5678-fix-transaction-timeout
git pull --rebase origin main
```

Rebasing has saved me from so many messy histories, but I'm always careful not to rebase shared branches like `main`.

{{< callout type="insight" >}}
Rebasing rewrites commit hashes, so it should only be used on local or feature branches. The payoff is a linear history that reads like a narrative rather than a tangled graph. During incident investigations, a linear `git log` lets you bisect and isolate the offending change in seconds rather than minutes.
{{< /callout >}}

{{< mermaid >}}
gitGraph
    commit id: "init"
    commit id: "v1.0"
    branch JIRA-5678-fix-timeout
    commit id: "add retry logic"
    commit id: "handle edge case"
    commit id: "add tests"
    checkout main
    commit id: "hotfix: logging"
    checkout JIRA-5678-fix-timeout
    merge main id: "rebase onto main" type: HIGHLIGHT
    checkout main
    merge JIRA-5678-fix-timeout id: "squash merge" type: HIGHLIGHT
    commit id: "v1.1"
{{< /mermaid >}}

---

## Pull Requests: Your Code Documentation

Pull requests are where collaboration happens. In highly critical systems, they also serve as an essential checkpoint to catch mistakes before they make it to production.

### 1. Use Clear and Structured PR Titles

A PR title should be concise but informative. I use this format to keep things consistent and easily traceable:

```text
[JIRA-ticket-ID] <Type>: <Short Description>
```

**Examples:**

- `[JIRA-5678] Fix: Handle transaction timeout edge cases`
- `[JIRA-1234] Feature: Add bulk processing for transactions`

---

### 2. Write Descriptive PR Descriptions

A good PR description provides enough context to help reviewers understand what's changing and why. I try to answer three key questions:

1. **References and Documentation**
2. **What changed?**
3. **Why was this change made?**
4. **Does it introduce any risks or side effects?**

```markdown
### What
Added a batch endpoint for processing transaction summaries.

### Why
This improves efficiency for bulk transaction reconciliation.

### Impact
- Adds a new API endpoint.
- No breaking changes.
- Includes unit and integration tests.
```

---

### 3. Keep PRs Small and Focused

Large PRs are overwhelming to review and prone to mistakes. I aim to keep PRs focused on a single feature, bug, or task to make reviews faster and more effective. It is absolutely okay to have couple of PRs for few critical implementations separated by small subtasks/milestones, in my opinion.

**Example: Schema migration as a separate Pull Request.**

---

### 4. Use Checklists and Labels

Checklists ensure that every step is complete before merging:

- Unit tests added
- Integration tests verified
- Documentation updated

Labels is such an under-rated feature, which I regularly use. Labels like `feature`, `fix`, or `hotfix` also help prioritize reviews and are easy to filter out and dig back when required.

{{< mermaid >}}
graph LR
    A["Branch Created"] --> B["Commits"]
    B --> C["Self-Review"]
    C --> D["PR Opened"]
    D --> E["CI Passes"]
    E --> F["Code Review"]
    F --> G["Approved"]
    G --> H["Squash Merge"]
    H --> I["Branch Deleted"]

    style A fill:#64748b,color:#fff,stroke:none
    style B fill:#64748b,color:#fff,stroke:none
    style C fill:#64748b,color:#fff,stroke:none
    style D fill:#64748b,color:#fff,stroke:none
    style E fill:#10b981,color:#fff,stroke:none
    style F fill:#64748b,color:#fff,stroke:none
    style G fill:#10b981,color:#fff,stroke:none
    style H fill:#10b981,color:#fff,stroke:none
    style I fill:#64748b,color:#fff,stroke:none
{{< /mermaid >}}

---

## Why These Practices Matter

In **highly critical, production-grade FinTech systems**, precision isn't optional. I've seen how poor Git practices can snowball into major issues -- long debugging sessions, delayed releases, or even customer-facing outages. Clean commits, structured branches, and clear PRs aren't just best practices -- they're safeguards for the stability and trustworthiness of the systems we build.

By following these practices:

- Debugging in production becomes faster and more efficient.
- Collaboration is smoother because everything is easy to trace.
- Compliance and audits are simpler, with clear histories and well-documented changes.

If you've got your own favorite tools or Git horror stories, let's swap notes. The best practices we share today could save someone a lot of time (and stress) tomorrow.
