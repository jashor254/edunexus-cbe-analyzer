// Build pipeline: frozen Markdown manuscript -> assembled HTML -> print-quality PDF.
//
// Pipeline choice (see publication-artifact report for the full rationale):
// marked (Markdown -> HTML) -> Paged.js via pagedjs-cli (CSS Paged Media polyfill:
// running headers, page-box footnotes/page numbers, generated TOC leaders, PDF
// outline) -> Chromium print-to-pdf, then a small pdf-lib pass to set PDF Info
// metadata (Title/Author/Subject), which Chromium's print-to-pdf does not expose.
//
// No LaTeX/TeX Live install was introduced: this repo already has Google Chrome
// and Node, so the HTML/CSS route reuses what's present instead of installing a
// multi-hundred-MB TeX toolchain for a single 33k-word manuscript.

import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { Marked } from "marked";
import { PDFDocument } from "pdf-lib";
import { metadata } from "./metadata.mjs";

const run = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");
const MANUSCRIPT_DIR = path.join(
  REPO_ROOT,
  "docs/manuscript/engineering-educational-intelligence"
);
const DIST_DIR = path.join(MANUSCRIPT_DIR, "dist");

const CHAPTER_FILES = [
  { file: "00-preface.md", kicker: null, css: "preface" },
  { file: "01-chapter-1-learning-is-not-data.md", kicker: "Chapter One" },
  {
    file: "02-chapter-2-architecture-of-educational-intelligence.md",
    kicker: "Chapter Two",
  },
  { file: "03-chapter-3-the-reasoning-engine.md", kicker: "Chapter Three" },
  { file: "04-chapter-4-computational-intelligence.md", kicker: "Chapter Four" },
  { file: "05-chapter-5-operational-architecture.md", kicker: "Chapter Five" },
  { file: "06-chapter-6-the-institution.md", kicker: "Chapter Six" },
];

const usedSlugs = new Map();
function slugify(text) {
  const base = text
    .toLowerCase()
    .replace(/[*_`]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const count = usedSlugs.get(base) ?? 0;
  usedSlugs.set(base, count + 1);
  // Prefix with a letter: CSS id selectors (used by pagedjs-cli's
  // target-counter/querySelector for TOC page numbers) are invalid if they
  // start with a digit, and several headings here start with "1.1", "2.4", etc.
  const slug = count === 0 ? base : `${base}-${count}`;
  return `sec-${slug}`;
}

function makeMarked() {
  const marked = new Marked();
  marked.use({
    renderer: {
      heading({ tokens, depth }) {
        const text = this.parser.parseInline(tokens);
        const plain = tokens.map((t) => t.raw ?? "").join("");
        const id = slugify(plain || text);
        return `<h${depth} id="${id}">${text}</h${depth}>\n`;
      },
    },
  });
  return marked;
}

/** Split front-matter.md into named sections keyed by their "## Heading" text. */
function splitFrontMatterSections(raw) {
  const sections = {};
  const parts = raw.split(/^## (.+)$/m);
  // parts[0] is preamble before the first "## "; subsequent entries alternate
  // [heading, body, heading, body, ...]
  for (let i = 1; i < parts.length; i += 2) {
    const heading = parts[i].trim();
    const body = parts[i + 1] ?? "";
    sections[heading] = body.replace(/\n---\s*$/m, "").trim();
  }
  return sections;
}

function renderCoverPage() {
  return `
<section class="cover-page">
  <div class="cover-title">${metadata.title}</div>
  <div class="cover-rule"></div>
  <div class="cover-subtitle">${metadata.subtitle}</div>
  <div class="cover-author">${metadata.author}</div>
</section>`;
}

function renderHalfTitlePage() {
  return `
<section class="frontmatter-page halftitle-page">
  <div class="book-title">${metadata.title}</div>
</section>`;
}

function renderTitlePage() {
  return `
<section class="frontmatter-page title-page">
  <div class="book-title">${metadata.title}</div>
  <div class="book-subtitle">${metadata.subtitle}</div>
  <div class="book-author">${metadata.author}</div>
</section>`;
}

function renderCopyrightPage() {
  const isbnLine = metadata.isbn
    ? `<p>ISBN: ${metadata.isbn}</p>`
    : ""; // Rule: never print "[pending]" or any placeholder in the artifact.

  return `
<section class="frontmatter-page copyright-page">
  <p class="cp-title">${metadata.title}</p>
  <p>Copyright &copy; ${metadata.year} ${metadata.author}</p>
  <p>All rights reserved. No part of this publication may be reproduced, distributed, or transmitted in any form or by any means, including photocopying, recording, or other electronic or mechanical methods, without the prior written permission of the copyright holder, except in the case of brief quotations embodied in critical reviews and certain other noncommercial uses permitted by copyright law.</p>
  <p>This book is a work of engineering nonfiction. The systems, architectures, and case examples described are illustrative and, unless explicitly stated otherwise, do not describe any single named product, platform, or organization. Any resemblance to a specific commercial system is a description of a common pattern, not a claim about that system.</p>
  <p>Every effort has been made to ensure the accuracy of the information in this book at the time of publication. The author assumes no responsibility for errors, omissions, or for any outcomes resulting from the use of the information contained herein.</p>
  <p>${metadata.edition}, ${metadata.year}</p>
  ${isbnLine}
  <p>Published by ${metadata.publisher}<br>${metadata.website}</p>
</section>`;
}

function renderAboutAuthorPage(marked, aboutMarkdown) {
  // aboutMarkdown is the manuscript's own "About the Author" body (minus the
  // "Contact:" line, which we render separately using the approved config so the
  // email/website stay in one place).
  const bodyOnly = aboutMarkdown.replace(/^Contact:[\s\S]*$/m, "").trim();
  const html = marked.parse(bodyOnly);
  return `
<section class="frontmatter-page about-author-page">
  <h1>About the Author</h1>
  ${html}
  <div class="contact-block">
    <a href="mailto:${metadata.contactEmail}">${metadata.contactEmail}</a><br>
    <a href="https://${metadata.website}">${metadata.website}</a>
  </div>
</section>`;
}

function renderTocPage(headingIndex) {
  const items = headingIndex
    .map((h) => {
      const cls = h.depth === 1 ? "toc-chapter" : "toc-section";
      return `<li class="${cls}"><a href="#${h.id}"><span class="toc-title">${h.text}</span></a></li>`;
    })
    .join("\n");

  return `
<section class="toc-page">
  <h1>Contents</h1>
  <nav class="toc"><ul>
    ${items}
  </ul></nav>
</section>`;
}

async function main() {
  await rm(DIST_DIR, { recursive: true, force: true });
  await mkdir(DIST_DIR, { recursive: true });

  const marked = makeMarked();

  const frontMatterRaw = await readFile(
    path.join(MANUSCRIPT_DIR, "front-matter.md"),
    "utf-8"
  );
  const fmSections = splitFrontMatterSections(frontMatterRaw);

  const headingIndex = [];
  const bodySections = [];

  for (const { file, kicker } of CHAPTER_FILES) {
    const raw = await readFile(path.join(MANUSCRIPT_DIR, file), "utf-8");
    const html = marked.parse(raw);

    // Extract the h1/h2 we just tagged with ids, in document order, for the TOC.
    const headingRe = /<h([12]) id="([^"]+)">(.*?)<\/h\1>/g;
    let match;
    while ((match = headingRe.exec(html))) {
      headingIndex.push({
        depth: Number(match[1]),
        id: match[2],
        text: match[3].replace(/<[^>]+>/g, ""),
      });
    }

    const isPreface = kicker === null;
    const sectionClass = isPreface ? "preface" : "chapter";
    const kickerHtml = kicker
      ? `<p class="chapter-kicker">${kicker}</p>`
      : "";

    bodySections.push(`
<section class="${sectionClass}">
  <div class="${isPreface ? "preface-open" : "chapter-open"}">
    ${kickerHtml}
    ${html.replace(
      /<h1 id="([^"]+)">(.*?)<\/h1>/,
      `<h1 id="$1">$2</h1><div class="chapter-open-rule"></div>`
    )}
  </div>
</section>`);
  }

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${metadata.title}</title>
<link rel="stylesheet" href="style.css">
<style>
  /* Set on body (not a separate flow element) so it never occupies its own
     page before the cover: a standalone element assigned a named page value
     forces a page break, which produced a stray leading blank page 1. */
  body { string-set: book-title "${metadata.title}"; }
</style>
</head>
<body>
${renderCoverPage()}
${renderHalfTitlePage()}
${renderTitlePage()}
${renderCopyrightPage()}
${renderTocPage(headingIndex)}
${bodySections.join("\n")}
${renderAboutAuthorPage(marked, fmSections["About the Author"])}
</body>
</html>`;

  const htmlPath = path.join(DIST_DIR, "book.html");
  await writeFile(htmlPath, html, "utf-8");
  await writeFile(
    path.join(DIST_DIR, "style.css"),
    await readFile(path.join(__dirname, "style.css"), "utf-8"),
    "utf-8"
  );

  const pdfPath = path.join(
    DIST_DIR,
    "engineering-educational-intelligence.pdf"
  );

  const pagedCli = path.join(__dirname, "node_modules/.bin/pagedjs-cli");
  const chromePath =
    process.env.PUPPETEER_EXECUTABLE_PATH || "/usr/bin/google-chrome";

  console.log("- Rendering PDF with pagedjs-cli (this takes a few seconds)...");
  await run(
    pagedCli,
    [
      htmlPath,
      "-o",
      pdfPath,
      "--outline-tags",
      "h1,h2",
      "--allowedPath",
      DIST_DIR,
    ],
    {
      env: { ...process.env, PUPPETEER_EXECUTABLE_PATH: chromePath },
      maxBuffer: 1024 * 1024 * 32,
    }
  );

  // Chromium's print-to-pdf does not expose PDF Info metadata (Title/Author/
  // Subject) through CSS/HTML, so set it directly on the generated file.
  const pdfBytes = await readFile(pdfPath);
  const pdfDoc = await PDFDocument.load(pdfBytes);
  pdfDoc.setTitle(metadata.title);
  pdfDoc.setAuthor(metadata.author);
  pdfDoc.setSubject(
    "An architecture for systems that reason about learner evidence, trajectory, and confidence."
  );
  pdfDoc.setProducer(`${metadata.publisher} book-build pipeline`);
  pdfDoc.setCreator(metadata.author);
  const finalBytes = await pdfDoc.save();
  await writeFile(pdfPath, finalBytes);

  console.log(`\nBuilt: ${pdfPath}`);
  console.log(`Pages: ${pdfDoc.getPageCount()}`);
  console.log(`Size: ${(finalBytes.length / 1024).toFixed(0)} KB`);
  console.log(`ISBN in artifact: ${metadata.isbn ?? "(omitted — none supplied)"}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
