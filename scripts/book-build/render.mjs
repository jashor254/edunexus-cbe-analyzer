// Renders book.html to PDF using pagedjs-cli's Printer *as a library* rather
// than shelling out to its CLI binary, so we get a live handle on the
// rendered Puppeteer page before it is closed.
//
// Why: Chromium's print-to-pdf drops link annotations for every <a> rendered
// inside Paged.js's paginated output (confirmed by isolated testing — a plain
// unpaginated page keeps its link annotations fine; the same href, once
// routed through Paged.js's per-page fragments, produces zero /Annots).
// Chromium still computes correct on-screen geometry for those elements, so
// rather than fight the browser's print pipeline, we read the real
// (page number, rectangle) for every link and destination heading straight
// out of the rendered DOM and write standard PDF Link annotations and an
// outline ourselves with pdf-lib. This is Option B from the interactivity
// brief: reconstruct annotations post-hoc from the paginated DOM, not a new
// rendering approach.

import Printer from "pagedjs-cli";
import { PDFDocument, PDFArray, PDFName, PDFString } from "pdf-lib";

const PRINT_SETTINGS = {
  printBackground: true,
  displayHeaderFooter: false,
  preferCSSPageSize: true,
  margin: { top: 0, right: 0, bottom: 0, left: 0 },
};

/**
 * Renders htmlPath to PDF bytes with real link annotations and an outline.
 *
 * @param {string} htmlPath - absolute path to the assembled book HTML
 * @param {{id: string, text: string, depth: number}[]} allHeadings - every
 *   heading (h1 + h2) with an id, in document order — h1s become top-level
 *   bookmarks (About the Author included, even though it is deliberately
 *   absent from the printed Table of Contents), h2s nest beneath their
 *   enclosing h1, and the full set resolves `#id` TOC link destinations
 */
export async function renderWithLinks(htmlPath, allHeadings) {
  // allowLocal enables Chromium's --allow-file-access-from-files: Paged.js
  // fetches its linked stylesheet via XHR to read the raw CSS text (needed to
  // parse @page/string-set rules), which Chromium's default file:// same-
  // origin policy otherwise blocks outright (surfaces as an uncaught
  // ProgressEvent from the failed XHR, not a helpful error message).
  const printer = new Printer({ closeAfter: false, timeout: 0, allowLocal: true });
  const page = await printer.render(htmlPath);

  // Paged.js sizes .pagedjs_page to the browser's viewport height for its
  // on-screen preview (not the true CSS @page height), and Puppeteer's
  // default viewport is 800x600 — so getBoundingClientRect() on a page
  // measured 600px tall instead of the real 864px (9in @ 96dpi), silently
  // producing wrong (sometimes negative) link rectangles. page.pdf() itself
  // is unaffected (it reads the real @page size via preferCSSPageSize), so
  // this only matters for the geometry we read below. Matching the viewport
  // to the true page box (6in x 9in @ 96dpi) makes the live measurements
  // agree with what actually gets printed.
  await page.setViewport({ width: 576, height: 864 });

  const geometry = await page.evaluate((headingIds) => {
    const pages = Array.from(document.querySelectorAll(".pagedjs_page"));

    function pageInfo(el) {
      const container = el.closest(".pagedjs_page");
      if (!container) return null;
      const pageNumber = parseInt(container.dataset.pageNumber, 10);
      const pageRect = container.getBoundingClientRect();
      const rect = el.getBoundingClientRect();
      return {
        pageNumber,
        pageWidthPx: pageRect.width,
        pageHeightPx: pageRect.height,
        // element rect relative to the top-left of its own page box
        left: rect.left - pageRect.left,
        top: rect.top - pageRect.top,
        width: rect.width,
        height: rect.height,
      };
    }

    const links = [];
    for (const container of pages) {
      const anchors = container.querySelectorAll("a[href]");
      for (const a of anchors) {
        if (a.offsetParent === null) continue; // hidden, not actually rendered
        const href = a.getAttribute("href");
        if (!href) continue;
        const info = pageInfo(a);
        if (!info || info.width === 0 || info.height === 0) continue;
        links.push({ href, ...info });
      }
    }

    const headings = {};
    for (const id of headingIds) {
      const el = document.getElementById(id);
      if (!el) continue;
      const info = pageInfo(el);
      if (!info) continue;
      headings[id] = info;
    }

    return { links, headings };
  }, allHeadings.map((h) => h.id));

  const pdfBytes = await page.pdf(PRINT_SETTINGS);
  printer.closeAfter = true;
  await printer.close();

  const pdfDoc = await PDFDocument.load(pdfBytes);
  const pdfPages = pdfDoc.getPages();

  // Now that the file:// XHR block is fixed (allowLocal above), Chromium's
  // native print-to-pdf inconsistently emits some link annotations of its
  // own for this content (duplicating external links, and never producing
  // internal /Dest links at all) — strip whatever it added so the
  // reconstruction below is the single, deterministic source of annotations.
  for (const pdfPage of pdfPages) {
    pdfPage.node.delete(PDFName.of("Annots"));
  }

  function scaleFor(pageNumber, pageWidthPx, pageHeightPx) {
    const pdfPage = pdfPages[pageNumber - 1];
    return {
      pdfPage,
      scaleX: pdfPage.getWidth() / pageWidthPx,
      scaleY: pdfPage.getHeight() / pageHeightPx,
    };
  }

  function rectToPdf(info) {
    const { pdfPage, scaleX, scaleY } = scaleFor(
      info.pageNumber,
      info.pageWidthPx,
      info.pageHeightPx
    );
    const x1 = info.left * scaleX;
    const x2 = (info.left + info.width) * scaleX;
    const yTopFromTop = info.top * scaleY;
    const yBottomFromTop = (info.top + info.height) * scaleY;
    const pageHeightPt = pdfPage.getHeight();
    return {
      pdfPage,
      rect: [x1, pageHeightPt - yBottomFromTop, x2, pageHeightPt - yTopFromTop],
    };
  }

  function addAnnotToPage(pdfPage, annotDict) {
    const context = pdfDoc.context;
    const ref = context.register(annotDict);
    const existing = pdfPage.node.lookup(PDFName.of("Annots"));
    if (existing instanceof PDFArray) {
      existing.push(ref);
    } else {
      pdfPage.node.set(PDFName.of("Annots"), context.obj([ref]));
    }
    return ref;
  }

  function destFor(id) {
    const info = geometry.headings[id];
    if (!info) return null;
    const pdfPage = pdfPages[info.pageNumber - 1];
    const scaleY = pdfPage.getHeight() / info.pageHeightPx;
    const y = pdfPage.getHeight() - info.top * scaleY;
    return [pdfPage.ref, PDFName.of("XYZ"), null, y, null];
  }

  let internalCount = 0;
  let externalCount = 0;

  for (const link of geometry.links) {
    const { pdfPage, rect } = rectToPdf(link);
    const context = pdfDoc.context;

    if (link.href.startsWith("#")) {
      const targetId = link.href.slice(1);
      const dest = destFor(targetId);
      if (!dest) continue; // dangling fragment link — skip rather than guess

      const annot = context.obj({
        Type: "Annot",
        Subtype: "Link",
        Rect: rect,
        Border: [0, 0, 0],
        Dest: dest,
      });
      addAnnotToPage(pdfPage, annot);
      internalCount++;
    } else if (link.href.startsWith("mailto:") || link.href.startsWith("http")) {
      const annot = context.obj({
        Type: "Annot",
        Subtype: "Link",
        Rect: rect,
        Border: [0, 0, 0],
        A: {
          Type: "Action",
          S: "URI",
          URI: PDFString.of(link.href),
        },
      });
      addAnnotToPage(pdfPage, annot);
      externalCount++;
    }
  }

  // --- Outline (bookmarks): built directly from the same page-lookup data,
  // rather than pagedjs-cli's own outline machinery (which produced an empty
  // outline for this document — see the publication-artifact report).
  const context = pdfDoc.context;

  // Build top-level (h1) entries with their h2 children nested beneath.
  const topLevel = allHeadings.filter((h) => h.depth === 1);
  const built = [];

  for (let i = 0; i < topLevel.length; i++) {
    const top = topLevel[i];
    const nextTop = topLevel[i + 1];
    const children = allHeadings.filter((h) => {
      if (h.depth !== 2) return false;
      const idx = allHeadings.indexOf(h);
      const topIdx = allHeadings.indexOf(top);
      const nextTopIdx = nextTop ? allHeadings.indexOf(nextTop) : Infinity;
      return idx > topIdx && idx < nextTopIdx;
    });

    const topDest = destFor(top.id);
    if (!topDest) continue;

    const topRef = context.nextRef();
    const childRefs = [];
    for (const child of children) {
      const childDest = destFor(child.id);
      if (!childDest) continue;
      const childRef = context.nextRef();
      childRefs.push({ ref: childRef, title: child.text, dest: childDest });
    }

    built.push({ ref: topRef, title: top.text, dest: topDest, children: childRefs });
  }

  if (built.length > 0) {
    const outlineRootRef = context.nextRef();

    // Assign Parent/Next/Prev/First/Last/Count for each top-level node and its children.
    for (let i = 0; i < built.length; i++) {
      const node = built[i];
      const dict = {
        Title: PDFString.of(node.title),
        Parent: outlineRootRef,
        Dest: node.dest,
      };
      if (i > 0) dict.Prev = built[i - 1].ref;
      if (i < built.length - 1) dict.Next = built[i + 1].ref;
      if (node.children.length > 0) {
        dict.First = node.children[0].ref;
        dict.Last = node.children[node.children.length - 1].ref;
        dict.Count = node.children.length;
      }
      context.assign(node.ref, context.obj(dict));

      for (let j = 0; j < node.children.length; j++) {
        const child = node.children[j];
        const childDict = {
          Title: PDFString.of(child.title),
          Parent: node.ref,
          Dest: child.dest,
        };
        if (j > 0) childDict.Prev = node.children[j - 1].ref;
        if (j < node.children.length - 1) childDict.Next = node.children[j + 1].ref;
        context.assign(child.ref, context.obj(childDict));
      }
    }

    const totalCount = built.reduce(
      (sum, n) => sum + 1 + n.children.length,
      0
    );
    const outlineRoot = context.obj({
      Type: "Outlines",
      First: built[0].ref,
      Last: built[built.length - 1].ref,
      Count: totalCount,
    });
    context.assign(outlineRootRef, outlineRoot);
    pdfDoc.catalog.set(PDFName.of("Outlines"), outlineRootRef);
  }

  return {
    pdfDoc,
    stats: {
      internalLinks: internalCount,
      externalLinks: externalCount,
      totalPages: pdfPages.length,
      bookmarks: built.length,
    },
  };
}
