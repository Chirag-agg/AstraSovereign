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
      x: 0.6, y: 2.2, w: 9.3, h: 1.2, fontSize: 40, bold: true, color: deck.text,
    });
  }
  if (slide.content) {
    s.addText(slide.content, {
      x: 0.6, y: 3.5, w: 9.3, h: 1.0, fontSize: 16, color: deck.muted,
    });
  }
}

function addContentSlide(pptx, deck, slide) {
  const s = pptx.addSlide();
  s.background = { color: deck.bg };
  if (slide.title) {
    s.addText(slide.title, {
      x: 0.6, y: 0.5, w: 9.3, h: 0.9, fontSize: 26, bold: true, color: deck.text,
    });
    s.addShape("rect", { x: 0.6, y: 1.35, w: 1.1, h: 0.05, fill: { color: deck.accent2 } });
  }
  const paragraphs = Array.isArray(slide.content) ? slide.content : [slide.content || ""];
  s.addText(
    paragraphs.map((p) => ({ text: p, options: { bullet: false, breakLine: true } })),
    {
      x: 0.6, y: 1.7, w: 9.3, h: 5.0, fontSize: 15, color: deck.text, valign: "top",
    },
  );
}

function addBulletSlide(pptx, deck, slide) {
  const s = pptx.addSlide();
  s.background = { color: deck.bg };
  if (slide.title) {
    s.addText(slide.title, {
      x: 0.6, y: 0.5, w: 9.3, h: 0.9, fontSize: 26, bold: true, color: deck.text,
    });
    s.addShape("rect", { x: 0.6, y: 1.35, w: 1.1, h: 0.05, fill: { color: deck.accent2 } });
  }
  const items = Array.isArray(slide.bullets) ? slide.bullets : slide.content ? [slide.content] : [];
  s.addText(
    items.map((b) => ({ text: String(b), options: { bullet: { code: "2022" } } })),
    {
      x: 0.7, y: 1.75, w: 9.1, h: 5.0, fontSize: 16, color: deck.text, valign: "top", paraSpaceAfter: 12,
    },
  );
}

function addTwoColumnSlide(pptx, deck, slide) {
  const s = pptx.addSlide();
  s.background = { color: deck.bg };
  if (slide.title) {
    s.addText(slide.title, {
      x: 0.6, y: 0.5, w: 9.3, h: 0.9, fontSize: 26, bold: true, color: deck.text,
    });
    s.addShape("rect", { x: 0.6, y: 1.35, w: 1.1, h: 0.05, fill: { color: deck.accent2 } });
  }
  const cols = slide.columns && slide.columns.length === 2 ? slide.columns : [slide.content || "", ""];
  const widths = slide.columnRatios && slide.columnRatios.length === 2 ? slide.columnRatios : [4.6, 4.6];
  s.addText(String(cols[0]), {
    x: 0.6, y: 1.75, w: widths[0], h: 4.8, fontSize: 14, color: deck.text, valign: "top",
  });
  s.addShape("rect", { x: 0.6 + widths[0] + 0.25, y: 1.75, w: 0.03, h: 4.6, fill: { color: deck.light } });
  s.addText(String(cols[1]), {
    x: 0.6 + widths[0] + 0.45, y: 1.75, w: widths[1] - 0.3, h: 4.8, fontSize: 14, color: deck.text, valign: "top",
  });
}

function addTableSlide(pptx, deck, slide) {
  const s = pptx.addSlide();
  s.background = { color: deck.bg };
  if (slide.title) {
    s.addText(slide.title, {
      x: 0.6, y: 0.5, w: 9.3, h: 0.9, fontSize: 26, bold: true, color: deck.text,
    });
    s.addShape("rect", { x: 0.6, y: 1.35, w: 1.1, h: 0.05, fill: { color: deck.accent2 } });
  }
  const rows = slide.table && Array.isArray(slide.table) ? slide.table : [];
  const grid = rows.length > 0 ? rows[0].length : 2;
  const colW = 9.3 / Math.max(grid, 1);
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
      x: 0.6, y: 1.8, w: 9.3, colW, fontSize: 12, rowH: 0.5, border: { type: "solid", color: deck.light },
    },
  );
}

function addSourcesSlide(pptx, deck, slide) {
  const s = pptx.addSlide();
  s.background = { color: deck.bg };
  if (slide.title) {
    s.addText(slide.title, {
      x: 0.6, y: 0.5, w: 9.3, h: 0.9, fontSize: 26, bold: true, color: deck.text,
    });
    s.addShape("rect", { x: 0.6, y: 1.35, w: 1.1, h: 0.05, fill: { color: deck.accent2 } });
  }
  const sources = Array.isArray(slide.sources) ? slide.sources : slide.content ? [slide.content] : [];
  s.addText(
    sources.map((src) => ({ text: String(src), options: { bullet: { code: "2013" } } })),
    {
      x: 0.7, y: 1.8, w: 9.0, h: 5.0, fontSize: 13, color: deck.muted, valign: "top",
    },
  );
}

function renderSlide(pptx, deck, slide) {
  const type = slide.type || "content";
  switch (type) {
    case "title":
      addTitleSlide(pptx, deck, slide);
      break;
    case "bullets":
      addBulletSlide(pptx, deck, slide);
      break;
    case "two-column":
    case "two_column":
      addTwoColumnSlide(pptx, deck, slide);
      break;
    case "table":
      addTableSlide(pptx, deck, slide);
      break;
    case "sources":
      addSourcesSlide(pptx, deck, slide);
      break;
    case "content":
    default:
      addContentSlide(pptx, deck, slide);
      break;
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
