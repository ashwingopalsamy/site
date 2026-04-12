---
title: "Review Your Own PR First"
date: 2025-01-15
description: "Self-reviewing your pull request before requesting review saves time, builds trust, and catches the mistakes you already know about."
tags: ["engineering-practices"]
---

Like most developers, I've been on both sides of Pull Requests (PRs) -- sending them out to colleagues and reviewing others' code in a sprint to meet deadlines. What I've noticed is that the best PRs, the ones that get merged smoothly and with minimal back-and-forth, are the ones where the author has already done a thorough self-review. It's not just about tidying up code style; it's about catching design flaws, typos, logic gaps and potential optimisation pitfalls before your teammates do.

In this post, I'd like to walk through why you should review your own PR first and provide some practical steps on how to do it. And hey, I'm writing this because I've personally seen the difference it makes while building internet-scale fintech systems for Europe, where a missed detail can lead to big headaches down the line.

---

### What Happens Without Self-Review

Here's the typical cycle when a PR goes out without self-review. The author pushes, the reviewer catches trivial issues, the author fixes, the reviewer re-reviews, finds more, and the cycle repeats. Three or more round trips before anything substantive gets discussed.

{{< mermaid >}}
sequenceDiagram
    participant Author
    participant Reviewer

    Author->>Reviewer: Push PR for review
    Reviewer->>Author: 12 comments (typos, dead code, naming)
    Author->>Author: Fix trivial issues
    Author->>Reviewer: Push fixes, re-request review
    Reviewer->>Author: 5 more comments (missed edge case, style)
    Author->>Author: Fix again
    Author->>Reviewer: Push fixes, re-request review
    Reviewer->>Author: 2 more nits
    Note over Author,Reviewer: 3+ round trips before merge
{{< /mermaid >}}

---

## 1. Why Self-Review Is Critical

### a. Saves Time for Everyone

As soon as you open a Pull Request, your teammates set aside time to look at your code. If your PR is full of small mistakes -- like typos, unused variables (although unlikely to happen with languages like Go -- my primary and favorite programming language), or dead code -- reviewers will end up focusing on these easy catches instead of more architectural or design concerns. By cleaning up these obvious issues yourself, you let reviewers zero in on what really matters.

> Very early in my career, I once rushed a PR for a critical feature and ended up with a barrage of comments about redundant code and inconsistent naming. About 30 of them. The real logic flaw I introduced got overlooked for a while -- until it blew up in staging.
>
> Embarrassing? Yes. It taught me that even a quick self-review can spare everyone a lot of pain later.

### b. Improves Your Own Code Quality

Reading your own code diff is like stepping back to observe your painting from a distance. You notice patterns (or anti-patterns) that don't jump out when you're in the trenches writing code. Did you name that function well? Is there an awkward datastructure that might be simplified? These insights not only refine your current PR but also shape how you approach coding in the future.

### c. Builds Trust and Professionalism

Whether you're working in a small startup/scaleup (like where I do) or a large enterprise, your PR is a reflection of your work ethic. Taking time to polish your code before asking for a review signals respect for your colleagues' time. Over multiple sprints, that respect fosters trust and leads to more streamlined team communication.

{{< callout type="insight" >}}
Self-review compounds over time. Reviewers learn that your PRs are clean, so they focus on architecture and design instead of surface issues. This builds a feedback loop where reviews get shorter and more valuable with each sprint.
{{< /callout >}}

---

### What Happens With Self-Review

Contrast the earlier cycle with what happens when the author self-reviews before pushing. One round trip, one substantive comment, done.

{{< mermaid >}}
sequenceDiagram
    participant Author
    participant Self as Self-Review
    participant Reviewer

    Author->>Self: Read own diff as reviewer
    Self->>Author: Catch 12 trivial issues locally
    Author->>Author: Fix naming, dead code, edge cases
    Author->>Author: Run tests, check linting
    Author->>Reviewer: Push clean PR for review
    Reviewer->>Author: 1 substantive design comment
    Author->>Author: Address feedback
    Author->>Reviewer: Push final fix
    Note over Author,Reviewer: 1 round trip to merge
{{< /mermaid >}}

---

## 2. How to Perform a Self-Review

### a. View the Diff As If You're Someone Else

I usually open GitHub (GitLab, or Bitbucket in your case), navigate to the **Files changed** tab, and read every line as though I'm the reviewer. Are the names clear? Is error handling consistent (which is a MUST with Go)? Is there test coverage for every new or changed piece of logic? (You can be conservative, but not here.) By shifting perspective, you'll catch issues you missed while coding.

> In a FinTech context, especially with microservices for accounts, transactions or credit cards, a single nil check might prevent a major production outage. Reading the diff as a reviewer helps me see if I've handled edge cases, like a missing value in a 3rd-party API response.

### b. Check Commit Messages and Branch Name

Yes, your PR title and description are important, but so are your commit messages. They form a living history of your project. Does it follow (try to) the [conventional-commit](https://gist.github.com/qoomon/5dfcdf8eec66a051ecd85625518cfd13) style? Does each commit represent a logical chunk of work? Or do you see "WIP: fix bug" repeated four times?

- **Atomic Commits**: Make sure each commit fixes or implements exactly one thing.
- **Good Commit Messages**: Follow a structure like `fix: handle missing field in transaction flow`, rather than "misc changes".

If you spot multiple fixes or refactors jammed into one commit, consider an interactive rebase to split them up. Similarly, ensure your **branch name** follows your team's convention (like `JIRA-5678-fix-transaction-timeout`) to keep things organized.

### c. Document Any Special Considerations

If there's something non-obvious about your approach -- for example, a tricky concurrency hack or a workaround for a known library bug -- mention it. Add inline comments in your code or elaborate in your PR description. Your Oncall Engineer will thank you while firefighting a production issue at 3 AM.

{{< callout type="tip" >}}
If your code references a known bug or limitation, link to any relevant tickets or documentation right in the PR or code comment. Clarity now saves major confusion later. Adding self-review comments on your own PR is also a great way to proactively explain tricky decisions.
{{< /callout >}}

### d. Validate Tests and Benchmarks

Every new or modified code path should ideally have a test -- unit, integration or end-to-end. Quickly run them locally (or rely on CI if it's robust enough) and check coverage reports if available. Did you add a new database migration script or an additional endpoint? Make sure you've tested for both success and failure scenarios.

> In a microservice handling accounts or transactions, a single missed test case might break the ledger for an entire day. Tests aren't just checkboxes; they're safety nets.

### e. Check for Style and Linting

Even small inconsistencies in code style can distract reviewers from more substantial issues. If your team uses linting tools or formatters like [golangci-lint](https://github.com/golangci/golangci-lint), [gofumpt](https://github.com/mvdan/gofumpt) or ESLint, run them before you open a PR. Fix any warnings or errors unless they're truly exceptions to your rule set.

---

### Self-Review Checklist

Before hitting "Request Review", walk through this checklist. Each "No" is a loop back to fix before pushing.

{{< mermaid >}}
graph TD
    Start["Open your PR diff"] --> A{"Diff readable?\nClear naming?"}
    A -->|Yes| B{"Commit messages\nclear and atomic?"}
    A -->|No| A1["Fix naming,\nclean up diff"] --> A

    B -->|Yes| C{"Tests pass?\nCoverage adequate?"}
    B -->|No| B1["Rewrite commits,\ninteractive rebase"] --> B

    C -->|Yes| D{"Docs updated?\nPR description clear?"}
    C -->|No| C1["Add tests,\nfix failures"] --> C

    D -->|Yes| E{"Linting clean?\nNo warnings?"}
    D -->|No| D1["Update docs,\nadd PR context"] --> D

    E -->|Yes| F["Ready for review"]
    E -->|No| E1["Run linter,\nfix issues"] --> E

    style F fill:#10b981,color:#fff,stroke:none
    style Start fill:#64748b,color:#fff,stroke:none
    style A fill:#6366f1,color:#fff,stroke:none
    style B fill:#6366f1,color:#fff,stroke:none
    style C fill:#6366f1,color:#fff,stroke:none
    style D fill:#6366f1,color:#fff,stroke:none
    style E fill:#6366f1,color:#fff,stroke:none
    style A1 fill:#f59e0b,color:#fff,stroke:none
    style B1 fill:#f59e0b,color:#fff,stroke:none
    style C1 fill:#f59e0b,color:#fff,stroke:none
    style D1 fill:#f59e0b,color:#fff,stroke:none
    style E1 fill:#f59e0b,color:#fff,stroke:none
{{< /mermaid >}}

---

## 3. Common Pitfalls (And How to Avoid Them)

1. **Too Large PRs**
   - **Solution**: If you find your PR has grown too large, consider breaking it into smaller chunks. Maybe the database schema migration script can (in ideal cases -- SHOULD) be a separate PR.

2. **Neglecting Documentation**
   - **Solution**: If your changes include a new API endpoint or config file, update the README or relevant docs. Reviewing your own PR is a great time to spot missing documentation.

3. **Lack of Context in the PR Description**
   - **Solution**: Summarize what changed, why it changed, and any impacts on the system. This ensures the reviewers understand the context from the get-go.
   - **Another one:** I have a habit of adding PR comments pointing to my code explaining tricky bits or why I made a certain decision. It helps me think things through and makes it easier for reviewers to quickly grasp the rationale behind my decision later on.

4. **Forgetting to Rebase or Merge Main**
   - **Solution**: Before you finalize your PR, pull in the latest changes from `main` or `develop` (depending on your workflow). Fix any merge conflicts now rather than letting your reviewer handle them.

---

## 4. The Ripple Effect of a Good Self-Review

### a. Faster Approvals

If your PR is clean and well-structured, your reviewers won't have to spend time on trivial comments or guess your intentions. This leads to a more constructive review session where you can focus on potential design improvements and edge cases, ultimately speeding up merges.

### b. Better Team Morale

Pull requests often come with a bit of stress; nobody wants that dreaded "**Can you fix these 17 things?**" comment. A well-reviewed PR shows you respect the review process, which makes your teammates more eager to review your work. This mutual respect boosts morale and reduces the friction sometimes found in code review cycles.

### c. Stronger Codebase for Production-Grade Systems

In FinTech or any high-stakes industry, code reliability is paramount. Errors can be costly -- financially and reputationally. By catching small bugs and questionable logic early, you reduce the risk of these issues making their way to production.

> I remember we once traced a subtle floating-point rounding bug that only appeared in large batch transactions. Had I done a thorough self-review, I think I might've caught it. Instead, we found out during a production spike, leading to a hotfix scenario.

---

## 5. Final Thoughts

PR reviews are not just a box to check or to rely on others to correct our mistakes; they're a vital step in producing quality, maintainable software. By reviewing your own PR first -- treating it like someone else's code -- you'll create a better experience for both yourself and your reviewers. Think of it as a courtesy that doubles as a code-quality accelerator.

{{< callout type="tip" >}}
The simplest habit that pays the biggest dividends: before clicking "Request Review", open the Files changed tab and read every line as if a colleague wrote it. If something makes you pause, fix it. Your reviewers will notice the difference within one sprint.
{{< /callout >}}

Thanks for reading. If you found this helpful, feel free to leave a comment or share your own stories. I'd love to hear how self-review has impacted your codebase or your team's productivity.

Happy Coding -- and Happy Reviewing.
