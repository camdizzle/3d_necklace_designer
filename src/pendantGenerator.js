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

function createRoundedRectShape(width, height, radius) {
  const shape = new THREE.Shape();
  const r = Math.min(radius, width / 2, height / 2);
  const x = -width / 2;
  const y = -height / 2;

  shape.moveTo(x + r, y);
  shape.lineTo(x + width - r, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + r);
  shape.lineTo(x + width, y + height - r);
  shape.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  shape.lineTo(x + r, y + height);
  shape.quadraticCurveTo(x, y + height, x, y + height - r);
  shape.lineTo(x, y + r);
  shape.quadraticCurveTo(x, y, x + r, y);

  return shape;
}

function createConnectorBar(start, end, width, depth) {
  const dir = new THREE.Vector3().subVectors(end, start);
  const length = dir.length();
  const midpoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);

  // Create a box for the connector
  const barGeo = new THREE.BoxGeometry(width, length, depth);

  // Rotate to align with the direction
  const angle = Math.atan2(dir.x, dir.y);
  barGeo.rotateZ(-angle);

  // Position at midpoint
  barGeo.translate(midpoint.x, midpoint.y, midpoint.z);

  return barGeo;
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
    plateThickness
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
  textMesh.position.z = plateThickness;

  // Create backing plate
  const plateW = textWidth + platePadding * 2;
  const plateH = textHeight + platePadding * 2;
  const plateShape = createRoundedRectShape(plateW, plateH, plateRadius);
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

  // Determine pendant dimensions for positioning
  const pendantTop = plateH / 2;
  const pendantAttachLeft = new THREE.Vector3(-plateW / 2, pendantTop, extrudeDepth / 2);
  const pendantAttachRight = new THREE.Vector3(plateW / 2, pendantTop, extrudeDepth / 2);

  // If chain info provided, create connector bars from chain tips to pendant
  if (chainInfo) {
    const { tipLeft, tipRight, chainThickness } = chainInfo;
    const barWidth = Math.max(chainThickness, 6);
    const barDepth = chainThickness;

    // Connectors go from chain tips down to pendant top corners
    // These positions are in world space — we need them relative to the group
    // The group will be positioned so the pendant center is between the tips
    const pendantCenterY = (tipLeft.y + tipRight.y) / 2 - pendantTop - barWidth * 1.5;

    // Left connector: from tipLeft to pendant top-left
    const leftStart = new THREE.Vector3(tipLeft.x, tipLeft.y - pendantCenterY, tipLeft.z);
    const leftEnd = new THREE.Vector3(-plateW / 2, pendantTop, tipLeft.z);
    const leftBarGeo = createConnectorBar(leftStart, leftEnd, barWidth, barDepth);
    const leftBar = new THREE.Mesh(leftBarGeo, material.clone());
    group.add(leftBar);

    // Right connector: from tipRight to pendant top-right
    const rightStart = new THREE.Vector3(tipRight.x, tipRight.y - pendantCenterY, tipRight.z);
    const rightEnd = new THREE.Vector3(plateW / 2, pendantTop, tipRight.z);
    const rightBarGeo = createConnectorBar(rightStart, rightEnd, barWidth, barDepth);
    const rightBar = new THREE.Mesh(rightBarGeo, material.clone());
    group.add(rightBar);

    return {
      group,
      width: plateW,
      height: plateH,
      pendantCenterY,
      tipLeft,
      tipRight
    };
  }

  // Fallback: standalone bail if no chain info
  const bailRadius = Math.min(plateW * 0.08, 6);
  const bailTubeRadius = bailRadius * 0.4;
  const bailGeo = new THREE.TorusGeometry(bailRadius, bailTubeRadius, 8, 16);
  const bailMesh = new THREE.Mesh(bailGeo, material.clone());
  bailMesh.position.y = plateH / 2 + bailRadius * 0.6;
  bailMesh.position.z = plateThickness / 2;
  group.add(bailMesh);

  return {
    group,
    width: plateW,
    height: plateH + bailRadius * 2,
    pendantCenterY: 0,
    tipLeft: null,
    tipRight: null
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
