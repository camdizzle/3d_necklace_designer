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
  helvetiker_regular: '/fonts/helvetiker_regular.typeface.json',
  optimer_bold: '/fonts/optimer_bold.typeface.json',
  optimer_regular: '/fonts/optimer_regular.typeface.json',
  gentilis_bold: '/fonts/gentilis_bold.typeface.json',
  gentilis_regular: '/fonts/gentilis_regular.typeface.json',
  droid_sans_bold: '/fonts/droid_sans_bold.typeface.json',
  droid_sans_regular: '/fonts/droid_sans_regular.typeface.json',
  droid_serif_bold: '/fonts/droid_serif_bold.typeface.json',
  droid_serif_regular: '/fonts/droid_serif_regular.typeface.json',
  dancing_script: '/fonts/dancing_script.typeface.json',
  pacifico: '/fonts/pacifico.typeface.json',
  great_vibes: '/fonts/great_vibes.typeface.json'
};

export const FONT_LABELS = {
  helvetiker_bold: 'Helvetiker Bold',
  helvetiker_regular: 'Helvetiker',
  optimer_bold: 'Optimer Bold',
  optimer_regular: 'Optimer',
  gentilis_bold: 'Gentilis Bold',
  gentilis_regular: 'Gentilis',
  droid_sans_bold: 'Droid Sans Bold',
  droid_sans_regular: 'Droid Sans',
  droid_serif_bold: 'Droid Serif Bold',
  droid_serif_regular: 'Droid Serif',
  dancing_script: 'Dancing Script ✦',
  pacifico: 'Pacifico ✦',
  great_vibes: 'Great Vibes ✦'
};

export const DEFAULTS = {
  // Line 1
  text: 'KING',
  font: 'helvetiker_bold',
  textSize: 24,
  textCurve: 0,

  // Line 2
  secondLineText: '',
  secondLineFont: 'helvetiker_bold',
  secondLineSize: 16,
  secondLineCurve: 0,

  // Line 3
  thirdLineText: '',
  thirdLineFont: 'helvetiker_bold',
  thirdLineSize: 14,
  thirdLineCurve: 0,

  // Shared text settings
  letterSpacing: 0,
  textAlignment: 'center',
  extrudeDepth: 8,
  bevelEnabled: true,
  bevelThickness: 1.5,
  bevelSize: 1,
  bevelSegments: 3,

  // Plate
  platePadding: 8,
  plateRadius: 5,
  plateThickness: 3,
  pendantShape: 'rectangle',
  engrave: false,
  borderWidth: 0,
  customShapePoints: null,

  // Pendant position
  pendantScale: 1.0,
  pendantOffsetX: 0,
  pendantOffsetY: 0,
  pendantOffsetZ: -2.5,

  // Chain
  chainScale: 1.0,
  hideChain: false,

  // Material
  material: 'gold',
  customColor: '#FFD700',
  useCustomColor: false,
  chainMaterial: 'gold',
  twoTone: false,
  matteFinish: false,

  // Display
  backgroundColor: '#1a1a2e',
  showDimensions: true,

  // Image features
  imageThreshold: 128,
  reliefData: null,
  reliefHeight: 3,
  reliefResolution: 64,
  reliefInvert: false,
  customSTLGeometry: null,

  // Export
  exportFormat: 'stl'
};
