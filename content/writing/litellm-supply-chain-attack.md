---
title: "Anatomy of a Supply Chain Attack: LiteLLM on PyPI"
date: 2026-03-25
description: "How TeamPCP compromised Trivy, backdoored LiteLLM's PyPI packages, and harvested credentials using .pth files and fork bombs."
tags: ["security"]
---

On March 24, 2026, Callum McMahon at [FutureSearch](https://futuresearch.ai/blog/litellm-pypi-supply-chain-attack/) was testing a [Cursor MCP plugin](https://futuresearch.ai/blog/no-prompt-injection-required/) that pulled in [litellm](https://pypi.org/project/litellm/) as a transitive dependency. He never ran `pip install litellm` himself. The plugin resolved it automatically.

Shortly after, his machine became unresponsive. RAM exhausted. He traced it to a newly installed litellm package, decoded an obfuscated payload hidden inside it, and [published the first disclosure](https://futuresearch.ai/blog/litellm-pypi-supply-chain-attack/). His team used [Claude Code](https://claude.ai/claude-code) to help root-cause the crash.

The post spread to [r/LocalLLaMA](https://www.reddit.com/r/LocalLLaMA/), [r/Python](https://www.reddit.com/r/Python/), and the [Hacker News front page](https://news.ycombinator.com) within the hour. [Andrej Karpathy](https://x.com/karpathy) tweeted about it, calling supply chain attacks "the most threatening issue in modern software." That tweet crossed 24,000 likes in a day.

I use LiteLLM in a side project. When I saw the news, I checked my lockfile immediately. Here's everything I found when I dug into what happened, stitched together from [Datadog](https://securitylabs.datadoghq.com/articles/litellm-compromised-pypi-teampcp-supply-chain-campaign/), [Snyk](https://snyk.io/articles/poisoned-security-scanner-backdooring-litellm/), [Armosec](https://www.armosec.io/blog/litellm-supply-chain-attack-backdoor-analysis/), [ramimac's incident timeline](https://ramimac.me/teampcp/), [Microsoft](https://www.microsoft.com/en-us/security/blog/2026/03/24/detecting-investigating-defending-against-trivy-supply-chain-compromise/), [Wiz](https://www.wiz.io/blog/threes-a-crowd-teampcp-trojanizes-litellm), and the community threads on [r/devops](https://www.reddit.com/r/devops/) and [r/cybersecurity](https://www.reddit.com/r/cybersecurity/).

---

## What Is LiteLLM?

LiteLLM is a Python library that works like a universal remote for AI APIs. You write one function call, and it routes to OpenAI, Anthropic, Google, Cohere, Mistral, AWS Bedrock, Azure OpenAI, or any of 100+ providers. You give LiteLLM your API keys. It handles the rest.

[95 million downloads per month](https://pypi.org/project/litellm/) on PyPI. ~40,000 GitHub stars. It's also pulled in automatically by [DSPy](https://github.com/stanfordnlp/dspy), [MLflow](https://github.com/mlflow/mlflow), and a growing number of agent frameworks, MCP servers, and LLM tools. You can be using LiteLLM without knowing it.

![GitHub bot army closing issues](/img/writing/litellm-supply-chain-attack/github-bot-army.png)

---

## This Started Three Weeks Earlier

The LiteLLM backdoor on March 24 was the last move in a campaign that began on **March 1**.

A threat actor called **TeamPCP** submitted a malicious pull request to [Aqua Security's Trivy](https://github.com/aquasecurity/trivy) repository. Trivy is a widely-used open-source vulnerability scanner - the kind of tool that runs in your CI pipeline to check for security issues. The PR exploited a flaw in Trivy's CI workflow that let the attacker's code run with elevated permissions (a technique called a Pwn Request - basically, a pull request that tricks CI into handing over secrets). This gave them a personal access token.

Aqua Security responded and rotated credentials, but [the rotation wasn't complete](https://ramimac.me/teampcp/). Attackers may have captured the new tokens during the rotation. That gap is what enabled everything after.

![Malicious code analysis](/img/writing/litellm-supply-chain-attack/malicious-code-analysis.png)

{{< mermaid >}}
sequenceDiagram
    participant A as Attacker<br/>(TeamPCP)
    participant T as Trivy GitHub<br/>Repo
    participant CI as LiteLLM CI<br/>(GitHub Actions)
    participant P as PyPI<br/>Registry

    Note over A,T: March 1 - Initial Compromise
    A->>T: Submit malicious PR (Pwn Request)
    T-->>A: CI leaks personal access token
    Note over A,T: Aqua rotates creds,<br/>but rotation incomplete

    Note over A,T: March 19 - Pivot
    A->>T: Retag trivy-action versions<br/>to point at malicious code

    Note over CI,P: March 24 - Package Takeover
    CI->>T: Pull trivy-action@latest<br/>(not pinned to SHA)
    T-->>CI: Serve compromised action
    CI-->>A: Leak PyPI publisher token

    A->>P: Publish litellm v1.82.7<br/>(inline payload)
    A->>P: Publish litellm v1.82.8<br/>(.pth persistence)

    Note over P: PyPI quarantines<br/>both versions
{{< /mermaid >}}

---

## How They Got the LiteLLM PyPI Token

LiteLLM's CI pipeline used Trivy to scan for vulnerabilities. Standard practice. But it pulled [aquasecurity/trivy-action](https://github.com/aquasecurity/trivy-action) without pinning to a specific commit hash - it used a version tag like `@latest` instead of an exact SHA.

After March 19, every version tag pointed to malicious code. When LiteLLM's CI ran, the compromised Trivy action scraped the GitHub Actions runner environment and found the PyPI publisher token. That token let TeamPCP publish packages as if they were the real LiteLLM maintainer.

![.pth file backdoor mechanism](/img/writing/litellm-supply-chain-attack/pth-file-backdoor.png)

{{< mermaid >}}
graph LR
    A["Trivy Repo<br/>(compromised)"]:::danger --> B["GitHub<br/>Bot Army"]:::danger
    B --> C["PyPI Account<br/>Takeover"]:::danger
    C --> D["LiteLLM<br/>v1.82.7 / v1.82.8"]:::danger
    D --> E[".pth<br/>Backdoor"]:::danger
    E --> F["Credential<br/>Harvest"]:::danger
    F --> G["Exfil Server<br/>(ICP Canister)"]:::danger

    H["Trivy Repo<br/>(legitimate)"]:::safe -.->|compromised| A
    I["LiteLLM<br/>(legitimate)"]:::safe -.->|hijacked| D
    J["PyPI<br/>Registry"]:::safe -.->|abused| C

    classDef danger fill:#ef4444,color:#fff,stroke:none
    classDef safe fill:#10b981,color:#fff,stroke:none
{{< /mermaid >}}

---

## What the Malware Does

The payload was [triple-nested](https://www.armosec.io/blog/litellm-supply-chain-attack-backdoor-analysis/): a base64 blob decodes to an orchestrator script, which decodes a second base64 blob containing the actual harvester. Once running, it goes through six stages:

![Credential harvesting paths](/img/writing/litellm-supply-chain-attack/credential-harvesting.png)

{{< mermaid >}}
graph TD
    ROOT[".pth Backdoor"]:::danger

    ROOT --> ENV["ENV Variables<br/>os.environ"]:::warm
    ROOT --> AWS["~/.aws/credentials<br/>AWS keys"]:::warm
    ROOT --> DOTENV[".env Files<br/>recursive scan"]:::warm
    ROOT --> PROC["/proc/self/environ<br/>process secrets"]:::warm
    ROOT --> EXFIL["Outbound HTTP<br/>Exfil to ICP canister"]:::warm

    ENV --> EXFIL
    AWS --> EXFIL
    DOTENV --> EXFIL
    PROC --> EXFIL

    classDef danger fill:#ef4444,color:#fff,stroke:none
    classDef warm fill:#f59e0b,color:#fff,stroke:none
{{< /mermaid >}}

---

## Two Versions, Two Triggers

Version 1.82.7 injected the payload at line 128 of `litellm/proxy/proxy_server.py`, between two unrelated legitimate code blocks. It runs when your code imports the LiteLLM proxy module.

Version 1.82.8 did something more dangerous. It added a file called `litellm_init.pth` (34,628 bytes). In Python, `.pth` files are a little-known feature: any file with that extension in the packages directory gets executed *every time Python starts*. Not when you import something. Not when you run a script. **Every single Python process.**

{{< callout type="insight" >}}
Most developers don't know `.pth` files can execute arbitrary code. Originally designed for adding directories to `sys.path`, any line in a `.pth` file starting with `import` is executed by CPython's `site.py` at startup. This means a malicious `.pth` file in your `site-packages` directory runs code before your application even begins, on every Python invocation: `pytest`, your IDE's language server, even `pip install`. CPython maintainers have acknowledged the risk. No patch exists.
{{< /callout >}}

![Persistence mechanism](/img/writing/litellm-supply-chain-attack/persistence-mechanism.png)

{{< mermaid >}}
graph TD
    A["Python Starts"]:::info --> B["Scans site-packages<br/>for .pth files"]:::neutral
    B --> C["Finds litellm_init.pth"]:::danger
    C --> D{"Line starts<br/>with import?"}:::neutral
    D -->|Yes| E["Executes code<br/>via site.py"]:::danger
    E --> F["Decodes base64<br/>orchestrator"]:::danger
    F --> G["Decodes base64<br/>harvester"]:::danger
    G --> H["Scrapes credentials<br/>from ENV, files, /proc"]:::danger
    H --> I["Exfiltrates to<br/>ICP canister"]:::danger

    D -->|No| J["Adds path to<br/>sys.path (normal)"]:::safe

    E --> K["Spawns child<br/>Python process"]:::danger
    K -->|".pth fires again"| A

    classDef info fill:#6366f1,color:#fff,stroke:none
    classDef neutral fill:#64748b,color:#fff,stroke:none
    classDef danger fill:#ef4444,color:#fff,stroke:none
    classDef safe fill:#10b981,color:#fff,stroke:none
{{< /mermaid >}}

Running `pytest` starts Python - payload fires. Your IDE's language server starts Python - same. Even `pip install` triggers it. In CI/CD, the payload runs during build steps, not just at application runtime. This maps to [MITRE ATT&CK T1546.018](https://attack.mitre.org/techniques/T1546/018/) (Python Startup Hooks).

The `.pth` mechanism also caused an accidental **fork bomb**: the malware spawned a child Python process, which triggered `.pth` again, which spawned another child, and so on. Exponential process creation until the system ran out of memory. [FutureSearch called it "a bug in the malware"](https://futuresearch.ai/blog/litellm-pypi-supply-chain-attack/) - and it's the bug that led to the discovery.

---

## The Discovery and the Bot Army

[McMahon published on FutureSearch's blog](https://futuresearch.ai/blog/litellm-pypi-supply-chain-attack/). The disclosure spread to [r/LocalLLaMA](https://www.reddit.com/r/LocalLLaMA/), [r/Python](https://www.reddit.com/r/Python/), and the [Hacker News front page](https://news.ycombinator.com) within the hour. Then things got strange.

When the community opened [GitHub issue #24512](https://github.com/BerriAI/litellm/issues/24512) to discuss the compromise, TeamPCP deployed **88 bot comments from 73 unique accounts in a 102-second window** (12:44-12:46 UTC). These were previously compromised developer accounts, not fresh ones. [Snyk found 76% overlap](https://snyk.io/articles/poisoned-security-scanner-backdooring-litellm/) with the botnet used during the Trivy disclosure days earlier. The comments were a mix of generic praise and troll content ("sugma", "ligma"), designed to bury the technical discussion.

Then, using the stolen LiteLLM maintainer account, they closed [issue #24512](https://github.com/BerriAI/litellm/issues/24512) as **"not planned."**

The community opened a parallel tracking issue. [PyPI](https://pypi.org/project/litellm/) quarantined both versions. The real LiteLLM maintainer [confirmed on HN](https://news.ycombinator.com) that all GitHub, Docker, and PyPI keys had been rotated and accounts moved to new identities.

---

## What Makes This Worse Than Usual

**The target was a credential vault.** LiteLLM holds more API keys per deployment than almost any other library. A typical setup has keys for OpenAI, Anthropic, Google, Azure, Hugging Face, Bedrock, plus cloud credentials, database passwords, and whatever MCP server access you've configured. As [Armosec put it](https://www.armosec.io/blog/litellm-supply-chain-attack-backdoor-analysis/): "AI tooling is becoming the fattest, most credential-rich target in your entire infrastructure."

**Transitive dependency exposure.** [The FutureSearch developer never installed LiteLLM.](https://futuresearch.ai/blog/no-prompt-injection-required/) It came in through a Cursor MCP plugin. [DSPy](https://github.com/stanfordnlp/dspy) pulls it in. [MLflow](https://github.com/mlflow/mlflow) pulls it in. You can be in the blast radius without choosing to use the library.

**Unseizable infrastructure.** TeamPCP's command server includes an ICP canister replicated across 13 nodes in 10 countries. [Datadog documented this as the first observed use of ICP as a command server](https://securitylabs.datadoghq.com/articles/litellm-compromised-pypi-teampcp-supply-chain-campaign/) in a supply chain campaign. By [version 3.3 of their kamikaze.sh payload](https://ramimac.me/teampcp/), they were hiding Python code inside WAV audio files using steganography to bypass detection filters.

**Organized cover-up.** Bot armies from a pre-existing botnet (76% account reuse), troll comments, and closing the disclosure issue using the stolen maintainer account. This is not a lone actor.

---

## If You Installed 1.82.7 or 1.82.8

{{< callout type="warning" >}}
**Check your environment immediately.** If any of the following commands return results, the payload has already executed. Upgrading the package alone is not enough.
{{< /callout >}}

```bash
# Backdoor persistence
ls ~/.config/sysmon/sysmon.py 2>/dev/null && echo "BACKDOOR FOUND"
systemctl --user status sysmon.service 2>/dev/null

# .pth file (v1.82.8)
find $(python3 -c "import site; print(' '.join(site.getsitepackages()))") \
  -name "litellm_init.pth" 2>/dev/null

# Check uv caches too
find ~/.cache/uv -name "litellm_init.pth" 2>/dev/null

# Exfil artifacts
ls /tmp/tpcp.tar.gz /tmp/session.key /tmp/payload.enc /tmp/.pg_state 2>/dev/null

# Kubernetes spread
kubectl get pods --all-namespaces | grep node-setup
```

If anything shows up, **upgrading the package is not enough.** The payload already ran!

{{< callout type="warning" >}}
**Rotate immediately:**
- All LLM provider API keys (OpenAI, Anthropic, Google, every key LiteLLM proxied)
- Cloud credentials reachable from that runtime (AWS, GCP, Azure)
- GitHub and PyPI publishing tokens
- CI/CD secrets
- SSH keys
- Kubernetes service account tokens

**Then rebuild.** Known-good images, pinned dependencies. Audit transitive dependencies in every project that uses LiteLLM. The last known-clean version is **1.82.6**.
{{< /callout >}}

---

## What I'm Sitting With

The attack on [GitHub issue #24512](https://github.com/BerriAI/litellm/issues/24512) spawned a Hacker News thread asking ["What are you using to run dev environments safely?"](https://news.ycombinator.com) That's the right question to come out of this.

Consider the shape of a modern AI agent deployment: LLM provider keys for billing and access, tool credentials for SaaS integrations, MCP server access that can reach Slack, GitHub, and production infrastructure, vector databases with proprietary data, memory stores with conversation history. All of it in env vars, `.env` files, and Kubernetes Secrets. All of it accessible to any process in the runtime.

TeamPCP chose their targets in order: [Trivy](https://github.com/aquasecurity/trivy) (security scanner), [Checkmarx](https://github.com/Checkmarx/kics-github-action) (code analysis), then [LiteLLM](https://pypi.org/project/litellm/) (AI API proxy). Each one has elevated trust and broad credential access. The tools that check your code and route your AI requests have the widest blast radius when compromised, because we hand them the keys to everything.

Projects pin application dependencies. They rarely pin the tools that run in CI alongside them. `trivy-action@v0.20.0` and `trivy-action@latest` pointed to different code on March 19. That distinction is what separates "compromised" from "unaffected."

Anyways, it was fun running into the blogs and reading RCA of this incident. Just wanted to run through it for everyone here.

Thanks for your time and reading this piece.

Best,
Ashwin.
