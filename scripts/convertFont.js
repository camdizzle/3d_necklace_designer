// Convert TTF to three.js typeface.json using opentype.js.
// Usage: node scripts/convertFont.js <input.ttf> <output.typeface.json> <familyName>

const fs = require('fs');
const path = require('path');
const opentype = require('opentype.js');

const [,, inputPath, outputPath, familyNameOverride] = process.argv;
if (!inputPath || !outputPath) {
  console.error('Usage: node scripts/convertFont.js <input.ttf> <output.typeface.json> [familyName]');
  process.exit(1);
}

const font = opentype.loadSync(inputPath);
const unitsPerEm = font.unitsPerEm || 1000;
const scale = 1000 / unitsPerEm;
const round = (n) => Math.round(n * scale);

const result = {
  glyphs: {},
  familyName: familyNameOverride || font.names.fontFamily?.en || 'Unknown',
  ascender: round(font.ascender),
  descender: round(font.descender),
  underlinePosition: round(font.tables.post?.underlinePosition ?? -100),
  underlineThickness: round(font.tables.post?.underlineThickness ?? 50),
  boundingBox: {
    xMin: round(font.tables.head.xMin),
    yMin: round(font.tables.head.yMin),
    xMax: round(font.tables.head.xMax),
    yMax: round(font.tables.head.yMax)
  },
  resolution: 1000,
  original_font_information: font.tables.name || {},
  cssFontWeight: 'normal',
  cssFontStyle: 'normal'
};

// Iterate every glyph and include those with a unicode mapping.
for (let i = 0; i < font.glyphs.length; i++) {
  const glyph = font.glyphs.get(i);
  const unicodes = [];
  if (glyph.unicode !== undefined) unicodes.push(glyph.unicode);
  if (glyph.unicodes?.length) {
    for (const u of glyph.unicodes) {
      if (!unicodes.includes(u)) unicodes.push(u);
    }
  }

  for (const u of unicodes) {
    const ch = String.fromCodePoint(u);
    // Only include printable ASCII to keep file size manageable
    if (u < 0x20 || u > 0x7e) continue;

    const token = {
      ha: round(glyph.advanceWidth || 0),
      x_min: round(glyph.xMin ?? 0),
      x_max: round(glyph.xMax ?? 0),
      o: ''
    };

    const cmds = glyph.path?.commands || [];
    const parts = [];
    for (const cmd of cmds) {
      const type = cmd.type.toLowerCase() === 'c' ? 'b' : cmd.type.toLowerCase();
      parts.push(type);
      if (cmd.x !== undefined && cmd.y !== undefined) {
        parts.push(round(cmd.x), round(cmd.y));
      }
      if (cmd.x1 !== undefined && cmd.y1 !== undefined) {
        parts.push(round(cmd.x1), round(cmd.y1));
      }
      if (cmd.x2 !== undefined && cmd.y2 !== undefined) {
        parts.push(round(cmd.x2), round(cmd.y2));
      }
    }
    token.o = parts.join(' ');
    result.glyphs[ch] = token;
  }
}

// Ensure space is present
if (!result.glyphs[' ']) {
  result.glyphs[' '] = { ha: round(unitsPerEm / 4), x_min: 0, x_max: 0, o: '' };
}

fs.writeFileSync(outputPath, JSON.stringify(result));
console.log(`Wrote ${outputPath} (${Object.keys(result.glyphs).length} glyphs)`);
