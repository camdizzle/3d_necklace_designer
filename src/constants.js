export const MATERIALS = {
  gold: {
    color: 0xFFD700,
    metalness: 0.9,
    roughness: 0.25,
    envMapIntensity: 1.0
  },
  silver: {
    color: 0xC0C0C0,
    metalness: 0.95,
    roughness: 0.2,
    envMapIntensity: 1.0
  },
  rose: {
    color: 0xE8A090,
    metalness: 0.85,
    roughness: 0.3,
    envMapIntensity: 1.0
  },
  platinum: {
    color: 0xE5E4E2,
    metalness: 0.95,
    roughness: 0.15,
    envMapIntensity: 1.0
  }
};

export const FONTS = {
  helvetiker_bold: '/fonts/helvetiker_bold.typeface.json',
  optimer_bold: '/fonts/optimer_bold.typeface.json',
  gentilis_bold: '/fonts/gentilis_bold.typeface.json'
};

export const DEFAULTS = {
  text: 'KING',
  font: 'helvetiker_bold',
  textSize: 24,
  extrudeDepth: 8,
  bevelEnabled: true,
  bevelThickness: 1.5,
  bevelSize: 1,
  bevelSegments: 3,
  platePadding: 8,
  plateRadius: 5,
  plateThickness: 3,
  pendantShape: 'rectangle',
  pendantScale: 1.0,
  pendantOffsetX: 0,
  pendantOffsetY: 0,
  pendantOffsetZ: -2.5,
  chainScale: 1.0,
  material: 'gold',

  // Text features
  letterSpacing: 0,
  textAlignment: 'center',
  textCurve: 0,
  secondLineText: '',
  secondLineSize: 16,

  // Visual features
  customColor: '#FFD700',
  useCustomColor: false,
  chainMaterial: 'gold',
  twoTone: false,
  matteFinish: false,
  backgroundColor: '#1a1a2e',

  // Plate features
  engrave: false,
  borderWidth: 0,
  customShapePoints: null,

  // Image features
  imageThreshold: 128,
  reliefData: null,
  reliefHeight: 3,
  reliefResolution: 64,
  reliefInvert: false,
  customSTLGeometry: null,

  // Chain
  hideChain: false,

  // Export
  exportFormat: 'stl',
  showDimensions: true
};
