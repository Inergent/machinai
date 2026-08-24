# TASK

Implement issue #{{ISSUE_NUMBER}} in `{{REPO}}`: {{ISSUE_TITLE}}

You are working on branch `{{BRANCH}}`. Work on this issue and nothing else.

## The story

Pull the full issue, including comments — earlier attempts and human feedback
live there:

!`gh issue view {{ISSUE_NUMBER}} --repo {{REPO}} --comments`

## Where the code is now

Recent history:

!`git log -n 10 --format="%h %ad %s" --date=short`

What is already on this branch versus the base:

!`git log --format="%h %s" origin/{{BASE_BRANCH}}..HEAD 2>/dev/null || echo "(nothing yet — this is the first attempt)"`

# ATTEMPT {{ATTEMPT}} OF {{MAX_ATTEMPTS}}

{{RESUME_NOTE}}

# EXPLORATION

Read the code before changing it. Pay particular attention to existing tests
that touch the area you are about to modify — they encode decisions you should
not silently reverse.

# EXECUTION

Work test-first where it applies:

1. RED — write one failing test that expresses a piece of the story
2. GREEN — write the implementation that makes it pass
3. REPEAT until the proof criteria below are met
4. REFACTOR

## Proof criteria

The story is not done until all of these pass. Run them yourself; do not report
success without having seen them green.

```
{{INSTALL_CMD}}
{{TEST_CMD}}
```

Every acceptance criterion on the issue must have a test that demonstrates it.

## Rules you may not break

- **Never edit a test to make it pass.** If a test looks wrong, leave it
  failing, explain why in your checkpoint comment, and stop. Changing an
  assertion to match broken behaviour is the single most common way agent work
  passes CI and is still wrong.
- **Do not touch files unrelated to this issue.** No drive-by refactors, no
  dependency bumps, no formatting sweeps.
- **Do not create any file whose name begins with `.machinai` or `.sandcastle`.**
  Those are machinai's own working artifacts and must never enter this
  repository.
- **Do not merge, close the issue, or approve anything.** A human decides.

# BUDGET

You have roughly {{BUDGET_MINUTES}} minutes of wall clock. This is a hard
platform limit, not a suggestion.

**Commit before you run out.** A branch with honest partial work and a clear
note is worth far more than an uncommitted almost-finished one, because the
next attempt resumes from exactly where you stopped.

When you are within a few minutes of the limit, or you have gone as far as you
can:

1. Commit what you have. Prefix the message `machinai:` and reference
   `(#{{ISSUE_NUMBER}})`.
2. Leave a checkpoint comment on the issue containing the marker
   `<!-- machinai:checkpoint -->` on its own line, then:
   - what you completed
   - what is left
   - the single next step you would take
   - anything you need from a human

```
gh issue comment {{ISSUE_NUMBER}} --repo {{REPO}} --body "..."
```

# WHEN THE STORY IS ACTUALLY DONE

Only when every proof criterion passes and every acceptance criterion has a
test: commit, leave the checkpoint comment describing what shipped, then output

<promise>COMPLETE</promise>

Do not output that signal for partial work. machinai uses it to decide whether
to open a pull request, and a false signal puts unfinished code in front of a
human as if it were finished.
