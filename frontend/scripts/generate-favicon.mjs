import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");

// 1. Generate crisp SVG icon
const R = 128;
const CORE = 26;
const GAP = 0.055;

function wedge(index) {
  const a0 = (Math.PI / 3) * index - Math.PI / 2 + GAP;
  const a1 = (Math.PI / 3) * (index + 1) - Math.PI / 2 - GAP;
  const p = (a, r) => `${(Math.cos(a) * r).toFixed(2)},${(Math.sin(a) * r).toFixed(2)}`;
  return `M ${p(a0, CORE + 8)} L ${p(a0, R)} L ${p(a1, R)} L ${p(a1, CORE + 8)} Z`;
}

const wedges = [0, 1, 2, 3, 4, 5].map((i) => {
  const fill = i % 2 === 0 ? "#b5b3a7" : "#7d7b74";
  return `  <path d="${wedge(i)}" fill="${fill}" stroke="#e8e6df" stroke-width="2" />`;
}).join("\n");

const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-150 -150 300 300" width="32" height="32">
  <rect x="-150" y="-150" width="300" height="300" rx="54" fill="#101010" />
${wedges}
  <!-- Sealed core -->
  <circle r="30" fill="#1a1a1a" stroke="#404040" stroke-width="3" />
  <circle r="19" fill="#ee6018" />
  <circle r="6" fill="#ffffff" />
</svg>
`;

fs.writeFileSync(path.join(root, "public", "icon.svg"), svgContent);
fs.writeFileSync(path.join(root, "src", "app", "icon.svg"), svgContent);
console.log("Wrote icon.svg to public/ and src/app/");

// 2. Generate standard 32x32 32bpp ICO file
function generateIco32() {
  const width = 32;
  const height = 32;
  const xorSize = width * height * 4; // 4096
  const andRowSize = Math.ceil(width / 32) * 4; // 4 bytes per row
  const andSize = andRowSize * height; // 128
  const dibHeaderSize = 40;
  const imageSize = dibHeaderSize + xorSize + andSize; // 4264
  const headerSize = 6;
  const dirEntrySize = 16;
  const totalFileSize = headerSize + dirEntrySize + imageSize; // 4286

  const buf = Buffer.alloc(totalFileSize);

  // ICONDIR
  buf.writeUInt16LE(0, 0); // Reserved
  buf.writeUInt16LE(1, 2); // Type 1 = ICO
  buf.writeUInt16LE(1, 4); // Count = 1

  // ICONDIRENTRY
  buf.writeUInt8(width, 6); // Width
  buf.writeUInt8(height, 7); // Height
  buf.writeUInt8(0, 8); // Color count (0 = >=8bpp)
  buf.writeUInt8(0, 9); // Reserved
  buf.writeUInt16LE(1, 10); // Color planes
  buf.writeUInt16LE(32, 12); // Bits per pixel
  buf.writeUInt32LE(imageSize, 14); // Image size in bytes
  buf.writeUInt32LE(headerSize + dirEntrySize, 18); // Offset to image data (22)

  // BITMAPINFOHEADER
  const dibOffset = headerSize + dirEntrySize;
  buf.writeUInt32LE(40, dibOffset); // biSize
  buf.writeInt32LE(width, dibOffset + 4); // biWidth
  buf.writeInt32LE(height * 2, dibOffset + 8); // biHeight (height * 2 for XOR + AND)
  buf.writeUInt16LE(1, dibOffset + 12); // biPlanes
  buf.writeUInt16LE(32, dibOffset + 14); // biBitCount
  buf.writeUInt32LE(0, dibOffset + 16); // biCompression (BI_RGB)
  buf.writeUInt32LE(xorSize + andSize, dibOffset + 20); // biSizeImage
  buf.writeInt32LE(0, dibOffset + 24); // biXPelsPerMeter
  buf.writeInt32LE(0, dibOffset + 28); // biYPelsPerMeter
  buf.writeUInt32LE(0, dibOffset + 32); // biClrUsed
  buf.writeUInt32LE(0, dibOffset + 36); // biClrImportant

  // XOR mask (bottom-up: row 0 is bottom, row 31 is top)
  const xorOffset = dibOffset + dibHeaderSize;
  const andOffset = xorOffset + xorSize;

  for (let y = 0; y < height; y++) {
    // inverted y because BMP is bottom-up: y=0 is bottom
    const visualY = height - 1 - y;
    for (let x = 0; x < width; x++) {
      const pixelIndex = (y * width + x) * 4;
      const target = xorOffset + pixelIndex;

      const dx = x - 15.5;
      const dy = visualY - 15.5;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Outer rounded dark background container (squircle)
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);
      const inBox = Math.max(absX, absY) <= 14.5;
      const cornerDist = Math.sqrt(Math.max(0, absX - 10) ** 2 + Math.max(0, absY - 10) ** 2);

      if (!inBox || cornerDist > 4.5) {
        // Transparent outside rounded icon boundary
        buf.writeUInt8(0, target); // B
        buf.writeUInt8(0, target + 1); // G
        buf.writeUInt8(0, target + 2); // R
        buf.writeUInt8(0, target + 3); // A
      } else {
        // Inside icon background
        if (dist <= 3.2) {
          // Core bright center
          buf.writeUInt8(255, target); // B
          buf.writeUInt8(255, target + 1); // G
          buf.writeUInt8(255, target + 2); // R
          buf.writeUInt8(255, target + 3); // A
        } else if (dist <= 6.5) {
          // Signal Orange core
          buf.writeUInt8(0x18, target); // B
          buf.writeUInt8(0x60, target + 1); // G
          buf.writeUInt8(0xee, target + 2); // R
          buf.writeUInt8(255, target + 3); // A
        } else if (dist <= 8.5) {
          // Core ring border
          buf.writeUInt8(0x38, target); // B
          buf.writeUInt8(0x38, target + 1); // G
          buf.writeUInt8(0x38, target + 2); // R
          buf.writeUInt8(255, target + 3); // A
        } else if (dist <= 13.5 && dist >= 9.5) {
          // Hexagon wedges zone (alternating bone/stone)
          const angle = Math.atan2(dy, dx) + Math.PI / 2;
          const normAngle = (angle + 2 * Math.PI) % (2 * Math.PI);
          const sector = Math.floor(normAngle / (Math.PI / 3));
          if (sector % 2 === 0) {
            buf.writeUInt8(0xb5, target); // B
            buf.writeUInt8(0xb3, target + 1); // G
            buf.writeUInt8(0xa7, target + 2); // R
          } else {
            buf.writeUInt8(0x75, target); // B
            buf.writeUInt8(0x75, target + 1); // G
            buf.writeUInt8(0x70, target + 2); // R
          }
          buf.writeUInt8(255, target + 3); // A
        } else {
          // Dark background #101010
          buf.writeUInt8(0x10, target); // B
          buf.writeUInt8(0x10, target + 1); // G
          buf.writeUInt8(0x10, target + 2); // R
          buf.writeUInt8(255, target + 3); // A
        }
      }
    }
  }

  // AND mask: all 0 for 32-bit DIB
  buf.fill(0, andOffset, andOffset + andSize);

  return buf;
}

const icoBuffer = generateIco32();
fs.writeFileSync(path.join(root, "public", "favicon.ico"), icoBuffer);
fs.writeFileSync(path.join(root, "src", "app", "favicon.ico"), icoBuffer);
console.log("Wrote favicon.ico to public/ and src/app/ (size: " + icoBuffer.length + " bytes)");
