// Local PPTX renderer (PptxGenJS). Reads structured presentation content from
// a JSON file path (--in) and writes an editable .pptx to --out. The backend
// invokes this script; the agent never talks to it directly.
//
// Themes are fully local color palettes only. No network access, no images, no
// templates downloaded at runtime.

const path = require("path");
const fs = require("fs");

const THEMES = {
  executive: {
    bg: "FFFFFF",
    accent: "1F3B57",
    accent2: "B7791F",
    text: "1A2733",
    muted: "5A6B7B",
    light: "EEF3F8",
  },
  technical: {
    bg: "FFFFFF",
    accent: "123B6B",
    accent2: "0F7A5C",
    text: "17212B",
    muted: "4A5A68",
    light: "EAF1FA",
  },
  report: {
    bg: "FFFFFF",
    accent: "7047EB",
    accent2: "0E7490",
    text: "1E293B",
    muted: "64748B",
    light: "F1EDFB",
  },
  general: {
    bg: "FFFFFF",
    accent: "2E4A62",
    accent2: "B45309",
    text: "1F2937",
    muted: "6B7280",
    light: "F1F5F9",
  },
};

function themeFor(name) {
  return THEMES[name] || THEMES.general;
}

// Slide geometry. LAYOUT_WIDE is 13.33in x 7.5in (16:9); all content blocks are
// derived from these constants so nothing is hardcoded for a narrower template.
const SLIDE_W = 13.33;
const MARGIN = 0.6;
const CONTENT_W = SLIDE_W - MARGIN * 2; // 12.13in
const COLUMN_GUTTER = 0.45;

function parseArgs(argv) {
  const args = { in: null, out: null };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === "--in") args.in = argv[i + 1];
    if (argv[i] === "--out") args.out = argv[i + 1];
  }
  if (!args.in || !args.out) {
    throw new Error("Usage: node render.cjs --in <content.json> --out <deck.pptx>");
  }
  return args;
}

function addTitleSlide(pptx, deck, slide) {
  const s = pptx.addSlide();
  s.background = { color: deck.bg };
  s.addShape("rect", { x: 0, y: 0, w: "100%", h: 0.35, fill: { color: deck.accent } });
  if (slide.title) {
    s.addText(slide.title, {
      x: MARGIN, y: 2.6, w: CONTENT_W, h: 1.2, fontSize: 40, bold: true, color: deck.text,
    });
  }
  if (slide.content) {
    s.addText(slide.content, {
      x: MARGIN, y: 3.9, w: CONTENT_W, h: 1.0, fontSize: 16, color: deck.muted,
    });
  }
  return s;
}

function addContentSlide(pptx, deck, slide) {
  const s = pptx.addSlide();
  s.background = { color: deck.bg };
  if (slide.title) {
    s.addText(slide.title, {
      x: MARGIN, y: 0.5, w: CONTENT_W, h: 0.9, fontSize: 26, bold: true, color: deck.text,
    });
    s.addShape("rect", { x: MARGIN, y: 1.35, w: 1.1, h: 0.05, fill: { color: deck.accent2 } });
  }
  const paragraphs = Array.isArray(slide.content) ? slide.content : [slide.content || ""];
  s.addText(
    paragraphs.map((p) => ({ text: p, options: { bullet: false, breakLine: true } })),
    {
      x: MARGIN, y: 1.7, w: CONTENT_W, h: 5.0, fontSize: 15, color: deck.text, valign: "top",
    },
  );
  return s;
}

function addBulletSlide(pptx, deck, slide) {
  const s = pptx.addSlide();
  s.background = { color: deck.bg };
  if (slide.title) {
    s.addText(slide.title, {
      x: MARGIN, y: 0.5, w: CONTENT_W, h: 0.9, fontSize: 26, bold: true, color: deck.text,
    });
    s.addShape("rect", { x: MARGIN, y: 1.35, w: 1.1, h: 0.05, fill: { color: deck.accent2 } });
  }
  const items = Array.isArray(slide.bullets) ? slide.bullets : slide.content ? [slide.content] : [];
  s.addText(
    items.map((b) => ({ text: String(b), options: { bullet: { code: "2022" } } })),
    {
      x: MARGIN + 0.1, y: 1.75, w: CONTENT_W - 0.2, h: 5.0, fontSize: 16, color: deck.text, valign: "top", paraSpaceAfter: 12,
    },
  );
  return s;
}

function addTwoColumnSlide(pptx, deck, slide) {
  const s = pptx.addSlide();
  s.background = { color: deck.bg };
  if (slide.title) {
    s.addText(slide.title, {
      x: MARGIN, y: 0.5, w: CONTENT_W, h: 0.9, fontSize: 26, bold: true, color: deck.text,
    });
    s.addShape("rect", { x: MARGIN, y: 1.35, w: 1.1, h: 0.05, fill: { color: deck.accent2 } });
  }
  const cols = slide.columns && slide.columns.length === 2 ? slide.columns : [slide.content || "", ""];
  const usable = CONTENT_W - COLUMN_GUTTER;
  const ratios = slide.column_ratios || slide.columnRatios;
  let widths;
  if (Array.isArray(ratios) && ratios.length === 2) {
    const total = ratios.reduce((a, b) => a + Number(b), 0) || 1;
    widths = [(ratios[0] / total) * usable, (ratios[1] / total) * usable];
  } else {
    widths = [usable / 2, usable / 2];
  }
  const rightX = MARGIN + widths[0] + COLUMN_GUTTER;
  s.addText(String(cols[0]), {
    x: MARGIN, y: 1.75, w: widths[0], h: 4.8, fontSize: 14, color: deck.text, valign: "top",
  });
  s.addShape("rect", { x: MARGIN + widths[0] + COLUMN_GUTTER / 2, y: 1.75, w: 0.03, h: 4.6, fill: { color: deck.light } });
  s.addText(String(cols[1]), {
    x: rightX, y: 1.75, w: CONTENT_W - widths[0] - COLUMN_GUTTER, h: 4.8, fontSize: 14, color: deck.text, valign: "top",
  });
  return s;
}

function addTableSlide(pptx, deck, slide) {
  const s = pptx.addSlide();
  s.background = { color: deck.bg };
  if (slide.title) {
    s.addText(slide.title, {
      x: MARGIN, y: 0.5, w: CONTENT_W, h: 0.9, fontSize: 26, bold: true, color: deck.text,
    });
    s.addShape("rect", { x: MARGIN, y: 1.35, w: 1.1, h: 0.05, fill: { color: deck.accent2 } });
  }
  const rows = slide.table && Array.isArray(slide.table) ? slide.table : [];
  const grid = rows.length > 0 ? rows[0].length : 2;
  const colW = CONTENT_W / Math.max(grid, 1);
  const header = rows.length > 0 ? rows[0] : [];
  const body = rows.length > 1 ? rows.slice(1) : [];
  s.addTable(
    [
      header.map((h, c) => ({
        text: String(h),
        options: { bold: true, color: "FFFFFF", fill: { color: deck.accent }, align: "left" },
      })),
      ...body.map((r) =>
        r.map((cell) => ({
          text: String(cell),
          options: { color: deck.text, fill: { color: "FFFFFF" }, align: "left" },
        })),
      ),
    ],
    {
      x: MARGIN, y: 1.8, w: CONTENT_W, colW, fontSize: 12, rowH: 0.5, border: { type: "solid", color: deck.light },
    },
  );
  return s;
}

function addSourcesSlide(pptx, deck, slide) {
  const s = pptx.addSlide();
  s.background = { color: deck.bg };
  if (slide.title) {
    s.addText(slide.title, {
      x: MARGIN, y: 0.5, w: CONTENT_W, h: 0.9, fontSize: 26, bold: true, color: deck.text,
    });
    s.addShape("rect", { x: MARGIN, y: 1.35, w: 1.1, h: 0.05, fill: { color: deck.accent2 } });
  }
  const sources = Array.isArray(slide.sources) ? slide.sources : slide.content ? [slide.content] : [];
  s.addText(
    sources.map((src) => ({ text: String(src), options: { bullet: { code: "2013" } } })),
    {
      x: MARGIN + 0.1, y: 1.8, w: CONTENT_W - 0.2, h: 5.0, fontSize: 13, color: deck.muted, valign: "top",
    },
  );
  return s;
}

function renderSlide(pptx, deck, slide) {
  const type = slide.type || "content";
  let s;
  switch (type) {
    case "title":
      s = addTitleSlide(pptx, deck, slide);
      break;
    case "bullets":
      s = addBulletSlide(pptx, deck, slide);
      break;
    case "two-column":
    case "two_column":
      s = addTwoColumnSlide(pptx, deck, slide);
      break;
    case "table":
      s = addTableSlide(pptx, deck, slide);
      break;
    case "sources":
      s = addSourcesSlide(pptx, deck, slide);
      break;
    case "content":
    default:
      s = addContentSlide(pptx, deck, slide);
      break;
  }
  if (s && slide.notes) {
    s.addNotes(String(slide.notes));
  }
}

async function main() {
  const { in: inPath, out: outPath } = parseArgs(process.argv);
  const raw = fs.readFileSync(inPath, "utf8").replace(/^\uFEFF/, "");
  const content = JSON.parse(raw);
  const deck = themeFor(content.theme);
  const pptxgen = require("pptxgenjs");
  const pptx = new pptxgen();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = content.author || "";
  pptx.subject = content.subject || "";

  const slides = Array.isArray(content.slides) ? content.slides : [];
  if (slides.length === 0) {
    throw new Error("presentation has no slides");
  }
  for (const slide of slides) {
    renderSlide(pptx, deck, slide);
  }
  await pptx.writeFile({ fileName: outPath });
  console.log(JSON.stringify({ ok: true, slides: slides.length, out: outPath }));
}

main().catch((err) => {
  console.error(String((err && err.stack) || err));
  process.exit(1);
});
