import * as THREE from 'three';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { FONTS, MATERIALS, SCRIPT_FONTS } from './constants.js';

const fontCache = {};

// Script fonts render better in original case (lowercase letters connect)
// and need finer curves + smaller bevels because of thin delicate strokes.
function isScriptFont(fontKey) {
  return SCRIPT_FONTS.includes(fontKey);
}

// Bevel dimensions scale with text size so small fonts don't end up with
// chunky bevels that dominate the letter forms. Factors chosen so size 24
// matches the previous hard-coded values.
function getTextRenderOpts(fontKey, textSize = 24) {
  if (isScriptFont(fontKey)) {
    return {
      curveSegments: 12,
      bevelThickness: textSize * 0.017,
      bevelSize: textSize * 0.011,
      bevelSegments: 2,
      preserveCase: true
    };
  }
  return {
    curveSegments: 6,
    bevelThickness: textSize * 0.06,
    bevelSize: textSize * 0.04,
    bevelSegments: 3,
    preserveCase: false
  };
}

function loadFont(fontKey) {
  if (fontCache[fontKey]) return Promise.resolve(fontCache[fontKey]);

  return new Promise((resolve, reject) => {
    const loader = new FontLoader();
    loader.load(
      FONTS[fontKey],
      (font) => {
        fontCache[fontKey] = font;
        resolve(font);
      },
      undefined,
      reject
    );
  });
}

function createPlateShape(shapeType, width, height, radius, customShapePoints) {
  const shape = new THREE.Shape();
  const hw = width / 2;
  const hh = height / 2;

  switch (shapeType) {
    case 'circle': {
      const r = Math.max(hw, hh);
      shape.absarc(0, 0, r, 0, Math.PI * 2, false);
      return { shape, w: r * 2, h: r * 2 };
    }

    case 'oval': {
      const segments = 48;
      for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        shape.lineTo(Math.cos(angle) * hw, Math.sin(angle) * hh);
      }
      return { shape, w: width, h: height };
    }

    case 'diamond': {
      shape.moveTo(0, hh);
      shape.lineTo(hw, 0);
      shape.lineTo(0, -hh);
      shape.lineTo(-hw, 0);
      shape.closePath();
      return { shape, w: width, h: height };
    }

    case 'shield': {
      const sw = hw;
      const sh = hh;
      shape.moveTo(-sw, sh);
      shape.lineTo(sw, sh);
      shape.lineTo(sw, -sh * 0.3);
      shape.quadraticCurveTo(sw, -sh * 0.8, 0, -sh);
      shape.quadraticCurveTo(-sw, -sh * 0.8, -sw, -sh * 0.3);
      shape.closePath();
      return { shape, w: width, h: height };
    }

    case 'heart': {
      const s = Math.max(hw, hh);
      shape.moveTo(0, s * 0.7);
      shape.bezierCurveTo(-s * 0.1, s * 0.95, -s * 0.7, s * 0.95, -s * 0.9, s * 0.4);
      shape.bezierCurveTo(-s * 1.1, -s * 0.1, -s * 0.4, -s * 0.5, 0, -s);
      shape.bezierCurveTo(s * 0.4, -s * 0.5, s * 1.1, -s * 0.1, s * 0.9, s * 0.4);
      shape.bezierCurveTo(s * 0.7, s * 0.95, s * 0.1, s * 0.95, 0, s * 0.7);
      return { shape, w: s * 2, h: s * 2 };
    }

    case 'star': {
      const outerR = Math.max(hw, hh);
      const innerR = outerR * 0.45;
      const points = 5;
      for (let i = 0; i < points * 2; i++) {
        const angle = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
        const r = i % 2 === 0 ? outerR : innerR;
        if (i === 0) shape.moveTo(Math.cos(angle) * r, Math.sin(angle) * r);
        else shape.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
      }
      shape.closePath();
      return { shape, w: outerR * 2, h: outerR * 2 };
    }

    case 'custom': {
      if (customShapePoints && customShapePoints.length > 2) {
        // Custom SVG-derived shape points, already normalized to [-0.5, 0.5]
        const first = customShapePoints[0];
        shape.moveTo(first[0] * width, first[1] * height);
        for (let i = 1; i < customShapePoints.length; i++) {
          shape.lineTo(customShapePoints[i][0] * width, customShapePoints[i][1] * height);
        }
        shape.closePath();
        return { shape, w: width, h: height };
      }
      // Fallback to rectangle
      return createPlateShape('rectangle', width, height, radius);
    }

    case 'rectangle':
    default: {
      const r = Math.min(radius, hw, hh);
      const x = -hw;
      const y = -hh;
      shape.moveTo(x + r, y);
      shape.lineTo(x + width - r, y);
      shape.quadraticCurveTo(x + width, y, x + width, y + r);
      shape.lineTo(x + width, y + height - r);
      shape.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
      shape.lineTo(x + r, y + height);
      shape.quadraticCurveTo(x, y + height, x, y + height - r);
      shape.lineTo(x, y + r);
      shape.quadraticCurveTo(x, y, x + r, y);
      return { shape, w: width, h: height };
    }
  }
}

function smoothContour(points, iterations) {
  let pts = points;
  for (let iter = 0; iter < iterations; iter++) {
    const smoothed = [];
    for (let i = 0; i < pts.length; i++) {
      const curr = pts[i];
      const next = pts[(i + 1) % pts.length];
      smoothed.push([
        curr[0] * 0.75 + next[0] * 0.25,
        curr[1] * 0.75 + next[1] * 0.25
      ]);
      smoothed.push([
        curr[0] * 0.25 + next[0] * 0.75,
        curr[1] * 0.25 + next[1] * 0.75
      ]);
    }
    pts = smoothed;
  }
  return pts;
}

function computeTextOutlineShape(lineResults, padding) {
  const allPoints = [];
  for (const lr of lineResults) {
    lr.group.updateMatrixWorld(true);
    lr.group.traverse((child) => {
      if (child.isMesh && child.geometry) {
        const pos = child.geometry.attributes.position;
        const matrix = child.matrixWorld;
        for (let i = 0; i < pos.count; i++) {
          const v = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i));
          v.applyMatrix4(matrix);
          allPoints.push([v.x, v.y]);
        }
      }
    });
  }

  if (allPoints.length === 0) return null;

  let gMinY = Infinity, gMaxY = -Infinity;
  for (const p of allPoints) {
    gMinY = Math.min(gMinY, p[1]);
    gMaxY = Math.max(gMaxY, p[1]);
  }

  const yRange = gMaxY - gMinY;
  if (yRange < 0.01) return null;

  const pad = padding * 0.3;
  const numBins = 60;
  const binSize = yRange / numBins;

  const bins = [];
  for (let i = 0; i <= numBins; i++) {
    bins.push({ minX: Infinity, maxX: -Infinity });
  }

  for (const p of allPoints) {
    const idx = Math.max(0, Math.min(numBins, Math.round((p[1] - gMinY) / binSize)));
    bins[idx].minX = Math.min(bins[idx].minX, p[0]);
    bins[idx].maxX = Math.max(bins[idx].maxX, p[0]);
  }

  for (let i = 0; i <= numBins; i++) {
    if (bins[i].minX === Infinity) {
      let below = -1, above = -1;
      for (let j = i - 1; j >= 0; j--) {
        if (bins[j].minX !== Infinity) { below = j; break; }
      }
      for (let j = i + 1; j <= numBins; j++) {
        if (bins[j].minX !== Infinity) { above = j; break; }
      }
      if (below >= 0 && above >= 0) {
        const t = (i - below) / (above - below);
        bins[i].minX = bins[below].minX + (bins[above].minX - bins[below].minX) * t;
        bins[i].maxX = bins[below].maxX + (bins[above].maxX - bins[below].maxX) * t;
      } else if (below >= 0) {
        bins[i].minX = bins[below].minX;
        bins[i].maxX = bins[below].maxX;
      } else if (above >= 0) {
        bins[i].minX = bins[above].minX;
        bins[i].maxX = bins[above].maxX;
      }
    }
  }

  const contour = [];
  const topY = gMaxY + pad;
  const bottomY = gMinY - pad;

  contour.push([bins[numBins].minX - pad, topY]);
  contour.push([bins[numBins].maxX + pad, topY]);

  for (let i = numBins; i >= 0; i--) {
    contour.push([bins[i].maxX + pad, gMinY + i * binSize]);
  }

  contour.push([bins[0].maxX + pad, bottomY]);
  contour.push([bins[0].minX - pad, bottomY]);

  for (let i = 0; i <= numBins; i++) {
    contour.push([bins[i].minX - pad, gMinY + i * binSize]);
  }

  const smoothed = smoothContour(contour, 4);

  const shape = new THREE.Shape();
  shape.moveTo(smoothed[0][0], smoothed[0][1]);
  for (let i = 1; i < smoothed.length; i++) {
    shape.lineTo(smoothed[i][0], smoothed[i][1]);
  }
  shape.closePath();

  let sMinX = Infinity, sMaxX = -Infinity, sMinY = Infinity, sMaxY = -Infinity;
  for (const p of smoothed) {
    sMinX = Math.min(sMinX, p[0]); sMaxX = Math.max(sMaxX, p[0]);
    sMinY = Math.min(sMinY, p[1]); sMaxY = Math.max(sMaxY, p[1]);
  }

  return { shape, w: sMaxX - sMinX, h: sMaxY - sMinY };
}

/**
 * Create text as individual character meshes for letter spacing and curve support.
 */
function createCharacterMeshes(text, font, textSize, extrudeDepth, bevelEnabled, letterSpacing, textCurve, material, renderOpts) {
  const group = new THREE.Group();
  const chars = [];
  let totalWidth = 0;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === ' ') {
      const spaceWidth = textSize * 0.3;
      chars.push({ width: spaceWidth, mesh: null });
      totalWidth += spaceWidth + letterSpacing;
      continue;
    }

    const geo = new TextGeometry(char, {
      font,
      size: textSize,
      depth: extrudeDepth,
      curveSegments: renderOpts.curveSegments,
      bevelEnabled,
      bevelThickness: bevelEnabled ? renderOpts.bevelThickness : 0,
      bevelSize: bevelEnabled ? renderOpts.bevelSize : 0,
      bevelSegments: bevelEnabled ? renderOpts.bevelSegments : 0
    });
    geo.computeBoundingBox();
    const bb = geo.boundingBox;
    const w = bb.max.x - bb.min.x;
    const h = bb.max.y - bb.min.y;
    // Center character at its own origin
    geo.translate(-(bb.min.x + w / 2), -(bb.min.y + h / 2), 0);

    const mesh = new THREE.Mesh(geo, material.clone());
    chars.push({ width: w, height: h, mesh });
    totalWidth += w + letterSpacing;
  }
  totalWidth -= letterSpacing; // remove trailing spacing

  // Position characters along line or arc
  let cursor = -totalWidth / 2;
  for (const ch of chars) {
    if (!ch.mesh) {
      cursor += ch.width + letterSpacing;
      continue;
    }

    const cx = cursor + ch.width / 2;

    if (textCurve !== 0) {
      const radius = 300 / Math.abs(textCurve);
      const angle = cx / radius;
      const x = Math.sin(angle) * radius;
      const y = textCurve > 0
        ? (Math.cos(angle) * radius - radius)
        : -(Math.cos(angle) * radius - radius);
      ch.mesh.position.set(x, y, 0);
      ch.mesh.rotation.z = -angle * Math.sign(textCurve);
    } else {
      ch.mesh.position.set(cx, 0, 0);
    }

    group.add(ch.mesh);
    cursor += ch.width + letterSpacing;
  }

  // Compute bounds
  if (group.children.length > 0) {
    const box = new THREE.Box3().setFromObject(group);
    const size = box.getSize(new THREE.Vector3());
    return { group, width: size.x, height: size.y };
  }
  return { group, width: 0, height: 0 };
}

/**
 * Create a single text mesh (no letter spacing / curve).
 */
function createSingleTextMesh(text, font, textSize, extrudeDepth, bevelEnabled, material, renderOpts) {
  const geo = new TextGeometry(text, {
    font,
    size: textSize,
    depth: extrudeDepth,
    curveSegments: renderOpts.curveSegments,
    bevelEnabled,
    bevelThickness: bevelEnabled ? renderOpts.bevelThickness : 0,
    bevelSize: bevelEnabled ? renderOpts.bevelSize : 0,
    bevelSegments: bevelEnabled ? renderOpts.bevelSegments : 0
  });

  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  const w = bb.max.x - bb.min.x;
  const h = bb.max.y - bb.min.y;
  geo.translate(-(bb.min.x + w / 2), -(bb.min.y + h / 2), 0);

  const mesh = new THREE.Mesh(geo, material);
  const group = new THREE.Group();
  group.add(mesh);
  return { group, width: w, height: h };
}

export function createMaterial(materialKey, opts = {}) {
  const { customColor, useCustomColor, matteFinish } = opts;

  if (useCustomColor && customColor) {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(customColor),
      metalness: 0.9,
      roughness: matteFinish ? 0.7 : 0.25,
      envMapIntensity: 1.0
    });
  }

  const mat = MATERIALS[materialKey] || MATERIALS.gold;
  return new THREE.MeshStandardMaterial({
    color: mat.color,
    metalness: mat.metalness,
    roughness: matteFinish ? Math.min(mat.roughness + 0.45, 1.0) : mat.roughness,
    envMapIntensity: mat.envMapIntensity
  });
}

export async function generatePendant(params, materialOpts = {}, chainInfo = null) {
  const {
    text,
    font: fontKey,
    textSize,
    textCurve = 0,
    textOffsetX = 0,
    textOffsetY = 0,
    letterSpacing = 0,
    extrudeDepth = 8,
    bevelEnabled = true,
    alignToPlate = false,
    platePadding,
    plateRadius,
    plateThickness,
    pendantShape,
    lineSpacing = 1.0,
    textAlignment = 'center',
    secondLineText = '',
    secondLineFont = 'helvetiker_bold',
    secondLineSize = 16,
    secondLineCurve = 0,
    secondLineOffsetX = 0,
    secondLineOffsetY = 0,
    secondLineLetterSpacing = 0,
    secondLineExtrudeDepth = 8,
    secondLineBevelEnabled = true,
    secondLineAlignToPlate = false,
    thirdLineText = '',
    thirdLineFont = 'helvetiker_bold',
    thirdLineSize = 14,
    thirdLineCurve = 0,
    thirdLineOffsetX = 0,
    thirdLineOffsetY = 0,
    thirdLineLetterSpacing = 0,
    thirdLineExtrudeDepth = 8,
    thirdLineBevelEnabled = true,
    thirdLineAlignToPlate = false,
    engrave = false,
    borderWidth = 0,
    customShapePoints = null,
    reliefData = null,
    reliefHeight = 3,
    customSTLGeometry = null,
    lineColor1 = null,
    lineColor2 = null,
    lineColor3 = null,
    lockedPlateW = null,
    lockedPlateH = null
  } = params;

  // Custom STL replaces the entire plate+text pendant
  if (customSTLGeometry) {
    const group = new THREE.Group();
    group.name = 'pendant';

    const material = createMaterial(materialOpts.key || 'gold', materialOpts);
    const geo = customSTLGeometry.clone();
    geo.computeBoundingBox();
    geo.center();
    geo.computeVertexNormals();

    // Auto-orient: a pendant is flat with its face along XY and thickness along Z.
    // Detect which axis has the smallest extent and rotate that axis onto Z so
    // the pendant faces the camera / aligns with the chain plane.
    const orientBox = geo.boundingBox;
    const extentX = orientBox.max.x - orientBox.min.x;
    const extentY = orientBox.max.y - orientBox.min.y;
    const extentZ = orientBox.max.z - orientBox.min.z;
    const minExtent = Math.min(extentX, extentY, extentZ);
    if (minExtent === extentX) {
      // X is thinnest — rotate around Y to move X onto Z
      geo.rotateY(Math.PI / 2);
    } else if (minExtent === extentY) {
      // Y is thinnest — rotate around X to move Y onto Z
      geo.rotateX(Math.PI / 2);
    }
    // If Z is already thinnest, no rotation needed.
    geo.computeBoundingBox();
    geo.center();

    // Auto-resize: scale STL so largest dimension fits target pendant size
    const rawBox = geo.boundingBox;
    const rawW = rawBox.max.x - rawBox.min.x;
    const rawH = rawBox.max.y - rawBox.min.y;
    const rawD = rawBox.max.z - rawBox.min.z;
    const targetSize = 50; // target max dimension in mm (pendant-sized)
    const maxDim = Math.max(rawW, rawH, rawD);
    const scaleFactor = maxDim > 0 ? targetSize / maxDim : 1;
    geo.scale(scaleFactor, scaleFactor, scaleFactor);

    // Recompute bounds after scaling
    geo.computeBoundingBox();
    const box = geo.boundingBox;
    const stlW = box.max.x - box.min.x;
    const stlH = box.max.y - box.min.y;
    const stlD = box.max.z - box.min.z;

    // Align to chain plane: center Z like the plate does
    const stlMidZ = (box.max.z + box.min.z) / 2;

    const mesh = new THREE.Mesh(geo, material);
    group.add(mesh);

    // Anchor from top edge
    const topShift = stlH / 2;
    mesh.position.y -= topShift;

    if (chainInfo) {
      const { innerTopY, chainThickness } = chainInfo;
      const connGap = chainThickness * 0.3;
      const pendantCenterY = innerTopY - connGap;

      return {
        group,
        width: stlW,
        height: stlH,
        pendantCenterY,
        defaultZ: -stlMidZ
      };
    }

    return {
      group,
      width: stlW,
      height: stlH,
      pendantCenterY: 0,
      defaultZ: -stlMidZ
    };
  }

  // Build lines array: each line has text, font key, size, curve, offsets
  const lineColors = [lineColor1, lineColor2, lineColor3];
  const lines = [];
  if (text && text.trim().length > 0) {
    lines.push({
      text: text.trim(), fontKey, size: textSize, curve: textCurve,
      offsetX: textOffsetX, offsetY: textOffsetY,
      letterSpacing, extrudeDepth, bevelEnabled,
      alignToPlate, color: lineColor1
    });
  }
  if (secondLineText && secondLineText.trim().length > 0) {
    lines.push({
      text: secondLineText.trim(), fontKey: secondLineFont, size: secondLineSize, curve: secondLineCurve,
      offsetX: secondLineOffsetX, offsetY: secondLineOffsetY,
      letterSpacing: secondLineLetterSpacing, extrudeDepth: secondLineExtrudeDepth, bevelEnabled: secondLineBevelEnabled,
      alignToPlate: secondLineAlignToPlate, color: lineColor2
    });
  }
  if (thirdLineText && thirdLineText.trim().length > 0) {
    lines.push({
      text: thirdLineText.trim(), fontKey: thirdLineFont, size: thirdLineSize, curve: thirdLineCurve,
      offsetX: thirdLineOffsetX, offsetY: thirdLineOffsetY,
      letterSpacing: thirdLineLetterSpacing, extrudeDepth: thirdLineExtrudeDepth, bevelEnabled: thirdLineBevelEnabled,
      alignToPlate: thirdLineAlignToPlate, color: lineColor3
    });
  }

  const hasText = lines.length > 0;
  const hasImage = reliefData && reliefData.data;

  if (!hasText && !hasImage) return null;

  const group = new THREE.Group();
  group.name = 'pendant';

  const material = createMaterial(materialOpts.key || 'gold', materialOpts);

  let totalTextWidth = 0;
  let totalTextHeight = 0;
  let textGroup = null;
  const baseGapFactor = 0.3;
  const gapFactor = baseGapFactor * lineSpacing;
  const lineResults = [];

  if (hasText) {
    textGroup = new THREE.Group();

    // First pass: render each line. For alignToPlate lines, render flat (curve=0)
    // so we can accurately size the plate before computing the auto-curve.
    for (const line of lines) {
      const font = await loadFont(line.fontKey);
      const renderOpts = getTextRenderOpts(line.fontKey, line.size);
      const displayText = renderOpts.preserveCase ? line.text : line.text.toUpperCase();
      const effectiveCurve = line.alignToPlate ? 0 : line.curve;
      const usePerChar = line.letterSpacing !== 0 || effectiveCurve !== 0;
      // Per-line color: if set, create a custom material for this line
      const lineMat = line.color
        ? createMaterial(materialOpts.key || 'gold', { ...materialOpts, useCustomColor: true, customColor: line.color })
        : material;
      const result = usePerChar
        ? createCharacterMeshes(displayText, font, line.size, line.extrudeDepth, line.bevelEnabled, line.letterSpacing, effectiveCurve, lineMat, renderOpts)
        : createSingleTextMesh(displayText, font, line.size, line.extrudeDepth, line.bevelEnabled, lineMat.clone(), renderOpts);
      // Tag meshes with per-line color so updateMaterialOnGroup can skip them
      if (line.color) {
        result.group.traverse((child) => {
          if (child.isMesh) child.userData.hasLineColor = true;
        });
      }
      lineResults.push({
        ...result,
        lineSize: line.size,
        offsetX: line.offsetX,
        offsetY: line.offsetY,
        font,
        displayText,
        renderOpts
      });
    }

    // Measure total dimensions (using the flat first-pass geometry for plate sizing)
    for (let i = 0; i < lineResults.length; i++) {
      const lr = lineResults[i];
      totalTextWidth = Math.max(totalTextWidth, lr.width);
      totalTextHeight += lr.height;
      if (i > 0) totalTextHeight += lineResults[i - 1].lineSize * gapFactor;
    }
  }

  // Position text lines vertically (needed before plate creation for outline shape)
  if (hasText) {
    let cursorY = totalTextHeight / 2;
    for (let i = 0; i < lineResults.length; i++) {
      const lr = lineResults[i];
      if (i > 0) cursorY -= lineResults[i - 1].lineSize * gapFactor;
      cursorY -= lr.height / 2;
      lr.group.position.x = lr.offsetX;
      lr.group.position.y = cursorY + lr.offsetY;
      cursorY -= lr.height / 2;
      textGroup.add(lr.group);
    }
  }

  // Plate sizing: use locked dimensions if set, otherwise compute from text bounds
  const defaultImageSize = 60;
  const contentW = hasText ? totalTextWidth : defaultImageSize;
  const contentH = hasText ? totalTextHeight : defaultImageSize;
  const rawW = (lockedPlateW != null) ? lockedPlateW : contentW + platePadding * 2;
  const rawH = (lockedPlateH != null) ? lockedPlateH : contentH + platePadding * 2;

  let plateShape, plateW, plateH;
  if (pendantShape === 'outline' && hasText) {
    const outlineResult = computeTextOutlineShape(lineResults, platePadding);
    if (outlineResult) {
      plateShape = outlineResult.shape;
      plateW = outlineResult.w;
      plateH = outlineResult.h;
    } else {
      ({ shape: plateShape, w: plateW, h: plateH } = createPlateShape('rectangle', rawW, rawH, plateRadius, customShapePoints));
    }
  } else {
    ({ shape: plateShape, w: plateW, h: plateH } = createPlateShape(
      pendantShape || 'rectangle', rawW, rawH, plateRadius, customShapePoints
    ));
  }

  if (hasText) {
    // Second pass: re-render alignToPlate lines with curve matching the plate edge.
    // First line curves positive (frown/top), last line curves negative (smile/bottom).
    const hasAlignToPlate = lines.some(l => l.alignToPlate);
    if (hasAlignToPlate) {
      for (let i = 0; i < lines.length; i++) {
        if (!lines[i].alignToPlate) continue;

        let sign = 0;
        if (lines.length > 1) {
          if (i === 0) sign = 1;
          else if (i === lines.length - 1) sign = -1;
        } else {
          sign = lines[i].curve < 0 ? -1 : 1;
        }
        if (sign === 0) continue;

        // Curve radius = distance from plate center to text edge, clamped
        // so the arc angle per side doesn't exceed ~45 degrees
        const targetRadius = plateH / 2 - platePadding;
        const maxAngle = Math.PI / 4;
        const halfTextW = lineResults[i].width / 2;
        const minRadius = halfTextW / maxAngle;
        const effectiveRadius = Math.max(targetRadius, minRadius, 10);
        const computedCurve = 300 / effectiveRadius;
        const curveValue = sign * computedCurve;
        const line = lines[i];
        const lr = lineResults[i];

        // Remove old group from scene and dispose its meshes
        textGroup.remove(lr.group);
        lr.group.traverse((child) => {
          if (child.isMesh) {
            child.geometry.dispose();
            child.material.dispose();
          }
        });

        const reLineMat = line.color
          ? createMaterial(materialOpts.key || 'gold', { ...materialOpts, useCustomColor: true, customColor: line.color })
          : material;
        const newResult = createCharacterMeshes(
          lr.displayText, lr.font, line.size, line.extrudeDepth, line.bevelEnabled,
          line.letterSpacing, curveValue, reLineMat, lr.renderOpts
        );
        if (line.color) {
          newResult.group.traverse((child) => {
            if (child.isMesh) child.userData.hasLineColor = true;
          });
        }

        textGroup.add(newResult.group);

        lineResults[i] = {
          group: newResult.group,
          width: newResult.width,
          height: newResult.height,
          lineSize: line.size,
          offsetX: line.offsetX,
          offsetY: line.offsetY,
          font: lr.font,
          displayText: lr.displayText,
          renderOpts: lr.renderOpts,
          alignSign: sign
        };
      }

      // Recompute total height with the new (curved) line heights
      totalTextHeight = 0;
      for (let i = 0; i < lineResults.length; i++) {
        totalTextHeight += lineResults[i].height;
        if (i > 0) totalTextHeight += lineResults[i - 1].lineSize * gapFactor;
      }
    }

    // Re-position lines after alignToPlate second pass (heights may have changed)
    {
      let cursorY = totalTextHeight / 2;
      for (let i = 0; i < lineResults.length; i++) {
        const lr = lineResults[i];
        if (i > 0) cursorY -= lineResults[i - 1].lineSize * gapFactor;
        cursorY -= lr.height / 2;
        lr.group.position.x = lr.offsetX;
        lr.group.position.y = cursorY + lr.offsetY;
        cursorY -= lr.height / 2;
      }
    }

    // Override Y position for alignToPlate lines to sit at the actual plate edge
    for (let i = 0; i < lineResults.length; i++) {
      const lr = lineResults[i];
      if (!lr.alignSign) continue;

      const box = new THREE.Box3().setFromObject(lr.group);
      if (lr.alignSign > 0) {
        lr.group.position.y += (plateH / 2 - platePadding) - box.max.y;
      } else {
        lr.group.position.y += (-plateH / 2 + platePadding) - box.min.y;
      }
    }

    // Position each line on the plate surface, accounting for its own extrude depth.
    // This lets each line have a different depth without the whole group riding on
    // a single Z offset (which would recess short-depth lines too far).
    const plateFrontZ = plateThickness - 0.5;
    for (let i = 0; i < lineResults.length; i++) {
      const lr = lineResults[i];
      const lineDepth = lines[i].extrudeDepth;
      if (engrave) {
        lr.group.position.z = plateFrontZ + 0.3 - lineDepth;
      } else {
        lr.group.position.z = plateFrontZ;
      }
    }
    if (engrave) {
      textGroup.traverse((child) => {
        if (child.isMesh) {
          child.material = child.material.clone();
          child.material.color.multiplyScalar(0.6);
        }
      });
    }

    // Apply text alignment
    let textAlignOffset = 0;
    if (textAlignment === 'left') {
      textAlignOffset = -(plateW / 2 - platePadding - totalTextWidth / 2);
    } else if (textAlignment === 'right') {
      textAlignOffset = (plateW / 2 - platePadding - totalTextWidth / 2);
    }
    textGroup.position.x = textAlignOffset;
  }

  const plateGeo = new THREE.ExtrudeGeometry(plateShape, {
    depth: plateThickness,
    bevelEnabled: true,
    bevelThickness: 1.5,
    bevelSize: 1.5,
    bevelSegments: 5
  });
  plateGeo.translate(0, 0, -0.5);

  const plateMesh = new THREE.Mesh(plateGeo, material.clone());
  plateMesh.material.roughness = (materialOpts.matteFinish ? 0.7 : (MATERIALS[materialOpts.key]?.roughness || 0.25)) + 0.1;

  group.add(plateMesh);
  if (textGroup) group.add(textGroup);

  // Border / frame — full plate depth, flush at back, raised on front
  if (borderWidth > 0) {
    const borderOuter = createPlateShape(
      pendantShape || 'rectangle',
      rawW + borderWidth * 2,
      rawH + borderWidth * 2,
      plateRadius + borderWidth,
      customShapePoints
    );

    const holePath = new THREE.Path();
    const platePoints = plateShape.getPoints(48);
    holePath.setFromPoints(platePoints);
    borderOuter.shape.holes.push(holePath);

    const borderProtrusion = 2;
    const borderGeo = new THREE.ExtrudeGeometry(borderOuter.shape, {
      depth: plateThickness + borderProtrusion,
      bevelEnabled: true,
      bevelThickness: 0.5,
      bevelSize: 0.5,
      bevelSegments: 2
    });
    borderGeo.translate(0, 0, -0.5);

    // Clamp back bevel flush with plate back (z = -0.5)
    const bpos = borderGeo.attributes.position;
    for (let i = 0; i < bpos.count; i++) {
      if (bpos.getZ(i) < -0.5) bpos.setZ(i, -0.5);
    }
    bpos.needsUpdate = true;
    borderGeo.computeVertexNormals();

    const borderMesh = new THREE.Mesh(borderGeo, material.clone());
    group.add(borderMesh);
  }

  // Relief / heightmap overlay
  if (reliefData && reliefData.data) {
    const resW = reliefData.width;
    const resH = reliefData.height;
    const planeGeo = new THREE.PlaneGeometry(plateW, plateH, resW - 1, resH - 1);
    const pos = planeGeo.attributes.position;

    for (let iy = 0; iy < resH; iy++) {
      for (let ix = 0; ix < resW; ix++) {
        const vertIdx = iy * resW + ix;
        // Heightmap data is top-to-bottom, plane vertices are bottom-to-top
        const dataIdx = (resH - 1 - iy) * resW + ix;
        const h = reliefData.data[dataIdx] * reliefHeight;
        pos.setZ(vertIdx, h);
      }
    }

    planeGeo.computeVertexNormals();

    const reliefMesh = new THREE.Mesh(planeGeo, material.clone());
    // Position on plate front surface
    reliefMesh.position.z = plateThickness - 0.5;
    group.add(reliefMesh);
  }

  // Anchor pendant from top edge: shift all children so group origin = top center.
  // Account for border extending above the plate.
  const topShift = plateH / 2 + (borderWidth > 0 ? borderWidth : 0);
  group.children.forEach(child => {
    child.position.y -= topShift;
  });

  if (chainInfo) {
    const { innerTopY, bailHeight = 10 } = chainInfo;

    const pendantCenterY = innerTopY + bailHeight / 2;

    const frontZ = borderWidth > 0 ? plateThickness - 0.5 + 2 : plateThickness - 0.5;
    const backZ = -0.5;
    const defaultZ = -(frontZ + backZ) / 2;

    return {
      group,
      width: plateW,
      height: plateH,
      rawW,
      rawH,
      pendantCenterY,
      defaultZ
    };
  }

  return {
    group,
    width: plateW,
    height: plateH,
    rawW,
    rawH,
    pendantCenterY: 0,
    defaultZ: 0
  };
}

export function updateMaterialOnGroup(group, materialOpts) {
  if (!group) return;
  const mat = createMaterial(materialOpts.key || 'gold', materialOpts);
  group.traverse((child) => {
    if (child.isMesh) {
      // Skip meshes with per-line custom colors — they keep their own color
      if (child.userData.hasLineColor) return;
      child.material.color.copy(mat.color);
      child.material.metalness = mat.metalness;
      child.material.roughness = mat.roughness;
      child.material.envMapIntensity = mat.envMapIntensity;
      child.material.needsUpdate = true;
    }
  });
}
