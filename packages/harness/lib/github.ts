import { execFileSync } from "node:child_process";

/**
 * GitHub writes, done through the `gh` CLI so the harness carries no SDK and
 * behaves identically to what the agent does inside the sandbox.
 *
 * Every call is explicit about the repo — the harness never relies on an
 * ambient checkout or `GITHUB_REPOSITORY`.
 */

export const LABELS = {
  ready: "machinai:ready",
  planning: "machinai:planning",
  planReview: "machinai:plan-review",
  inProgress: "machinai:in-progress",
  inReview: "machinai:in-review",
  revise: "machinai:revise",
  blocked: "machinai:blocked",
  stuck: "machinai:stuck",
} as const;

export type Label = (typeof LABELS)[keyof typeof LABELS];

export class Gh {
  constructor(
    private readonly repo: string,
    private readonly token: string,
  ) {}

  private run(args: string[], input?: string): string {
    return execFileSync("gh", args, {
      encoding: "utf8",
      input,
      env: { ...process.env, GH_TOKEN: this.token, GH_REPO: this.repo },
      stdio: ["pipe", "pipe", "pipe"],
      maxBuffer: 32 * 1024 * 1024,
    }).trim();
  }

  private try(args: string[], input?: string): string | null {
    try {
      return this.run(args, input);
    } catch {
      return null;
    }
  }

  issueBody(n: number): { title: string; body: string; labels: string[] } {
    const raw = this.run([
      "issue", "view", String(n),
      "--repo", this.repo,
      "--json", "title,body,labels",
    ]);
    const parsed = JSON.parse(raw) as {
      title: string;
      body: string;
      labels: { name: string }[];
    };
    return {
      title: parsed.title,
      body: parsed.body ?? "",
      labels: parsed.labels.map((l) => l.name),
    };
  }

  /**
   * The story as text, for injection into the agent's prompt.
   *
   * Fetched on the host on purpose. The sandbox has no `gh` and — more
   * importantly — gets no GitHub token, so a tenant's credential never enters
   * an agent environment. All GitHub I/O stays here.
   */
  issueContext(n: number): string {
    const raw = this.run([
      "issue", "view", String(n),
      "--repo", this.repo,
      "--json", "number,title,body,labels,comments",
    ]);
    const issue = JSON.parse(raw) as {
      number: number;
      title: string;
      body: string;
      labels: { name: string }[];
      comments: { author: { login: string }; body: string; createdAt: string }[];
    };

    const lines = [
      `Issue #${issue.number}: ${issue.title}`,
      `Labels: ${issue.labels.map((l) => l.name).join(", ") || "(none)"}`,
      "",
      issue.body?.trim() || "(no description)",
    ];

    if (issue.comments.length > 0) {
      lines.push("", "## Comments (oldest first)");
      for (const c of issue.comments) {
        lines.push(
          "",
          `### ${c.author?.login ?? "unknown"} — ${c.createdAt.slice(0, 16).replace("T", " ")}`,
          c.body.trim(),
        );
      }
    }
    return lines.join("\n");
  }

  /** Comments are how machinai keeps an audit trail without touching the repo. */
  comment(n: number, body: string): void {
    this.run(
      ["issue", "comment", String(n), "--repo", this.repo, "--body-file", "-"],
      body,
    );
  }

  setLabels(n: number, opts: { add?: Label[]; remove?: Label[] }): void {
    for (const l of opts.remove ?? []) {
      this.try(["issue", "edit", String(n), "--repo", this.repo, "--remove-label", l]);
    }
    for (const l of opts.add ?? []) {
      // Create-on-demand: the first run against a repo establishes the taxonomy.
      this.try(["label", "create", l, "--repo", this.repo, "--force"]);
      this.try(["issue", "edit", String(n), "--repo", this.repo, "--add-label", l]);
    }
  }

  /** Returns the PR number, opening one only if the branch has none. */
  ensurePullRequest(opts: {
    branch: string;
    baseBranch: string;
    title: string;
    body: string;
  }): number | null {
    const existing = this.try([
      "pr", "list",
      "--repo", this.repo,
      "--head", opts.branch,
      "--state", "open",
      "--json", "number",
    ]);
    if (existing) {
      const rows = JSON.parse(existing) as { number: number }[];
      const first = rows[0];
      if (first) return first.number;
    }

    const url = this.try(
      [
        "pr", "create",
        "--repo", this.repo,
        "--head", opts.branch,
        "--base", opts.baseBranch,
        "--title", opts.title,
        "--body-file", "-",
      ],
      opts.body,
    );
    if (!url) return null;
    const n = Number(url.trim().split("/").pop());
    return Number.isFinite(n) ? n : null;
  }

  /**
   * Attempts already spent on this story, counted from machinai's own
   * checkpoint comments. GitHub is the state store, so the counter lives with
   * the evidence rather than in a database.
   */
  attemptCount(n: number, marker: string): number {
    const raw = this.try([
      "issue", "view", String(n),
      "--repo", this.repo,
      "--json", "comments",
    ]);
    if (!raw) return 0;
    const { comments } = JSON.parse(raw) as { comments: { body: string }[] };
    return comments.filter((c) => c.body.includes(marker)).length;
  }
}
