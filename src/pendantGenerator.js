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

    // Connector bar goes directly from the plate top edge to the chain inner edge.
    // No bail loop — the connector IS the attachment piece.
    // Match the plate thickness so it sits flush.
    const connWidth = chainThickness * 0.6;
    const connDepth = plateThickness + 1;
    const connGap = chainThickness * 0.3;

    // Position pendant so a short connector reaches the chain
    const pendantCenterY = innerTopY - pendantTop - connGap;

    // Connector from plate top to chain inner edge
    const connLocalBottom = pendantTop;
    const connLocalTop = innerTopY - pendantCenterY;
    const connHeight = connLocalTop - connLocalBottom;

    if (connHeight > 0) {
      // Align connector Z with the plate: plate front is at plateThickness-0.5,
      // plate back is at -0.5. Center the connector depth within the plate range.
      const plateMidZ = (plateThickness - 0.5 + (-0.5)) / 2;
      const connGeo = new THREE.BoxGeometry(connWidth, connHeight, connDepth);
      connGeo.translate(0, connLocalBottom + connHeight / 2, plateMidZ);
      const connMesh = new THREE.Mesh(connGeo, material.clone());
      group.add(connMesh);
    }

    // Compute default Z to align plate center with chain center (Z=0)
    const plateMidZ = (plateThickness - 0.5 + (-0.5)) / 2;
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
