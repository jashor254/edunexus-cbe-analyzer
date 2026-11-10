// scripts/standard-runner-support.mjs
//
// Support for scripts/run-standard-tests.mjs: makes sure every file registered
// in scripts/standard-tests.json actually EXECUTES tests.
//
// Why this exists: Node's test runner treats each file argument as a GLOB.
// A manifest path such as `app/api/student/blueprint/[learnerId]/pdf/route.test.ts`
// contains `[learnerId]`, which a glob reads as a character class ("one of
// l, e, a, r, n, I, d"), so it matched no file. The runner then reported
// "tests 0 … fail 0" and exited 0 — the registered tests silently never ran.
// (`[[]` and backslash escapes do not work under the `tsx` wrapper; a `?`
// wildcard does.)
//
// Two protections:
//   1. globSafe(): glob-active characters in a path become `?`, which matches
//      that exact character; resolveProblems() proves each pattern resolves to
//      exactly its own file before anything runs.
//   2. filesWithoutTests(): after the run, a JUnit report is read and any
//      registered file that produced no test at all fails the run — whatever
//      the cause (bad glob, a file whose tests never register, an import that
//      swallows the suite).

import { relative, resolve } from 'node:path'

/** A path as a literal-matching glob: `[ ] { } *` are replaced by `?`. */
export function globSafe(path) {
  return path.replace(/[[\]{}*]/g, '?')
}

/**
 * Registered files whose glob-safe pattern does not resolve to exactly the
 * file itself. `globSync` is injected (fs.globSync; absent on old Node).
 * @returns {{ file: string, matches: string[] }[]}
 */
export function resolveProblems(files, globSync, cwd) {
  const problems = []
  for (const file of files) {
    const matches = globSync(globSafe(file), { cwd })
    const only = matches.length === 1 && matches[0].replace(/\\/g, '/') === file
    if (!only) problems.push({ file, matches })
  }
  return problems
}

const decode = text => text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')
const attribute = (attrs, name) => {
  const m = attrs.match(new RegExp(`(?:^|\\s)${name}="([^"]*)"`))
  return m ? decode(m[1]) : null
}

/**
 * Absolute paths of every file that executed at least one REAL test in a JUnit
 * report. Node reports a file that loads but registers no test (or fails at
 * import) as a single placeholder <testcase> named after the file itself;
 * that placeholder is not a test and does not count.
 */
export function filesWithTests(junitXml, root) {
  const found = new Set()
  for (const m of junitXml.matchAll(/<testcase\b([^>]*)>/g)) {
    const file = attribute(m[1], 'file')
    const name = attribute(m[1], 'name')
    if (!file) continue
    const absolute = resolve(file)
    const placeholder = name === file || name === relative(root, absolute).replace(/\\/g, '/')
    if (!placeholder) found.add(absolute)
  }
  return found
}

/** Registered files with no executed test in the JUnit report. */
export function filesWithoutTests(files, junitXml, root) {
  const executed = filesWithTests(junitXml, root)
  return files.filter(f => !executed.has(resolve(root, f)))
}

/**
 * Can a JUnit report be attributed to files? Node versions whose reporter omits
 * the per-test `file` attribute cannot be checked; the runner then warns
 * instead of reporting every file as silent.
 */
export function reportAttributesTestsToFiles(junitXml) {
  return /<testcase\b[^>]*\sfile="/.test(junitXml)
}

/** Number of <testcase> entries in a JUnit report (0 means nothing ran at all). */
export function countTestcases(junitXml) {
  return (junitXml.match(/<testcase\b/g) ?? []).length
}
