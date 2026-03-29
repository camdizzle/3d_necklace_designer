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

function createPlateShape(shapeType, width, height, radius) {
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
      // Point at bottom, lobes at top
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

export async function generatePendant(params, materialKey = 'gold', chainInfo = null) {
  const {
    text,
    font: fontKey,
    textSize,
    extrudeDepth,
    bevelEnabled,
    platePadding,
    plateRadius,
    plateThickness,
    pendantShape
  } = params;

  if (!text || text.trim().length === 0) return null;

  const font = await loadFont(fontKey);
  const group = new THREE.Group();
  group.name = 'pendant';

  const mat = MATERIALS[materialKey];
  const material = new THREE.MeshStandardMaterial({
    color: mat.color,
    metalness: mat.metalness,
    roughness: mat.roughness,
    envMapIntensity: mat.envMapIntensity
  });

  // Create text geometry
  const textGeo = new TextGeometry(text.toUpperCase(), {
    font: font,
    size: textSize,
    depth: extrudeDepth,
    curveSegments: 6,
    bevelEnabled: bevelEnabled,
    bevelThickness: bevelEnabled ? 1.5 : 0,
    bevelSize: bevelEnabled ? 1 : 0,
    bevelSegments: bevelEnabled ? 3 : 0
  });

  textGeo.computeBoundingBox();
  const textBox = textGeo.boundingBox;
  const textWidth = textBox.max.x - textBox.min.x;
  const textHeight = textBox.max.y - textBox.min.y;

  // Center the text geometry
  textGeo.translate(
    -(textBox.min.x + textWidth / 2),
    -(textBox.min.y + textHeight / 2),
    0
  );

  const textMesh = new THREE.Mesh(textGeo, material);
  // Place text flush on the plate surface (plate front face is at z = plateThickness - 0.5)
  textMesh.position.z = plateThickness - 0.5;

  // Create backing plate with selected shape
  const rawW = textWidth + platePadding * 2;
  const rawH = textHeight + platePadding * 2;
  const { shape: plateShape, w: plateW, h: plateH } = createPlateShape(
    pendantShape || 'rectangle', rawW, rawH, plateRadius
  );

  const plateGeo = new THREE.ExtrudeGeometry(plateShape, {
    depth: plateThickness,
    bevelEnabled: true,
    bevelThickness: 0.5,
    bevelSize: 0.5,
    bevelSegments: 2
  });
  plateGeo.translate(0, 0, -0.5);

  const plateMesh = new THREE.Mesh(plateGeo, material.clone());
  plateMesh.material.roughness = mat.roughness + 0.1;

  group.add(plateMesh);
  group.add(textMesh);

  const pendantTop = plateH / 2;

  if (chainInfo) {
    const { innerTopY, chainThickness } = chainInfo;

    // Print-in-place interlocking loops connector.
    // Two torus rings interlock with clearance so they can pivot after printing.
    const clearance = 0.3; // mm gap for print-in-place separation
    const loopRadius = chainThickness * 0.35; // major radius of each ring
    const tubeRadius = chainThickness * 0.12; // tube thickness of each ring
    const loopSpacing = clearance; // gap between pendant and chain attachment

    // Position pendant so loops fit between plate top and chain inner edge
    const totalConnHeight = loopRadius * 2 + loopSpacing;
    const pendantCenterY = innerTopY - pendantTop - totalConnHeight;

    // Plate Z range: back at -0.5, front at plateThickness-0.5
    const plateMidZ = (plateThickness - 0.5 + (-0.5)) / 2;

    // Bottom loop: attached to pendant plate top, sits above bevel
    const bevelClear = 1.0; // clear the plate bevel
    const bottomLoopY = pendantTop + bevelClear + loopRadius;
    // Torus lies in XY plane by default; we want it in XZ plane so it hangs like a ring
    const bottomLoopGeo = new THREE.TorusGeometry(loopRadius, tubeRadius, 12, 24);
    bottomLoopGeo.rotateX(Math.PI / 2); // rotate to hang vertically in XZ
    bottomLoopGeo.translate(0, bottomLoopY, plateMidZ);
    const bottomLoopMesh = new THREE.Mesh(bottomLoopGeo, material.clone());
    group.add(bottomLoopMesh);

    // Small vertical tab connecting plate top to the bottom loop
    const tabHeight = bevelClear + loopRadius - tubeRadius;
    if (tabHeight > 0) {
      const tabWidth = tubeRadius * 2.5;
      const tabDepth = tubeRadius * 2.5;
      const tabGeo = new THREE.BoxGeometry(tabWidth, tabHeight, tabDepth);
      tabGeo.translate(0, pendantTop + tabHeight / 2, plateMidZ);
      const tabMesh = new THREE.Mesh(tabGeo, material.clone());
      group.add(tabMesh);
    }

    // Top loop: interlocks with bottom loop, connects up to chain
    // Offset in Z so it passes through the bottom loop
    const topLoopY = bottomLoopY + loopRadius + clearance + loopRadius;
    const topLoopGeo = new THREE.TorusGeometry(loopRadius, tubeRadius, 12, 24);
    // This loop hangs in YZ plane (perpendicular to the bottom loop) so they interlock
    topLoopGeo.rotateY(Math.PI / 2);
    topLoopGeo.translate(0, topLoopY, plateMidZ);
    const topLoopMesh = new THREE.Mesh(topLoopGeo, material.clone());
    group.add(topLoopMesh);

    // Small vertical tab from top loop up toward chain inner edge
    const topTabBottom = topLoopY + loopRadius - tubeRadius;
    const topTabTop = innerTopY - pendantCenterY;
    const topTabHeight = topTabTop - topTabBottom;
    if (topTabHeight > 0) {
      const topTabWidth = tubeRadius * 2.5;
      const topTabDepth = tubeRadius * 2.5;
      const topTabGeo = new THREE.BoxGeometry(topTabWidth, topTabHeight, topTabDepth);
      topTabGeo.translate(0, topTabBottom + topTabHeight / 2, plateMidZ);
      const topTabMesh = new THREE.Mesh(topTabGeo, material.clone());
      group.add(topTabMesh);
    }

    // Compute default Z to align plate center with chain center (Z=0)
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

export function updatePendantMaterial(group, materialKey) {
  if (!group) return;
  const mat = MATERIALS[materialKey];
  group.traverse((child) => {
    if (child.isMesh) {
      child.material.color.setHex(mat.color);
      child.material.metalness = mat.metalness;
      child.material.roughness = mat.roughness;
      child.material.envMapIntensity = mat.envMapIntensity;
      child.material.needsUpdate = true;
    }
  });
}
