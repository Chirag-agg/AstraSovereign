// Local PPTX renderer (PptxGenJS). Reads structured presentation content from
// a JSON file path (--in) and writes an editable .pptx to --out. The backend
// invokes this script; the agent never talks to it directly.
//
// Themes are fully local color palettes only. No network access, no templates
// downloaded at runtime. The only images that appear are ones the backend has
// already resolved to a local file path or handed over as base64 PNG data (for
// a source format this renderer cannot decode); this script never fetches
// anything.

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
const SLIDE_H = 7.5;
const MARGIN = 0.6;
const CONTENT_W = SLIDE_W - MARGIN * 2; // 12.13in
const COLUMN_GUTTER = 0.45;
const CONTENT_TOP = 1.7;
const CONTENT_H = 5.0;
// A full-width band at the foot of a slide, for slide types whose body fills
// the width and so cannot share the row with a picture.
const IMAGE_BAND_H = 1.7;
const IMAGE_BAND_Y = SLIDE_H - MARGIN - IMAGE_BAND_H;
// Side-by-side split for text-heavy slides that carry a picture.
const SIDE_TEXT_W = CONTENT_W * 0.56 - COLUMN_GUTTER;
const SIDE_IMAGE_X = MARGIN + CONTENT_W * 0.56;
const SIDE_IMAGE_W = CONTENT_W * 0.44;

// PptxGenJS can write an autofit hint ("fit"), but both PowerPoint and Word only
// recalculate the scale when a human edits or resizes the shape — the library
// cannot trigger it. So the size is chosen here from the amount of text, which
// is what actually keeps long content on the slide.
function fitFont(base, chars, softLimit) {
  if (!chars || chars <= softLimit) return base;
  const scaled = Math.round(base * Math.sqrt(softLimit / chars));
  return Math.max(Math.round(base * 0.55), Math.min(base, scaled));
}

function totalChars(items) {
  return (items || []).reduce((sum, item) => sum + String(item).length, 0);
}

// An image the backend resolved to a local path, or the base64 PNG it
// substituted for a source this renderer cannot decode; absent on most slides.
function slideImage(slide) {
  const image = slide.image;
  if (!image || (!image.path && !image.data)) return null;
  return image;
}

// PptxGenJS takes the source either as a path or as a "data:" payload; its
// presence is what changes, never the geometry below.
function imageSource(image) {
  return image.data ? { data: image.data } : { path: image.path };
}

function addImageSide(slide, s, box) {
  const image = slideImage(slide);
  if (!image) return false;
  s.addImage({
    ...imageSource(image),
    x: SIDE_IMAGE_X,
    y: box.y,
    w: SIDE_IMAGE_W,
    h: box.h,
    sizing: { type: "contain", w: SIDE_IMAGE_W, h: box.h },
    altText: image.caption || "",
  });
  return true;
}

function addImageBand(s, slide, maxY) {
  const image = slideImage(slide);
  if (!image) return false;
  const y = Math.max(maxY, IMAGE_BAND_Y);
  const h = SLIDE_H - MARGIN - y;
  if (h <= 0.4) return false;
  s.addImage({
    ...imageSource(image),
    x: MARGIN,
    y,
    w: CONTENT_W,
    h,
    sizing: { type: "contain", w: CONTENT_W, h },
    altText: image.caption || "",
  });
  return true;
}

// Height of a slide's body text. A picture in the foot band takes the bottom of
// the slide, so the body must stop above it or the two would overlap; with no
// picture the body reaches the full content height.
function bodyHeight(hasImage) {
  return hasImage ? IMAGE_BAND_Y - CONTENT_TOP - 0.2 : CONTENT_H;
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
      x: MARGIN, y: 2.6, w: CONTENT_W, h: 1.2, fontSize: 40, bold: true, color: deck.text,
      fit: "shrink",
    });
  }
  if (slide.content) {
    s.addText(slide.content, {
      x: MARGIN, y: 3.9, w: CONTENT_W, h: 1.0, fontSize: 16, color: deck.muted,
      fit: "shrink",
    });
  }
  // A picture sits in the foot band, clear of the title and subtitle.
  addImageBand(s, slide, slide.content ? 5.05 : 4.0);
  return s;
}

function addContentSlide(pptx, deck, slide) {
  const s = pptx.addSlide();
  s.background = { color: deck.bg };
  if (slide.title) {
    s.addText(slide.title, {
      x: MARGIN, y: 0.5, w: CONTENT_W, h: 0.9, fontSize: 26, bold: true, color: deck.text,
      fit: "shrink",
    });
    s.addShape("rect", { x: MARGIN, y: 1.35, w: 1.1, h: 0.05, fill: { color: deck.accent2 } });
  }
  const paragraphs = Array.isArray(slide.content) ? slide.content : [slide.content || ""];
  const image = slideImage(slide);
  const textWidth = (image ? SIDE_TEXT_W : CONTENT_W) - 0.2;
  s.addText(
    paragraphs.map((p) => ({ text: p, options: { bullet: false, breakLine: true } })),
    {
      x: MARGIN,
      y: CONTENT_TOP,
      w: textWidth,
      h: CONTENT_H,
      fontSize: fitFont(15, totalChars(paragraphs), image ? 900 : 1600),
      color: deck.text,
      valign: "top",
      fit: "shrink",
    },
  );
  addImageSide(slide, s, { y: CONTENT_TOP, h: CONTENT_H });
  return s;
}

function addBulletSlide(pptx, deck, slide) {
  const s = pptx.addSlide();
  s.background = { color: deck.bg };
  if (slide.title) {
    s.addText(slide.title, {
      x: MARGIN, y: 0.5, w: CONTENT_W, h: 0.9, fontSize: 26, bold: true, color: deck.text,
      fit: "shrink",
    });
    s.addShape("rect", { x: MARGIN, y: 1.35, w: 1.1, h: 0.05, fill: { color: deck.accent2 } });
  }
  const items = Array.isArray(slide.bullets) ? slide.bullets : slide.content ? [slide.content] : [];
  const image = slideImage(slide);
  const textWidth = (image ? SIDE_TEXT_W : CONTENT_W) - 0.2;
  s.addText(
    items.map((b) => ({ text: String(b), options: { bullet: { code: "2022" } } })),
    {
      x: MARGIN + 0.1,
      y: 1.75,
      w: textWidth,
      h: CONTENT_H,
      fontSize: fitFont(16, totalChars(items), image ? 450 : 700),
      color: deck.text,
      valign: "top",
      paraSpaceAfter: 12,
      fit: "shrink",
    },
  );
  addImageSide(slide, s, { y: 1.75, h: CONTENT_H });
  return s;
}

function addTwoColumnSlide(pptx, deck, slide) {
  const s = pptx.addSlide();
  s.background = { color: deck.bg };
  if (slide.title) {
    s.addText(slide.title, {
      x: MARGIN, y: 0.5, w: CONTENT_W, h: 0.9, fontSize: 26, bold: true, color: deck.text,
      fit: "shrink",
    });
    s.addShape("rect", { x: MARGIN, y: 1.35, w: 1.1, h: 0.05, fill: { color: deck.accent2 } });
  }
  const cols = slide.columns && slide.columns.length === 2 ? slide.columns : [slide.content || "", ""];
  const usable = CONTENT_W - COLUMN_GUTTER;
  const ratios = slide.column_ratios || slide.columnRatios;
  let widths;
  // The typed schema rejects a bad ratio before it gets here; this guard keeps a
  // malformed value from ever reaching PptxGenJS, whose failure is opaque.
  if (
    Array.isArray(ratios) &&
    ratios.length === 2 &&
    ratios.every((r) => Number.isFinite(Number(r)) && Number(r) > 0)
  ) {
    const total = Number(ratios[0]) + Number(ratios[1]);
    widths = [(Number(ratios[0]) / total) * usable, (Number(ratios[1]) / total) * usable];
  } else {
    widths = [usable / 2, usable / 2];
  }
  const top = CONTENT_TOP + 0.05;
  const height = bodyHeight(Boolean(slideImage(slide)));
  const fontSize = fitFont(14, totalChars([cols[0], cols[1]]), 1200);
  const rightX = MARGIN + widths[0] + COLUMN_GUTTER;
  s.addText(String(cols[0]), {
    x: MARGIN, y: top, w: widths[0], h: height, fontSize, color: deck.text, valign: "top", fit: "shrink",
  });
  s.addShape("rect", { x: MARGIN + widths[0] + COLUMN_GUTTER / 2, y: top, w: 0.03, h: Math.max(height - 0.2, 0.1), fill: { color: deck.light } });
  s.addText(String(cols[1]), {
    x: rightX, y: top, w: CONTENT_W - widths[0] - COLUMN_GUTTER, h: height, fontSize, color: deck.text, valign: "top", fit: "shrink",
  });
  addImageBand(s, slide, top + height + 0.1);
  return s;
}

function addTableSlide(pptx, deck, slide) {
  const s = pptx.addSlide();
  s.background = { color: deck.bg };
  if (slide.title) {
    s.addText(slide.title, {
      x: MARGIN, y: 0.5, w: CONTENT_W, h: 0.9, fontSize: 26, bold: true, color: deck.text,
      fit: "shrink",
    });
    s.addShape("rect", { x: MARGIN, y: 1.35, w: 1.1, h: 0.05, fill: { color: deck.accent2 } });
  }
  const rows = slide.table && Array.isArray(slide.table) ? slide.table : [];
  if (rows.length === 0) return s;
  // Grid from the widest row, with every row padded to it: sizing the grid from
  // the first row alone silently dropped every cell beyond a short header.
  const grid = rows.reduce((max, row) => Math.max(max, row.length), 0) || 2;
  const pad = (row) => Array.from({ length: grid }, (_, c) => String(row[c] == null ? "" : row[c]));
  const header = pad(rows[0]);
  const body = rows.slice(1).map(pad);

  const tableTop = 1.8;
  const hasImage = Boolean(slideImage(slide));
  const bottom = hasImage ? IMAGE_BAND_Y - 0.2 : SLIDE_H - MARGIN;
  const rowCount = Math.max(rows.length, 1);
  const rowH = Math.min(0.5, (bottom - tableTop) / rowCount);
  const fontSize = fitFont(
    12,
    rows.reduce((sum, row) => sum + row.join("").length, 0),
    1400,
  );
  s.addTable(
    [
      header.map((h) => ({
        text: h,
        options: { bold: true, color: "FFFFFF", fill: { color: deck.accent }, align: "left" },
      })),
      ...body.map((r) =>
        r.map((cell) => ({
          text: cell,
          options: { color: deck.text, fill: { color: "FFFFFF" }, align: "left" },
        })),
      ),
    ],
    {
      x: MARGIN,
      y: tableTop,
      w: CONTENT_W,
      colW: CONTENT_W / grid,
      fontSize,
      rowH,
      border: { type: "solid", color: deck.light },
    },
  );
  addImageBand(s, slide, tableTop + rowH * rowCount + 0.1);
  return s;
}

// Chart families drawn from the uniform (categories, series) shape. Kept in
// step with CHART_TYPES in the backend schema, which is the gate the model sees.
const CHART_TYPES = new Set(["bar", "line", "area", "pie", "doughnut", "radar"]);
const PIE_TYPES = new Set(["pie", "doughnut"]);

// A chart palette anchored on the theme, extended with fixed accents so a
// multi-series chart never repeats a colour for the first six series.
function chartColors(deck) {
  return [deck.accent, deck.accent2, "2E7D6B", "8A5A2B", "5B6B8C", "9C3B56"];
}

function addChartSlide(pptx, deck, slide) {
  const s = pptx.addSlide();
  s.background = { color: deck.bg };
  if (slide.title) {
    s.addText(slide.title, {
      x: MARGIN, y: 0.5, w: CONTENT_W, h: 0.9, fontSize: 26, bold: true, color: deck.text,
      fit: "shrink",
    });
    s.addShape("rect", { x: MARGIN, y: 1.35, w: 1.1, h: 0.05, fill: { color: deck.accent2 } });
  }
  const chart = slide.chart;
  const hasImage = Boolean(slideImage(slide));
  const top = CONTENT_TOP + 0.05;
  const height = hasImage ? IMAGE_BAND_Y - top - 0.2 : CONTENT_H;

  const series = chart && Array.isArray(chart.series) ? chart.series : [];
  const labels = chart && Array.isArray(chart.categories) ? chart.categories.map(String) : [];
  if (series.length === 0 || labels.length === 0) {
    // The backend model rejects a chart slide without data, so this is only
    // reachable if the payload bypassed it; show the body text rather than a
    // blank slide headlined "chart".
    s.addText(String(slide.content || ""), {
      x: MARGIN, y: top, w: CONTENT_W, h: height, fontSize: 16, color: deck.text,
      valign: "top", fit: "shrink",
    });
    addImageBand(s, slide, top + height + 0.1);
    return s;
  }

  const requested = String(chart.type || "bar").toLowerCase();
  const type = CHART_TYPES.has(requested) ? requested : "bar";
  const isPie = PIE_TYPES.has(type);
  const data = series.map((entry) => ({
    name: String(entry.name == null ? "" : entry.name) || "Series",
    labels,
    values: (Array.isArray(entry.values) ? entry.values : []).map(Number),
  }));
  // A legend names the series; with one series (or a pie, where it names the
  // slices) there is nothing to disambiguate, so it is off unless asked for.
  const showLegend =
    chart.show_legend === undefined || chart.show_legend === null
      ? data.length > 1 || isPie
      : Boolean(chart.show_legend);

  const options = {
    x: MARGIN,
    y: top,
    w: CONTENT_W,
    h: height,
    chartColors: chartColors(deck),
    showLegend,
    legendPos: "b",
    legendColor: deck.text,
    legendFontSize: 11,
    showValue: Boolean(chart.show_values),
    dataLabelColor: deck.text,
    dataLabelFontSize: 10,
    dataLabelPosition: isPie ? "bestFit" : "outEnd",
    catAxisLabelColor: deck.muted,
    catAxisLabelFontSize: 11,
    valAxisLabelColor: deck.muted,
    valAxisLabelFontSize: 11,
    catGridLine: { style: "none" },
    valGridLine: { color: deck.light, style: "solid" },
  };
  if (chart.title) {
    options.showTitle = true;
    options.title = String(chart.title);
    options.titleColor = deck.text;
    options.titleFontSize = 14;
  }
  if (type === "bar") {
    // PptxGenJS draws horizontal bars by default; "col" is the vertical column
    // chart the request usually means, and the only one that reads well here.
    options.barDir = "col";
    options.barGrouping = chart.stacked ? "stacked" : "clustered";
  }

  s.addChart(type, data, options);
  addImageBand(s, slide, top + height + 0.1);
  return s;
}

// A flow diagram: labelled boxes joined by arrows. Row for a short flow,
// column once it would otherwise be crushed — the step count decides, so a
// five-step pipeline reads top-to-bottom rather than as five slivers.
function addDiagramSlide(pptx, deck, slide) {
  const s = pptx.addSlide();
  s.background = { color: deck.bg };
  if (slide.title) {
    s.addText(slide.title, {
      x: MARGIN, y: 0.5, w: CONTENT_W, h: 0.9, fontSize: 26, bold: true, color: deck.text,
      fit: "shrink",
    });
    s.addShape("rect", { x: MARGIN, y: 1.35, w: 1.1, h: 0.05, fill: { color: deck.accent2 } });
  }
  const diagram = slide.diagram;
  const nodes = diagram && Array.isArray(diagram.nodes) ? diagram.nodes : [];
  const hasImage = Boolean(slideImage(slide));
  const top = CONTENT_TOP + 0.05;
  const height = hasImage ? IMAGE_BAND_Y - top - 0.2 : CONTENT_H;

  if (nodes.length < 2) {
    // The backend model rejects a diagram without two labelled nodes; this
    // guard only keeps a payload that bypassed it from drawing nothing.
    s.addText(String(slide.content || ""), {
      x: MARGIN, y: top, w: CONTENT_W, h: height, fontSize: 16, color: deck.text,
      valign: "top", fit: "shrink",
    });
    addImageBand(s, slide, top + height + 0.1);
    return s;
  }

  const requested = String(diagram.layout || "row").toLowerCase();
  const layout = requested === "column" || nodes.length > 4 ? "column" : "row";
  const arrow = 0.45; // reserved gap for the connector between boxes
  const gaps = nodes.length - 1;

  const boxText = (node) =>
    node.detail
      ? [
          { text: String(node.label), options: { bold: true, breakLine: true } },
          { text: String(node.detail), options: { fontSize: "75%", color: deck.muted } },
        ]
      : String(node.label);

  if (layout === "row") {
    const boxW = (CONTENT_W - arrow * gaps) / nodes.length;
    const boxH = Math.min(height, 1.8);
    const y = top + (height - boxH) / 2;
    nodes.forEach((node, i) => {
      const x = MARGIN + i * (boxW + arrow);
      s.addShape("roundRect", {
        x, y, w: boxW, h: boxH,
        fill: { color: deck.light },
        line: { color: deck.accent, width: 1 },
        rectRadius: 0.08,
      });
      s.addText(boxText(node), {
        x: x + 0.12, y: y + 0.1, w: boxW - 0.24, h: boxH - 0.2,
        fontSize: 13, color: deck.text, align: "center", valign: "middle", fit: "shrink",
      });
      if (i < gaps) {
        const ax = x + boxW + 0.06;
        s.addShape("rightArrow", {
          x: ax, y: y + boxH / 2 - 0.14, w: arrow - 0.12, h: 0.28,
          fill: { color: deck.accent2 },
        });
      }
    });
  } else {
    const boxH = (height - arrow * gaps) / nodes.length;
    const x = MARGIN + CONTENT_W * 0.08;
    const boxW = CONTENT_W * 0.84;
    nodes.forEach((node, i) => {
      const y = top + i * (boxH + arrow);
      s.addShape("roundRect", {
        x, y, w: boxW, h: boxH,
        fill: { color: deck.light },
        line: { color: deck.accent, width: 1 },
        rectRadius: 0.08,
      });
      s.addText(boxText(node), {
        x: x + 0.18, y: y + 0.08, w: boxW - 0.36, h: boxH - 0.16,
        fontSize: 13, color: deck.text, align: "center", valign: "middle", fit: "shrink",
      });
      if (i < gaps) {
        const ay = y + boxH + 0.05;
        s.addShape("downArrow", {
          x: x + boxW / 2 - 0.14, y: ay, w: 0.28, h: arrow - 0.1,
          fill: { color: deck.accent2 },
        });
      }
    });
  }
  addImageBand(s, slide, top + height + 0.1);
  return s;
}

function addSourcesSlide(pptx, deck, slide) {
  const s = pptx.addSlide();
  s.background = { color: deck.bg };
  if (slide.title) {
    s.addText(slide.title, {
      x: MARGIN, y: 0.5, w: CONTENT_W, h: 0.9, fontSize: 26, bold: true, color: deck.text,
      fit: "shrink",
    });
    s.addShape("rect", { x: MARGIN, y: 1.35, w: 1.1, h: 0.05, fill: { color: deck.accent2 } });
  }
  const sources = Array.isArray(slide.sources) ? slide.sources : slide.content ? [slide.content] : [];
  const height = bodyHeight(Boolean(slideImage(slide)));
  s.addText(
    sources.map((src) => ({ text: String(src), options: { bullet: { code: "2013" } } })),
    {
      x: MARGIN + 0.1,
      y: 1.8,
      w: CONTENT_W - 0.2,
      h: height,
      fontSize: fitFont(13, totalChars(sources), 900),
      color: deck.muted,
      valign: "top",
      fit: "shrink",
    },
  );
  addImageBand(s, slide, 1.8 + height + 0.1);
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
    case "chart":
      s = addChartSlide(pptx, deck, slide);
      break;
    case "diagram":
      s = addDiagramSlide(pptx, deck, slide);
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
