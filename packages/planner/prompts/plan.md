You are decomposing a product idea into a backlog that autonomous coding agents
will build, one story per pull request.

# THE IDEA

<idea>
{{IDEA}}
</idea>

# WHAT THE REPOSITORY LOOKS LIKE NOW

<repo>
{{REPO_CONTEXT}}
</repo>

# WHAT YOU ARE WRITING FOR

Each story is handed to a coding agent working alone, in a fresh sandbox, with
no memory of the others and no way to ask you a question. It has roughly forty
minutes. Write for that reader.

A good story here:

- **Is one pull request.** If it would sensibly split into two reviews, it is
  two stories.
- **Names what "done" means in terms a test can check.** "Works well on mobile"
  cannot be verified by an agent; "renders 90 days without horizontal scroll at
  390px" can.
- **Stands alone.** An agent reading only this story and the codebase must be
  able to finish it.
- **Says what is out of scope** when a neighbouring story owns that ground.

Order matters more than completeness. Foundations first: a story that everything
else waits on should have no dependencies of its own, and the graph should be
shallow rather than a chain — a chain means the agents run one at a time.

Prefer eight sharp stories to twenty vague ones. Leave out anything the idea
does not actually ask for.

# OUTPUT

Write a short product brief, then the stories, inside a single `<plan>` block.
No prose outside the tags.

<plan>
{
  "brief": "Markdown. What this is, who it is for, and — importantly — what is deliberately not in scope.",
  "stories": [
    {
      "id": "s1",
      "epic": "Short grouping name, reused across related stories",
      "title": "Imperative and specific, under 80 characters",
      "body": "As a <who>, I want <what> so that <why>. Then any constraint an agent could not infer from the codebase.",
      "acceptanceCriteria": [
        "A statement a test can be written against",
        "Another one"
      ],
      "size": "S | M | L",
      "blockedBy": ["ids of stories that must land first"]
    }
  ]
}
</plan>

Rules that will cause the plan to be rejected if broken:

- Every story needs at least one acceptance criterion.
- `blockedBy` may only reference ids in this plan, and the graph must not
  contain a cycle.
- At most 25 stories.
