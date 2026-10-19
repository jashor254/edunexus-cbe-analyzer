// Teacher-only review body for one adaptive variant (audit F-02). Renders the
// pure view model from lib/assignments/variantReview.ts in four separate
// areas — what the learner sees, what they do, the marked answer, and the
// notes stored with the version — so a question is never confused with its
// answer. Audit F-01 adds the automatic checks area: a confirmed problem, a
// possible giveaway and "not run" are labelled as exactly that, and a clean
// screen is never presented as proof of no giveaway. Contains the answer key: never render this from a learner surface
// (guarded by variantReviewTeacherOnly.architecture.test.ts).

import type { ReactNode } from 'react'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { REVIEW_ISSUE_MESSAGE, optionLabel, type VariantReviewModel } from '@/lib/assignments/variantReview'
import type { LeakageSignalKind } from '@/lib/assignments/answerLeakage'

const LEAK_SIGNAL_MESSAGE: Record<LeakageSignalKind, string> = {
  answer_value_stated: 'The marked answer\u2019s value already appears in the text before the question:',
  answer_term_stated: 'The text before the question already names the marked answer:',
  answer_wording_in_stem: 'Most of the marked answer\u2019s wording already appears in the text before the question:',
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="text-[11px] font-black tracking-wide text-gray-400 mb-1">{children}</p>
}

function NoteRow({ label, value }: { label: string; value: string | null }) {
  if (!value) return null
  return (
    <div>
      <dt className="text-xs font-bold text-gray-500">{label}</dt>
      <dd className="text-gray-700 whitespace-pre-line break-words">{value}</dd>
    </div>
  )
}

export default function VariantReviewContent({ model }: { model: VariantReviewModel }) {
  const { comparison, guidance } = model
  const lastLabel = model.choices.length > 0 ? optionLabel(model.choices.length - 1) : null

  return (
    <div className="space-y-3">
      {model.issues.length > 0 && (
        <div role="alert" className="flex gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <p className="font-bold">This version can&apos;t be fully checked.</p>
            <ul className="list-disc ml-4">
              {model.issues.map(issue => <li key={issue}>{REVIEW_ISSUE_MESSAGE[issue]}</li>)}
            </ul>
            {!model.answerKeyVerifiable && <p className="mt-1">Approval is turned off for it. Reject or regenerate it instead.</p>}
          </div>
        </div>
      )}

      <section aria-label="What the learner sees">
        <SectionLabel>WHAT THE LEARNER SEES</SectionLabel>
        {model.questionText
          ? <p className="text-gray-800 whitespace-pre-line break-words">{model.questionText}</p>
          : <p className="text-gray-400 italic">No question text stored.</p>}
        {model.choices.length > 0 && (
          <ol className="mt-2 space-y-1" aria-label="Answer options">
            {model.choices.map(choice => (
              <li key={choice.label} className="flex gap-2 text-gray-700">
                <span className="font-bold text-gray-500 shrink-0">{choice.label}.</span>
                {choice.text.trim()
                  ? <span className="break-words min-w-0">{choice.text}</span>
                  : <span className="text-gray-400 italic">(blank option)</span>}
              </li>
            ))}
          </ol>
        )}
      </section>

      <section aria-label="What the learner does">
        <SectionLabel>WHAT THE LEARNER DOES</SectionLabel>
        <p className="text-gray-700">
          {model.responseFormat === 'select_one_option'
            ? `Chooses one option (A–${lastLabel}). Marked automatically against the answer below.`
            : 'Can’t be determined: no answer options are stored for this version.'}
        </p>
      </section>

      <section aria-label="Marked correct answer">
        <SectionLabel>MARKED CORRECT ANSWER</SectionLabel>
        {model.correctAnswer ? (
          <div className="flex gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-green-900">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
            <p className="break-words min-w-0">
              <span className="font-black">{model.correctAnswer.label}.</span> {model.correctAnswer.text}
            </p>
          </div>
        ) : (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-700">No valid correct answer is marked.</p>
        )}
        {comparison && (comparison.choicesChanged || comparison.correctAnswerMoved || comparison.correctAnswerTextChanged) && (
          <ul className="mt-2 space-y-1 text-xs text-purple-800" aria-label="Changes from your original question">
            {comparison.correctAnswerTextChanged && (
              <li>The correct answer is different from your original question&apos;s answer (option {comparison.originalCorrectLabel} there).</li>
            )}
            {!comparison.correctAnswerTextChanged && comparison.correctAnswerMoved && model.correctAnswer && (
              <li>Same correct answer as your original, but it is now option {model.correctAnswer.label} instead of {comparison.originalCorrectLabel}.</li>
            )}
            {comparison.choicesChanged && <li>The answer options are reworded, reordered or different from your original question.</li>}
          </ul>
        )}
      </section>

      <section aria-label="Automatic checks">
        <SectionLabel>AUTOMATIC CHECKS</SectionLabel>
        <div className="space-y-2">
          {model.figureReferences.length > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
              <p className="font-bold">Confirmed problem: refers to a picture or drawing the learner won&apos;t see.</p>
              <p>Adaptive versions can only show text.</p>
              {model.figureReferences.map((f, i) => <p key={i} className="mt-1 italic break-words">&ldquo;{f.excerpt}&rdquo;</p>)}
            </div>
          )}

          {model.answerScreen.status === 'possible_leak' && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <p className="font-bold">Possible answer giveaway: your judgement needed.</p>
              {model.answerScreen.signals.map((signal, i) => (
                <div key={i} className="mt-1">
                  <p>{LEAK_SIGNAL_MESSAGE[signal.kind]}</p>
                  <p className="italic break-words">&ldquo;{signal.excerpt}&rdquo;</p>
                </div>
              ))}
              <p className="mt-1">If this is a deliberate reminder or a worked example the learner still has to apply, you can approve it on its own. It is left out of bulk approval.</p>
            </div>
          )}

          {model.answerScreen.status === 'no_signal' && (
            <p className="text-xs text-gray-500">
              Answer giveaway check: nothing found in the question&apos;s own words. It can&apos;t spot a giveaway that uses different wording, so still read the question as a learner would.
            </p>
          )}

          {model.answerScreen.status === 'not_checked' && (
            <p className="text-xs text-gray-500">
              Answer giveaway check not run: {model.answerScreen.reason === 'no_question_text' ? 'there is no question text' : 'there is no valid marked answer'} to check against.
            </p>
          )}
        </div>
      </section>

      <details className="rounded-lg border border-gray-200 bg-white px-3 py-2">
        <summary className="cursor-pointer text-xs font-black text-gray-500">
          NOTES STORED WITH THIS VERSION{model.teacherEdited ? ' · edited by a teacher' : ''}
        </summary>
        {model.hasGuidance ? (
          <dl className="mt-2 space-y-2 text-sm">
            <NoteRow label="Learning outcome" value={guidance.learningOutcome} />
            <NoteRow label="What it checks" value={guidance.cognitiveIntent} />
            <NoteRow label="Why this level of support" value={guidance.difficultyRationale} />
            <NoteRow label="Explanation for teachers" value={guidance.teacherExplanation} />
            {guidance.expectedMisconceptions.length > 0 && (
              <div>
                <dt className="text-xs font-bold text-gray-500">Likely mistakes</dt>
                <dd>
                  <ul className="list-disc ml-4 text-gray-700">
                    {guidance.expectedMisconceptions.map((m, i) => <li key={i} className="break-words">{m}</li>)}
                  </ul>
                </dd>
              </div>
            )}
            <NoteRow label="Explanation written for learners (not shown to learners in the app today)" value={guidance.learnerExplanation} />
          </dl>
        ) : (
          <p className="mt-2 text-sm text-gray-400 italic">No marking notes are stored for this version.</p>
        )}
      </details>
    </div>
  )
}
