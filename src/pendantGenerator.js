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

function createChainLink(center, radius, tubeRadius, rotationAxis, rotationAngle) {
  // Create a torus (chain link) at the given position
  const geo = new THREE.TorusGeometry(radius, tubeRadius, 8, 24);
  if (rotationAxis && rotationAngle !== undefined) {
    geo.rotateX(rotationAxis === 'x' ? rotationAngle : 0);
    geo.rotateY(rotationAxis === 'y' ? rotationAngle : 0);
    geo.rotateZ(rotationAxis === 'z' ? rotationAngle : 0);
  }
  geo.translate(center.x, center.y, center.z);
  return geo;
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

  if (chainInfo) {
    const { tipLeft, tipRight, chainThickness } = chainInfo;

    // The chain tips are in world space. Position the pendant so its top
    // is directly below the midpoint of the two tips, with a small gap.
    const midX = (tipLeft.x + tipRight.x) / 2;
    const tipY = Math.min(tipLeft.y, tipRight.y);

    // Chain link dimensions based on chain thickness
    const linkRadius = Math.max(chainThickness * 1.2, 5);
    const linkTube = Math.max(chainThickness * 0.3, 1.5);

    // Position pendant center so its top edge is just below the tips
    // with room for one connecting link
    const pendantCenterY = tipY - linkRadius * 2 - pendantTop;

    // Create a bail (horizontal torus) at the top of the pendant
    const bailRadius = Math.min(plateW * 0.12, linkRadius * 1.2);
    const bailTube = linkTube;
    const bailY = pendantTop + bailRadius * 0.3;
    const bailGeo = new THREE.TorusGeometry(bailRadius, bailTube, 8, 24);
    bailGeo.translate(0, bailY, chainThickness / 2);
    const bailMesh = new THREE.Mesh(bailGeo, material.clone());
    group.add(bailMesh);

    // Create chain link connectors from each tip to the bail
    // These are small torus links that interlock, like real chain links
    // Left connecting link — vertical torus at the left tip position, relative to pendant group
    const leftLinkX = tipLeft.x - midX;
    const leftLinkY = tipLeft.y - pendantCenterY;
    const leftLinkGeo = createChainLink(
      new THREE.Vector3(leftLinkX, leftLinkY, chainThickness / 2),
      linkRadius, linkTube, 'y', Math.PI / 2
    );
    const leftLink = new THREE.Mesh(leftLinkGeo, material.clone());
    group.add(leftLink);

    // Intermediate link between left tip link and bail — rotated 90° to interlock
    const leftMidY = (leftLinkY + bailY) / 2;
    const leftMidX = leftLinkX / 2;
    const leftMidGeo = createChainLink(
      new THREE.Vector3(leftMidX, leftMidY, chainThickness / 2),
      linkRadius, linkTube, 'x', Math.PI / 2
    );
    const leftMid = new THREE.Mesh(leftMidGeo, material.clone());
    group.add(leftMid);

    // Right connecting link
    const rightLinkX = tipRight.x - midX;
    const rightLinkY = tipRight.y - pendantCenterY;
    const rightLinkGeo = createChainLink(
      new THREE.Vector3(rightLinkX, rightLinkY, chainThickness / 2),
      linkRadius, linkTube, 'y', Math.PI / 2
    );
    const rightLink = new THREE.Mesh(rightLinkGeo, material.clone());
    group.add(rightLink);

    // Intermediate link between right tip link and bail
    const rightMidY = (rightLinkY + bailY) / 2;
    const rightMidX = rightLinkX / 2;
    const rightMidGeo = createChainLink(
      new THREE.Vector3(rightMidX, rightMidY, chainThickness / 2),
      linkRadius, linkTube, 'x', Math.PI / 2
    );
    const rightMid = new THREE.Mesh(rightMidGeo, material.clone());
    group.add(rightMid);

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
