import { useCallback, useMemo, useState } from 'react'
import type { ConnectionKind, DbConnection, DbPerson } from '#/server/people'

type Question = {
  key: string
  prompt: string
  answerIds: Set<string>
}

const RELATION_LABELS: Partial<Record<ConnectionKind, string>> = {
  sibling: 'siblings',
  friend: 'friends',
  coworker: 'coworkers',
  family: 'family members',
  partner: 'partners',
  other: 'connections',
}

function pairKey(a: string, b: string) {
  return [a, b].sort((x, y) => x.localeCompare(y)).join(':')
}

// Same directional convention as the Search panel: person_a_id is the
// parent, person_b_id is the child for 'parent_child' rows; every other
// kind is symmetric.
function buildGraph(connections: DbConnection[]) {
  const parentToChildren = new Map<string, Set<string>>()
  const childToParents = new Map<string, Set<string>>()
  const byKind = new Map<ConnectionKind, Map<string, Set<string>>>()

  for (const c of connections) {
    if (c.kind === 'parent_child') {
      if (!parentToChildren.has(c.person_a_id)) {
        parentToChildren.set(c.person_a_id, new Set())
      }
      parentToChildren.get(c.person_a_id)?.add(c.person_b_id)
      if (!childToParents.has(c.person_b_id)) {
        childToParents.set(c.person_b_id, new Set())
      }
      childToParents.get(c.person_b_id)?.add(c.person_a_id)
      continue
    }
    if (!byKind.has(c.kind)) byKind.set(c.kind, new Map())
    const map = byKind.get(c.kind) as Map<string, Set<string>>
    if (!map.has(c.person_a_id)) map.set(c.person_a_id, new Set())
    if (!map.has(c.person_b_id)) map.set(c.person_b_id, new Set())
    map.get(c.person_a_id)?.add(c.person_b_id)
    map.get(c.person_b_id)?.add(c.person_a_id)
  }

  return { parentToChildren, childToParents, byKind }
}

// Generates every "who are X's <relation>?" question that has a non-empty
// answer — one per person per relation they have at least one of, plus one
// "who are the children of A and B?" per partnered couple who have any
// children between them.
function generateQuestions(
  people: DbPerson[],
  connections: DbConnection[],
): Question[] {
  const graph = buildGraph(connections)
  const peopleById = new Map(people.map((p) => [p.id, p]))
  const name = (id: string) => peopleById.get(id)?.name ?? 'Unknown'
  const questions: Question[] = []

  for (const person of people) {
    const children = graph.parentToChildren.get(person.id)
    if (children && children.size > 0) {
      questions.push({
        key: `children:${person.id}`,
        prompt: `Who are the children of ${person.name}?`,
        answerIds: children,
      })
    }
    const parents = graph.childToParents.get(person.id)
    if (parents && parents.size > 0) {
      questions.push({
        key: `parents:${person.id}`,
        prompt: `Who are the parents of ${person.name}?`,
        answerIds: parents,
      })
    }
    for (const kind of Object.keys(RELATION_LABELS) as ConnectionKind[]) {
      const related = graph.byKind.get(kind)?.get(person.id)
      if (related && related.size > 0) {
        questions.push({
          key: `${kind}:${person.id}`,
          prompt: `Who are ${person.name}'s ${RELATION_LABELS[kind]}?`,
          answerIds: related,
        })
      }
    }
  }

  const seenCouples = new Set<string>()
  for (const c of connections) {
    if (c.kind !== 'partner') continue
    const key = pairKey(c.person_a_id, c.person_b_id)
    if (seenCouples.has(key)) continue
    seenCouples.add(key)
    const childrenA = graph.parentToChildren.get(c.person_a_id) ?? new Set()
    const childrenB = graph.parentToChildren.get(c.person_b_id) ?? new Set()
    const combined = new Set([...childrenA, ...childrenB])
    if (combined.size > 0) {
      questions.push({
        key: `couple-children:${key}`,
        prompt: `Who are the children of ${name(c.person_a_id)} and ${name(c.person_b_id)}?`,
        answerIds: combined,
      })
    }
  }

  return questions
}

function pickRandomQuestion(questions: Question[], excludeKey: string | null) {
  if (questions.length === 0) return null
  if (questions.length === 1) return questions[0]
  let candidate = questions[Math.floor(Math.random() * questions.length)]
  for (
    let attempt = 0;
    candidate.key === excludeKey && attempt < 10;
    attempt++
  ) {
    candidate = questions[Math.floor(Math.random() * questions.length)]
  }
  return candidate
}

// Splits on commas, newlines, or the word "and" — "Judson, Farrah and
// Abbott" and "Judson\nFarrah\nAbbott" both parse the same way.
function parseNames(input: string): string[] {
  return input
    .split(/,|\n| and /i)
    .map((s) => s.trim())
    .filter(Boolean)
}

type Grading = {
  isFullyCorrect: boolean
  missingNames: string[]
  extraNames: string[]
}

export function PeopleQuiz({
  people,
  connections,
}: {
  people: DbPerson[]
  connections: DbConnection[]
}) {
  const peopleById = useMemo(
    () => new Map(people.map((p) => [p.id, p])),
    [people],
  )
  const peopleByLowerName = useMemo(
    () => new Map(people.map((p) => [p.name.toLowerCase(), p])),
    [people],
  )

  const questions = useMemo(
    () => generateQuestions(people, connections),
    [people, connections],
  )

  const [current, setCurrent] = useState<Question | null>(() =>
    pickRandomQuestion(questions, null),
  )
  const [input, setInput] = useState('')
  const [grading, setGrading] = useState<Grading | null>(null)
  const [score, setScore] = useState({ correct: 0, total: 0 })

  const nextQuestion = useCallback(() => {
    setCurrent((prev) => pickRandomQuestion(questions, prev?.key ?? null))
    setInput('')
    setGrading(null)
  }, [questions])

  const submitAnswer = useCallback(() => {
    if (!current || grading || !input.trim()) return
    const guessedIds = new Set<string>()
    const extraNames: string[] = []
    for (const rawName of parseNames(input)) {
      const person = peopleByLowerName.get(rawName.toLowerCase())
      if (person && current.answerIds.has(person.id)) {
        guessedIds.add(person.id)
      } else {
        extraNames.push(rawName)
      }
    }
    const missingNames = [...current.answerIds]
      .filter((id) => !guessedIds.has(id))
      .map((id) => peopleById.get(id)?.name ?? 'Unknown')
    const isFullyCorrect =
      guessedIds.size === current.answerIds.size && extraNames.length === 0
    setGrading({ isFullyCorrect, missingNames, extraNames })
    setScore((prev) => ({
      correct: prev.correct + (isFullyCorrect ? 1 : 0),
      total: prev.total + 1,
    }))
  }, [current, grading, input, peopleByLowerName, peopleById])

  if (questions.length === 0) {
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center">
        <p className="text-sm text-[var(--text-muted)]">
          Not enough data yet — add some parent/child, sibling, or other
          relationship connections on the Graph tab first, then come back to
          quiz yourself.
        </p>
      </div>
    )
  }

  if (!current) return null

  const isAnswered = grading != null
  const correctNames = [...current.answerIds]
    .map((id) => peopleById.get(id)?.name)
    .filter((name): name is string => !!name)
    .sort((a, b) => a.localeCompare(b))

  return (
    <div className="mx-auto max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
      <p
        data-testid="quiz-score"
        className="mb-4 text-center text-xs font-semibold text-[var(--text-muted)]"
      >
        Score: {score.correct} / {score.total}
      </p>

      <p
        data-testid="quiz-question"
        className="mb-4 text-center text-lg font-semibold text-[var(--text)]"
      >
        {current.prompt}
      </p>

      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        disabled={isAnswered}
        placeholder="Names, separated by commas — order doesn't matter"
        rows={2}
        aria-label="Your answer"
        data-testid="quiz-answer-input"
        className="mb-3 w-full resize-none rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--blue)] disabled:opacity-60"
      />

      {!isAnswered && (
        <button
          type="button"
          onClick={submitAnswer}
          disabled={!input.trim()}
          data-testid="quiz-submit-btn"
          className="mb-3 w-full rounded-full bg-[var(--blue-deep)] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[var(--blue-darker)] disabled:opacity-50"
        >
          Submit
        </button>
      )}

      {grading && (
        <div className="mb-4 text-center">
          <p
            data-testid="quiz-feedback"
            className={`text-sm font-semibold ${grading.isFullyCorrect ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}
          >
            {grading.isFullyCorrect ? 'Correct!' : 'Not quite.'}
          </p>
          {!grading.isFullyCorrect && grading.missingNames.length > 0 && (
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Missing: {grading.missingNames.join(', ')}
            </p>
          )}
          {!grading.isFullyCorrect && grading.extraNames.length > 0 && (
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Not quite right: {grading.extraNames.join(', ')}
            </p>
          )}
          <p
            data-testid="quiz-correct-answer"
            className="mt-1 text-xs italic text-[var(--text-muted)]"
          >
            Answer: {correctNames.join(', ')}
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={nextQuestion}
        disabled={!isAnswered}
        data-testid="quiz-next-btn"
        className="w-full rounded-full bg-[var(--blue-deep)] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[var(--blue-darker)] disabled:opacity-50"
      >
        Next question
      </button>
    </div>
  )
}
