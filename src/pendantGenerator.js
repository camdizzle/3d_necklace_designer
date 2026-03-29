import * as THREE from 'three';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { FONTS, MATERIALS } from './constants.js';

const fontCache = {};

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
function createCharacterMeshes(text, font, textSize, extrudeDepth, bevelEnabled, letterSpacing, textCurve, material) {
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
      curveSegments: 6,
      bevelEnabled,
      bevelThickness: bevelEnabled ? 1.5 : 0,
      bevelSize: bevelEnabled ? 1 : 0,
      bevelSegments: bevelEnabled ? 3 : 0
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
function createSingleTextMesh(text, font, textSize, extrudeDepth, bevelEnabled, material) {
  const geo = new TextGeometry(text, {
    font,
    size: textSize,
    depth: extrudeDepth,
    curveSegments: 6,
    bevelEnabled,
    bevelThickness: bevelEnabled ? 1.5 : 0,
    bevelSize: bevelEnabled ? 1 : 0,
    bevelSegments: bevelEnabled ? 3 : 0
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
    extrudeDepth,
    bevelEnabled,
    platePadding,
    plateRadius,
    plateThickness,
    pendantShape,
    letterSpacing = 0,
    textAlignment = 'center',
    textCurve = 0,
    secondLineText = '',
    secondLineSize = 16,
    engrave = false,
    borderWidth = 0,
    customShapePoints = null
  } = params;

  if (!text || text.trim().length === 0) return null;

  const font = await loadFont(fontKey);
  const group = new THREE.Group();
  group.name = 'pendant';

  const material = createMaterial(materialOpts.key || 'gold', materialOpts);

  // Create primary text
  const usePerChar = letterSpacing !== 0 || textCurve !== 0;
  const textResult = usePerChar
    ? createCharacterMeshes(text.toUpperCase(), font, textSize, extrudeDepth, bevelEnabled, letterSpacing, textCurve, material)
    : createSingleTextMesh(text.toUpperCase(), font, textSize, extrudeDepth, bevelEnabled, material.clone());

  const textGroup = textResult.group;
  let totalTextWidth = textResult.width;
  let totalTextHeight = textResult.height;

  // Create second line if provided
  let secondLineResult = null;
  if (secondLineText && secondLineText.trim().length > 0) {
    const sl = usePerChar
      ? createCharacterMeshes(secondLineText.toUpperCase(), font, secondLineSize, extrudeDepth, bevelEnabled, letterSpacing, textCurve, material)
      : createSingleTextMesh(secondLineText.toUpperCase(), font, secondLineSize, extrudeDepth, bevelEnabled, material.clone());

    // Position second line below first
    const gap = textSize * 0.3;
    sl.group.position.y = -(totalTextHeight / 2 + gap + sl.height / 2);
    textGroup.add(sl.group);

    totalTextWidth = Math.max(totalTextWidth, sl.width);
    totalTextHeight += gap + sl.height;
    secondLineResult = sl;
  }

  // Position text on plate surface
  const plateFrontZ = plateThickness - 0.5;
  if (engrave) {
    // Engrave: push text slightly into plate surface
    textGroup.position.z = plateFrontZ - extrudeDepth + 0.3;
    // Darken the engraved text slightly for visual distinction
    textGroup.traverse((child) => {
      if (child.isMesh) {
        child.material = child.material.clone();
        child.material.color.multiplyScalar(0.6);
      }
    });
  } else {
    textGroup.position.z = plateFrontZ;
  }

  // Apply text alignment offset (applied after plate is created)
  let textAlignOffset = 0;

  // Create backing plate with selected shape
  const rawW = totalTextWidth + platePadding * 2;
  const rawH = totalTextHeight + platePadding * 2;
  const { shape: plateShape, w: plateW, h: plateH } = createPlateShape(
    pendantShape || 'rectangle', rawW, rawH, plateRadius, customShapePoints
  );

  // Apply text alignment
  if (textAlignment === 'left') {
    textAlignOffset = -(plateW / 2 - platePadding - totalTextWidth / 2);
  } else if (textAlignment === 'right') {
    textAlignOffset = (plateW / 2 - platePadding - totalTextWidth / 2);
  }
  textGroup.position.x = textAlignOffset;

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
  group.add(textGroup);

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
