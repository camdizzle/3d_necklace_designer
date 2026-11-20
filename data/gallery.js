// Example designs shown on the landing page and in /gallery/.
// `state` holds only the settings that differ from the designer's
// defaults (src/constants.js); it becomes the #design= share link.
// Images are rendered from these by scripts/render-gallery.js.

export const GALLERY = [
  {
    slug: 'your-hype-chain',
    title: 'Your Hype Chain',
    blurb: 'The house style: chunky bubble letters in gold on a black outline, hung on a Cuban link.',
    state: {}
  },
  {
    slug: 'king-twisted-star',
    title: 'KING on a Twisted Star chain',
    blurb: 'One bold word in Archivo Black, all gold, on the Twisted Star chain.',
    state: {
      text: 'King', font: 'archivo_black', textSize: 30, secondLineText: '', thirdLineText: '',
      chainType: 'twisted-star', pendantOffsetX: 0, pendantOffsetY: -3, outlineBottomColor: '#3a2a00'
    }
  },
  {
    slug: 'best-dad-silver',
    title: 'Best Dad in silver and blue',
    blurb: 'A two-line gift chain: silver letters over a deep blue base with a silver Cuban link.',
    state: {
      text: 'Best', secondLineText: 'Dad', thirdLineText: '', font: 'carter_one', secondLineFont: 'carter_one',
      textSize: 26, secondLineSize: 30, material: 'silver', outlineBottomColor: '#0b3d91'
    }
  },
  {
    slug: 'bride-squad-rose',
    title: 'Bride Squad in rose gold',
    blurb: 'Pink letters on a white base with a rose gold chain, made for the whole party.',
    state: {
      text: 'Bride', secondLineText: 'Squad', thirdLineText: '', font: 'chewy', secondLineFont: 'chewy',
      textSize: 26, secondLineSize: 26, material: 'rose',
      lineColor1: '#ff5fa2', lineColor2: '#ff5fa2', outlineBottomColor: '#ffffff'
    }
  },
  {
    slug: 'go-tigers-team',
    title: 'Go Tigers team colours',
    blurb: 'Team colours for game day: orange letters on black, gold chain.',
    state: {
      text: 'Go', secondLineText: 'Tigers', thirdLineText: '', font: 'dynapuff', secondLineFont: 'dynapuff',
      textSize: 22, secondLineSize: 28, lineColor1: '#ff7a00', lineColor2: '#ff7a00', outlineBottomColor: '#111111'
    }
  },
  {
    slug: 'maya-heart-nameplate',
    title: 'Maya heart nameplate',
    blurb: 'A white script name raised on a rose gold heart plate.',
    state: {
      text: 'Maya', secondLineText: '', thirdLineText: '', font: 'pacifico', textSize: 24,
      pendantShape: 'heart', material: 'rose', platePadding: 14, lineColor1: '#ffffff'
    }
  },
  {
    slug: 'class-of-2027-circle',
    title: 'Class of 2027 medallion',
    blurb: 'A round platinum medallion with navy lettering for graduation.',
    state: {
      text: 'Class', secondLineText: 'of', thirdLineText: '2027', font: 'archivo_black',
      secondLineFont: 'archivo_black', thirdLineFont: 'archivo_black',
      textSize: 14, secondLineSize: 10, thirdLineSize: 18,
      pendantShape: 'circle', material: 'platinum', platePadding: 16,
      lineColor1: '#16213e', lineColor2: '#16213e', lineColor3: '#16213e'
    }
  },
  {
    slug: 'gg-gamer-tag',
    title: 'GG gamer tag',
    blurb: 'Neon green on black for a gamertag, streamer name or squad.',
    state: {
      text: 'GG', secondLineText: 'No Re', thirdLineText: '', font: 'sour_gummy', secondLineFont: 'sour_gummy',
      textSize: 34, secondLineSize: 20, material: 'silver',
      lineColor1: '#39ff14', lineColor2: '#39ff14', outlineBottomColor: '#0a0a0a'
    }
  }
];

export function designHash(state) {
  if (!state || Object.keys(state).length === 0) return '';
  return '#design=' + Buffer.from(JSON.stringify(state), 'utf-8').toString('base64');
}

export function designUrl(item) {
  return '/design/' + designHash(item.state);
}
