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

function getTextRenderOpts(fontKey) {
  if (isScriptFont(fontKey)) {
    return {
      curveSegments: 12,
      bevelThickness: 0.4,
      bevelSize: 0.25,
      bevelSegments: 2,
      preserveCase: true
    };
  }
  return {
    curveSegments: 6,
    bevelThickness: 1.5,
    bevelSize: 1,
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
    thirdLineText = '',
    thirdLineFont = 'helvetiker_bold',
    thirdLineSize = 14,
    thirdLineCurve = 0,
    thirdLineOffsetX = 0,
    thirdLineOffsetY = 0,
    thirdLineLetterSpacing = 0,
    thirdLineExtrudeDepth = 8,
    thirdLineBevelEnabled = true,
    engrave = false,
    borderWidth = 0,
    customShapePoints = null,
    reliefData = null,
    reliefHeight = 3,
    customSTLGeometry = null
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

    const pendantTop = stlH / 2;

    if (chainInfo) {
      const { innerTopY, chainThickness } = chainInfo;
      const bevelClear = 1.0;
      const connGap = chainThickness * 0.3;
      const pendantCenterY = innerTopY - pendantTop - connGap;

      const connLocalBottom = pendantTop + bevelClear;
      const connLocalTop = innerTopY - pendantCenterY;
      const connHeight = connLocalTop - connLocalBottom;

      if (connHeight > 0) {
        const connWidth = chainThickness * 0.5;
        const connDepth = stlD + 1;
        const connGeo = new THREE.BoxGeometry(connWidth, connHeight, connDepth);
        connGeo.translate(0, connLocalBottom + connHeight / 2, stlMidZ);
        const connMesh = new THREE.Mesh(connGeo, material.clone());
        group.add(connMesh);
      }

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
  const lines = [];
  if (text && text.trim().length > 0) {
    lines.push({
      text: text.trim(), fontKey, size: textSize, curve: textCurve,
      offsetX: textOffsetX, offsetY: textOffsetY,
      letterSpacing, extrudeDepth, bevelEnabled
    });
  }
  if (secondLineText && secondLineText.trim().length > 0) {
    lines.push({
      text: secondLineText.trim(), fontKey: secondLineFont, size: secondLineSize, curve: secondLineCurve,
      offsetX: secondLineOffsetX, offsetY: secondLineOffsetY,
      letterSpacing: secondLineLetterSpacing, extrudeDepth: secondLineExtrudeDepth, bevelEnabled: secondLineBevelEnabled
    });
  }
  if (thirdLineText && thirdLineText.trim().length > 0) {
    lines.push({
      text: thirdLineText.trim(), fontKey: thirdLineFont, size: thirdLineSize, curve: thirdLineCurve,
      offsetX: thirdLineOffsetX, offsetY: thirdLineOffsetY,
      letterSpacing: thirdLineLetterSpacing, extrudeDepth: thirdLineExtrudeDepth, bevelEnabled: thirdLineBevelEnabled
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

  if (hasText) {
    textGroup = new THREE.Group();

    // Render each line and measure
    const lineResults = [];
    for (const line of lines) {
      const font = await loadFont(line.fontKey);
      const renderOpts = getTextRenderOpts(line.fontKey);
      const displayText = renderOpts.preserveCase ? line.text : line.text.toUpperCase();
      const usePerChar = line.letterSpacing !== 0 || line.curve !== 0;
      const result = usePerChar
        ? createCharacterMeshes(displayText, font, line.size, line.extrudeDepth, line.bevelEnabled, line.letterSpacing, line.curve, material, renderOpts)
        : createSingleTextMesh(displayText, font, line.size, line.extrudeDepth, line.bevelEnabled, material.clone(), renderOpts);
      lineResults.push({ ...result, lineSize: line.size, offsetX: line.offsetX, offsetY: line.offsetY });
    }

    // Compute total dimensions and position each line
    // lineSpacing: 1.0 = default gap (0.3 * preceding line size), scale from there
    const baseGapFactor = 0.3;
    const gapFactor = baseGapFactor * lineSpacing;
    let totalH = 0;
    for (let i = 0; i < lineResults.length; i++) {
      const lr = lineResults[i];
      totalTextWidth = Math.max(totalTextWidth, lr.width);
      totalH += lr.height;
      if (i > 0) totalH += lineResults[i - 1].lineSize * gapFactor;
    }
    totalTextHeight = totalH;

    // Position lines top-to-bottom, centered vertically
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

    // Position each line on the plate surface, accounting for its own extrude depth.
    // This lets each line have a different depth without the whole group riding on
    // a single Z offset (which would recess short-depth lines too far).
    const plateFrontZ = plateThickness - 0.5;
    for (let i = 0; i < lineResults.length; i++) {
      const lr = lineResults[i];
      const lineDepth = lines[i].extrudeDepth;
      if (engrave) {
        // Recess line so its front face is 0.3 above the plate surface.
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
  }

  // Plate sizing: use text bounds if available, otherwise default size for image-only
  const defaultImageSize = 60;
  const contentW = hasText ? totalTextWidth : defaultImageSize;
  const contentH = hasText ? totalTextHeight : defaultImageSize;
  const rawW = contentW + platePadding * 2;
  const rawH = contentH + platePadding * 2;
  const { shape: plateShape, w: plateW, h: plateH } = createPlateShape(
    pendantShape || 'rectangle', rawW, rawH, plateRadius, customShapePoints
  );

  // Apply text alignment
  if (hasText) {
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
    bevelThickness: 0.5,
    bevelSize: 0.5,
    bevelSegments: 2
  });
  plateGeo.translate(0, 0, -0.5);

  const plateMesh = new THREE.Mesh(plateGeo, material.clone());
  plateMesh.material.roughness = (materialOpts.matteFinish ? 0.7 : (MATERIALS[materialOpts.key]?.roughness || 0.25)) + 0.1;

  group.add(plateMesh);
  if (textGroup) group.add(textGroup);

  // Border / frame
  if (borderWidth > 0) {
    const borderOuter = createPlateShape(
      pendantShape || 'rectangle',
      rawW + borderWidth * 2,
      rawH + borderWidth * 2,
      plateRadius + borderWidth,
      customShapePoints
    );

    // Create the inner hole from the plate shape
    const holePath = new THREE.Path();
    const platePoints = plateShape.getPoints(48);
    holePath.setFromPoints(platePoints);
    borderOuter.shape.holes.push(holePath);

    const borderGeo = new THREE.ExtrudeGeometry(borderOuter.shape, {
      depth: plateThickness + 1,
      bevelEnabled: true,
      bevelThickness: 0.3,
      bevelSize: 0.3,
      bevelSegments: 1
    });
    borderGeo.translate(0, 0, -0.5);

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

  const pendantTop = plateH / 2;

  if (chainInfo) {
    const { innerTopY, chainThickness } = chainInfo;

    // Clean connector bar from plate top to chain inner edge.
    // Offset above bevel to prevent plate artifact.
    const bevelClear = 1.0;
    const connGap = chainThickness * 0.3;
    const pendantCenterY = innerTopY - pendantTop - connGap;

    // Plate Z range: back at -0.5, front at plateThickness-0.5
    const plateMidZ = (plateThickness - 0.5 + (-0.5)) / 2;

    // Connector from above plate bevel to chain inner edge
    const connLocalBottom = pendantTop + bevelClear;
    const connLocalTop = innerTopY - pendantCenterY;
    const connHeight = connLocalTop - connLocalBottom;

    if (connHeight > 0) {
      const connWidth = chainThickness * 0.5;
      const connDepth = plateThickness + 1;
      const connGeo = new THREE.BoxGeometry(connWidth, connHeight, connDepth);
      connGeo.translate(0, connLocalBottom + connHeight / 2, plateMidZ);
      const connMesh = new THREE.Mesh(connGeo, material.clone());
      group.add(connMesh);
    }

    const defaultZ = -plateMidZ;

    return {
      group,
      width: plateW,
      height: plateH,
      pendantCenterY,
      defaultZ
    };
  }

  return {
    group,
    width: plateW,
    height: plateH,
    pendantCenterY: 0,
    defaultZ: 0
  };
}

export function updateMaterialOnGroup(group, materialOpts) {
  if (!group) return;
  const mat = createMaterial(materialOpts.key || 'gold', materialOpts);
  group.traverse((child) => {
    if (child.isMesh) {
      child.material.color.copy(mat.color);
      child.material.metalness = mat.metalness;
      child.material.roughness = mat.roughness;
      child.material.envMapIntensity = mat.envMapIntensity;
      child.material.needsUpdate = true;
    }
  });
}
