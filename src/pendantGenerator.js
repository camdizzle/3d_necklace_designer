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

    // Attach to whichever chain tip hangs lowest
    const attachTip = tipLeft.y < tipRight.y ? tipLeft : tipRight;

    // Bail loop at the top of the pendant, sized to interlock with chain links.
    // Rotated 90° around X so it sits in the XZ plane (perpendicular to the
    // flat chain links in XY), creating an interlocking connection.
    const bailRadius = chainThickness * 1.4;
    const bailTube = chainThickness * 0.3;

    // Bail sits just above the plate's top edge (in local coords before flip)
    const bailLocalY = pendantTop + bailRadius * 0.6;

    // Create bail torus in XZ plane
    const bailGeo = new THREE.TorusGeometry(bailRadius, bailTube, 12, 24);
    bailGeo.rotateX(Math.PI / 2);
    bailGeo.translate(0, bailLocalY, 0);
    const bailMesh = new THREE.Mesh(bailGeo, material.clone());
    group.add(bailMesh);

    // Flip the entire pendant 180° so it sits upside-down inside the chain loop.
    // The bail (originally at top) moves to the bottom and connects to the chain tip.
    // The plate goes upward into the interior of the chain's horseshoe shape.
    group.rotation.z = Math.PI;

    // After 180° flip, the bail is at local (0, -bailLocalY).
    // Position so the bail center aligns with the chain tip.
    const pendantCenterX = attachTip.x;
    const pendantCenterY = attachTip.y + bailLocalY;

    return {
      group,
      width: plateW,
      height: plateH,
      pendantCenterX,
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
