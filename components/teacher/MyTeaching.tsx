import Link from 'next/link'
import { GraduationCap, Users, ArrowRight, Building2 } from 'lucide-react'
import type { TeachingContext } from '@/lib/core/teachingAssignments'

// The institutional teaching surface: the subjects and classes THE SCHOOL has
// assigned to this teacher, read from Core `class_subjects` and nothing else.
//
// A server component with no fetching of its own — the dashboard already
// resolves the teaching context once, and passing it down avoids a second
// round trip for data the page has in hand.
//
// Deliberately renders NOTHING for a Solo Teacher: their existing private
// planning workspace is unchanged and still correct, and an empty
// "assigned by your school" panel would be noise to someone who has no school.

type Props = { context: TeachingContext }

export default function MyTeaching({ context }: Props) {
  if (context.kind === 'solo') return null

  // Active school membership, nothing assigned. This state must be honest.
  //
  // The wrong move here is to fall back to `teacher_classes` and show the
  // teacher's own private classes as though the school had assigned them —
  // that hides an administrative gap (nobody has done the allocation yet)
  // behind data that looks institutional but isn't, and it is exactly the
  // dual-truth failure this convergence exists to end. Zero assignments is
  // reported as zero, and the action named is the school's, not the teacher's.
  if (context.kind === 'school_unassigned') {
    return (
      <div>
        <h2 className="text-sm font-black text-slate-900 mb-3">My Teaching</h2>
        <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center">
          <div className="w-11 h-11 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
            <Building2 className="w-5 h-5 text-slate-400" />
          </div>
          <p className="font-bold text-slate-900 mb-1">
            No classes or subjects have been assigned to you yet
          </p>
          <p className="text-sm text-slate-500 max-w-sm mx-auto">
            Your school administrator sets up classes and assigns each subject to a
            teacher. Once they assign yours, it will appear here automatically —
            there is nothing for you to create.
          </p>
        </div>
      </div>
    )
  }

  const classCount = context.assignments.length

  return (
    <div>
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-sm font-black text-slate-900">My Teaching</h2>
        <span className="text-xs text-slate-400">
          {context.groups.length} {context.groups.length === 1 ? 'subject' : 'subjects'}
          {' · '}
          {classCount} {classCount === 1 ? 'class' : 'classes'}
        </span>
      </div>

      <div className="space-y-3">
        {context.groups.map(group => (
          <div key={group.subjectId} className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-black text-slate-900 text-sm">{group.subjectName}</span>
            </div>

            <ul className="divide-y divide-slate-100">
              {group.classes.map(cls => (
                <li key={cls.assignmentId}>
                  {/* The Class Blueprint is the one existing screen keyed on a
                      Core `classes.id` (the legacy `/teacher/classes/[id]`
                      screen expects a `teacher_classes.id` — a different id
                      space, and linking there would hand it the wrong entity).
                      It is also school-scoped by the caller's own membership,
                      so it re-checks authorization rather than trusting this
                      link. */}
                  <Link
                    href={`/teacher/core-classes/${cls.classId}/blueprint`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors group"
                  >
                    <Users className="w-4 h-4 text-slate-300 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-slate-900 text-sm truncate">{cls.className}</p>
                      {/* The school's name matters only to a teacher who
                          genuinely teaches at more than one — shown only then,
                          rather than repeating the same line on every row. */}
                      {context.assignments.some(a => a.schoolId !== cls.schoolId) && (
                        <p className="text-xs text-slate-400 truncate">{cls.schoolName}</p>
                      )}
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
