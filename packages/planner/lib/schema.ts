/**
 * The shape a decomposition must have before machinai will file a single issue.
 *
 * Hand-validated rather than schema-library-validated, because the useful part
 * is not "is this the right type" but the product rules underneath: a story
 * with no acceptance criteria cannot be verified, and a cyclic dependency graph
 * would deadlock the scheduler forever with no error anywhere.
 */

export interface DraftStory {
  /** Stable within one decomposition; dependencies reference it. */
  id: string;
  epic: string;
  title: string;
  /** As-a / I-want / so-that. */
  body: string;
  acceptanceCriteria: string[];
  size: "S" | "M" | "L";
  /** Other draft ids this waits on. */
  blockedBy: string[];
}

export interface Plan {
  /** The product brief, as markdown. */
  brief: string;
  stories: DraftStory[];
}

export class PlanError extends Error {}

const MAX_STORIES = 25;
const MAX_TITLE = 80;

function asString(value: unknown, where: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new PlanError(`${where} must be a non-empty string`);
  }
  return value.trim();
}

function asStringArray(value: unknown, where: string): string[] {
  if (!Array.isArray(value)) throw new PlanError(`${where} must be an array`);
  return value.map((v, i) => asString(v, `${where}[${i}]`));
}

/**
 * Depth-first cycle detection.
 *
 * A cycle is unrecoverable once filed: every story in it waits on another, so
 * none is ever eligible and the backlog silently stops moving. Catching it here
 * costs nothing; catching it later means deleting issues by hand.
 */
export function findCycle(stories: DraftStory[]): string[] | null {
  const byId = new Map(stories.map((s) => [s.id, s]));
  const state = new Map<string, "visiting" | "done">();
  const stack: string[] = [];

  function visit(id: string): string[] | null {
    const current = state.get(id);
    if (current === "done") return null;
    if (current === "visiting") {
      // Return the cycle itself, not just "a cycle exists" — the caller shows
      // it to a human who has to fix it.
      return [...stack.slice(stack.indexOf(id)), id];
    }

    state.set(id, "visiting");
    stack.push(id);
    for (const next of byId.get(id)?.blockedBy ?? []) {
      if (!byId.has(next)) continue;
      const cycle = visit(next);
      if (cycle) return cycle;
    }
    stack.pop();
    state.set(id, "done");
    return null;
  }

  for (const story of stories) {
    const cycle = visit(story.id);
    if (cycle) return cycle;
  }
  return null;
}

export function validatePlan(raw: unknown): Plan {
  if (typeof raw !== "object" || raw === null) {
    throw new PlanError("The plan must be a JSON object");
  }
  const input = raw as Record<string, unknown>;

  const brief = asString(input.brief, "brief");

  if (!Array.isArray(input.stories) || input.stories.length === 0) {
    throw new PlanError("The plan must contain at least one story");
  }
  if (input.stories.length > MAX_STORIES) {
    throw new PlanError(
      `${input.stories.length} stories is more than machinai will file at once (max ${MAX_STORIES}). Narrow the idea.`,
    );
  }

  const seen = new Set<string>();
  const stories = input.stories.map((entry, i): DraftStory => {
    if (typeof entry !== "object" || entry === null) {
      throw new PlanError(`stories[${i}] must be an object`);
    }
    const s = entry as Record<string, unknown>;
    const id = asString(s.id, `stories[${i}].id`);
    if (seen.has(id)) throw new PlanError(`Duplicate story id "${id}"`);
    seen.add(id);

    const title = asString(s.title, `stories[${i}].title`);
    if (title.length > MAX_TITLE) {
      throw new PlanError(`stories[${i}].title is longer than ${MAX_TITLE} characters`);
    }

    const acceptanceCriteria = asStringArray(
      s.acceptanceCriteria,
      `stories[${i}].acceptanceCriteria`,
    );
    // The rule that matters most: an agent cannot prove it is done against a
    // story with nothing to prove.
    if (acceptanceCriteria.length === 0) {
      throw new PlanError(
        `"${title}" has no acceptance criteria, so nothing could verify it was built`,
      );
    }

    const size = asString(s.size, `stories[${i}].size`).toUpperCase();
    if (size !== "S" && size !== "M" && size !== "L") {
      throw new PlanError(`stories[${i}].size must be S, M or L`);
    }

    return {
      id,
      epic: asString(s.epic, `stories[${i}].epic`),
      title,
      body: asString(s.body, `stories[${i}].body`),
      acceptanceCriteria,
      size,
      blockedBy: s.blockedBy === undefined
        ? []
        : asStringArray(s.blockedBy, `stories[${i}].blockedBy`),
    };
  });

  // Dangling references are dropped rather than fatal: the graph still works,
  // and losing an edge is far better than discarding a good decomposition.
  const ids = new Set(stories.map((s) => s.id));
  for (const story of stories) {
    story.blockedBy = story.blockedBy.filter((id) => id !== story.id && ids.has(id));
  }

  const cycle = findCycle(stories);
  if (cycle) {
    throw new PlanError(
      `These stories depend on each other in a loop, so none could ever start: ${cycle.join(" → ")}`,
    );
  }

  return { brief, stories };
}

/** Pull the `<plan>…</plan>` block out of whatever the model wrote around it. */
export function extractPlan(text: string): unknown {
  const tagged = /<plan>([\s\S]*?)<\/plan>/i.exec(text);
  const body = tagged?.[1]?.trim();
  if (!body) {
    throw new PlanError("The planner did not emit a <plan> block");
  }
  try {
    return JSON.parse(body);
  } catch (error) {
    throw new PlanError(
      `The <plan> block was not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
