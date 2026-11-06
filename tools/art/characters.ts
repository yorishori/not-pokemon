/**
 * Character sheets for the player and the NPCs, in the layout `src/world/player.ts` and `src/world/npc.ts` read:
 * 2 columns (stand, stride) × 4 rows (down, left, right, up) of 32 × 32 frames. Each frame is drawn at 16 × 16
 * design pixels (big head, short body, dark outline) and scaled ×2. A {@link Look} picks the colours and the hair
 * or hat, so every NPC gets its own sheet from the same templates.
 */
import { hex, Pix, shade, type Rgba } from './pixels';

/** How a character looks. */
export interface Look {
  skin: Rgba;
  hair: Rgba;
  /** `short`, `long` (to the shoulders), `cap` (peaked cap in `hat` colour), `bald`, `bun`. */
  style: 'short' | 'long' | 'cap' | 'bald' | 'bun';
  shirt: Rgba;
  pants: Rgba;
  shoes?: Rgba;
  hat?: Rgba;
  /** A second shirt colour drawn as a vest/apron front (waiters, shopkeepers). */
  front?: Rgba;
  /** A tie colour (office people). */
  tie?: Rgba;
}

const OUT = hex('#282030');
const EYE = hex('#202028');

// Templates: O outline, H hair, S skin, E eye, C shirt, P pants, K shoes, A arm (skin), F front/vest, T tie.
const DOWN = [
  '     OOOOOO     ',
  '    OHHHHHHO    ',
  '   OHHHHHHHHO   ',
  '   OHHHHHHHHO   ',
  '   OHSSSSSSHO   ',
  '   OSSESSESSO   ',
  '   OSSESSESSO   ',
  '    OSSSSSSO    ',
  '   OOCCTTCCOO   ',
  '  OAOCFTTFCOAO  ',
  '  OAOCFTTFCOAO  ',
  '   OOCFFFFCOO   ',
  '    OPPPPPPO    ',
  '    OPPOOPPO    ',
  '    OKKOOKKO    ',
  '     OO  OO     ',
];
const DOWN_STEP = [
  ...DOWN.slice(0, 8),
  '   OOCCTTCCOO   ',
  '  OAOCFTTFCOO   ',
  '  OAOCFTTFCOAO  ',
  '   OOCFFFFCOAO  ',
  '    OPPPPPPOO   ',
  '    OPPOOKKO    ',
  '    OKKO OOO    ',
  '     OO         ',
];
const UP = [
  '     OOOOOO     ',
  '    OHHHHHHO    ',
  '   OHHHHHHHHO   ',
  '   OHHHHHHHHO   ',
  '   OHHHHHHHHO   ',
  '   OHHHHHHHHO   ',
  '   OSHHHHHHSO   ',
  '    OHHHHHHO    ',
  '   OOCCCCCCOO   ',
  '  OAOCCCCCCOAO  ',
  '  OAOCCCCCCOAO  ',
  '   OOCCCCCCOO   ',
  '    OPPPPPPO    ',
  '    OPPOOPPO    ',
  '    OKKOOKKO    ',
  '     OO  OO     ',
];
const UP_STEP = [
  ...UP.slice(0, 8),
  '   OOCCCCCCOO   ',
  '   OOCCCCCCOAO  ',
  '  OAOCCCCCCOAO  ',
  '  OAOCCCCCCOO   ',
  '   OOPPPPPPO    ',
  '    OKKOOPPO    ',
  '     OOO OKKO   ',
  '          OO    ',
];
const LEFT = [
  '     OOOOOO     ',
  '    OHHHHHHO    ',
  '   OHHHHHHHHO   ',
  '   OHHHHHHHHO   ',
  '   OSSHHHHHHO   ',
  '  OSESSSHHHHO   ',
  '  OSESSSSHHO    ',
  '   OSSSSSSO     ',
  '    OCCCCCO     ',
  '    OFCAACO     ',
  '    OFCAACO     ',
  '    OFCCCCO     ',
  '    OPPPPPO     ',
  '    OPPPPPO     ',
  '    OKKKKO      ',
  '     OOOO       ',
];
const LEFT_STEP = [
  ...LEFT.slice(0, 8),
  '    OCCCCCO     ',
  '    OFCCAAO     ',
  '    OFCCAAO     ',
  '    OFCCCCO     ',
  '    OPPPPPO     ',
  '   OPPO OPPO    ',
  '  OKKO   OKKO   ',
  '   OO     OO    ',
];

/** Paint one 16 × 16 frame from a template and a look. */
function frame(rows: readonly string[], look: Look, dir: 'down' | 'left' | 'up'): Pix {
  const front = look.front ?? look.shirt;
  const pal: Record<string, Rgba> = {
    O: OUT,
    H: look.hair,
    S: look.skin,
    A: look.skin,
    E: EYE,
    C: look.shirt,
    F: front,
    T: look.tie ?? look.shirt,
    P: look.pants,
    K: look.shoes ?? hex('#403038'),
  };
  const p = new Pix(16, 16).ascii(0, 0, rows, pal);
  const set = (x: number, y: number, c: Rgba) => p.set(x, y, c);
  if (look.style === 'bald') {
    // Skin instead of hair on the crown; a fringe of hair on the sides.
    for (let y = 1; y < 4; y += 1)
      for (let x = 4; x < 12; x += 1) if (p.get(x, y)[0] === look.hair[0]) set(x, y, look.skin);
    if (dir === 'up') for (let y = 4; y < 8; y += 1) for (let x = 4; x < 12; x += 1) set(x, y, look.skin);
  }
  if (look.style === 'long') {
    // Hair down to the shoulders.
    if (dir === 'down')
      for (let y = 5; y < 10; y += 1)
        set(3, y, look.hair).set(12, y, look.hair).set(2, y, OUT).set(13, y, OUT);
    if (dir === 'up') for (let y = 7; y < 10; y += 1) for (let x = 4; x < 12; x += 1) set(x, y, look.hair);
    if (dir === 'left')
      for (let y = 6; y < 10; y += 1) set(10, y, look.hair).set(11, y, look.hair).set(12, y, OUT);
  }
  if (look.style === 'bun') {
    set(7, 0, look.hair).set(8, 0, look.hair).set(6, 0, OUT).set(9, 0, OUT);
    p.set(7, -1, OUT);
  }
  if (look.style === 'cap' && look.hat) {
    const hat = look.hat;
    for (let y = 1; y < 4; y += 1)
      for (let x = 3; x < 13; x += 1) if (p.get(x, y)[0] === look.hair[0]) set(x, y, hat);
    set(6, 1, shade(hat, 0.45)).set(7, 1, shade(hat, 0.45));
    // Brim.
    if (dir === 'down') for (let x = 3; x < 13; x += 1) set(x, 4, shade(hat, -0.35));
    if (dir === 'left')
      for (let x = 1; x < 7; x += 1) set(x, 4, shade(hat, -0.35)).set(x, 3, x < 3 ? OUT : p.get(x, 3));
  }
  // Highlights and shading: a light pixel on the hair, darker pixels where a colour meets the outline on the right.
  const lit = look.style === 'cap' && look.hat ? look.hat : look.style === 'bald' ? look.skin : look.hair;
  set(5, 2, shade(lit, 0.35));
  const src = p.clone();
  for (let y = 0; y < 16; y += 1)
    for (let x = 1; x < 15; x += 1) {
      const c = src.get(x, y);
      const r = src.get(x + 1, y);
      if (c[3] === 0 || (c[0] === OUT[0] && c[1] === OUT[1]) || c[0] === EYE[0]) continue;
      if (r[0] === OUT[0] && r[1] === OUT[1] && r[2] === OUT[2]) p.set(x, y, shade(c, -0.18));
    }
  return p;
}

/** The full 64 × 128 sheet (32 px frames) for a look. */
export function drawCharacterSheet(look: Look): Buffer {
  const rows: [readonly string[], readonly string[], 'down' | 'left' | 'up', boolean][] = [
    [DOWN, DOWN_STEP, 'down', false],
    [LEFT, LEFT_STEP, 'left', false],
    [LEFT, LEFT_STEP, 'left', true],
    [UP, UP_STEP, 'up', false],
  ];
  const sheet = new Pix(32, 64);
  rows.forEach(([stand, step, dir, flip], r) => {
    [stand, step].forEach((tpl, c) => {
      let f = frame(tpl, look, dir);
      if (flip) f = f.flipX();
      sheet.blit(f, c * 16, r * 16);
    });
  });
  return sheet.scale(2).png();
}

const SKIN = { light: hex('#f8d4b0'), mid: hex('#e8b088'), tan: hex('#c88c60'), dark: hex('#8c5c3c') };
const HAIR = {
  black: hex('#302830'),
  brown: hex('#784828'),
  chestnut: hex('#a05c30'),
  blond: hex('#f0c860'),
  red: hex('#d05830'),
  grey: hex('#b8b8c0'),
  white: hex('#f0f0f0'),
};

/** The player: orange cap, teal jacket, dark trousers (an original look, not any existing game's hero). */
export const PLAYER_LOOK: Look = {
  skin: SKIN.light,
  hair: HAIR.brown,
  style: 'cap',
  hat: hex('#f08830'),
  shirt: hex('#30a8a0'),
  front: hex('#f8f8f0'),
  pants: hex('#384068'),
  shoes: hex('#c03838'),
};

/** One look per NPC sprite file name (`assets/sprites/npcs/<name>.png`). */
export const NPC_LOOKS: Record<string, Look> = {
  // Story realm bosses (`story.json`).
  guardiana: {
    skin: SKIN.mid,
    hair: HAIR.black,
    style: 'cap',
    hat: hex('#606878'),
    shirt: hex('#8890a0'),
    pants: hex('#484858'),
    front: hex('#c03838'),
  },
  frutera: {
    skin: SKIN.tan,
    hair: HAIR.chestnut,
    style: 'bun',
    shirt: hex('#f0a030'),
    pants: hex('#405890'),
    front: hex('#58b058'),
  },
  fallera: {
    skin: SKIN.light,
    hair: HAIR.brown,
    style: 'bun',
    shirt: hex('#f0d878'),
    pants: hex('#e8c050'),
    front: hex('#f8f0d8'),
  },
  paellero: {
    skin: SKIN.tan,
    hair: HAIR.grey,
    style: 'short',
    shirt: hex('#f8f8f0'),
    pants: hex('#3868a8'),
    front: hex('#e8d048'),
  },
  cientifica: {
    skin: SKIN.dark,
    hair: HAIR.black,
    style: 'long',
    shirt: hex('#f8f8f8'),
    pants: hex('#38a0a8'),
    front: hex('#e8f0f8'),
  },
  jefa_estacion: {
    skin: SKIN.mid,
    hair: HAIR.red,
    style: 'cap',
    hat: hex('#c03838'),
    shirt: hex('#283868'),
    pants: hex('#283868'),
    tie: hex('#e8c040'),
  },
  barquera: {
    skin: SKIN.tan,
    hair: HAIR.white,
    style: 'cap',
    hat: hex('#d8c078'),
    shirt: hex('#4878a0'),
    pants: hex('#584838'),
  },
  // World redesign: townsfolk, station staff and M.P.
  abuelo: { skin: SKIN.tan, hair: HAIR.white, style: 'bald', shirt: hex('#c8b890'), pants: hex('#585048') },
  vecina: { skin: SKIN.light, hair: HAIR.brown, style: 'bun', shirt: hex('#e070a0'), pants: hex('#4c5070') },
  nina: { skin: SKIN.mid, hair: HAIR.black, style: 'long', shirt: hex('#f8d048'), pants: hex('#d05050') },
  ciclista: {
    skin: SKIN.light,
    hair: HAIR.chestnut,
    style: 'cap',
    hat: hex('#f05030'),
    shirt: hex('#48c070'),
    pants: hex('#282830'),
  },
  estudiante: {
    skin: SKIN.tan,
    hair: HAIR.black,
    style: 'short',
    shirt: hex('#8060c8'),
    pants: hex('#3c4c80'),
  },
  operario: {
    skin: SKIN.mid,
    hair: HAIR.brown,
    style: 'cap',
    hat: hex('#f8c830'),
    shirt: hex('#f08830'),
    front: hex('#f8e858'),
    pants: hex('#30406c'),
  },
  banista: {
    skin: hex('#ffc0a0'),
    hair: HAIR.blond,
    style: 'long',
    shirt: hex('#40c8d8'),
    pants: hex('#f8f0e0'),
  },
  pescador: {
    skin: SKIN.tan,
    hair: HAIR.grey,
    style: 'cap',
    hat: hex('#2c4c80'),
    shirt: hex('#f0e8d0'),
    pants: hex('#486078'),
  },
  maquinista: {
    skin: SKIN.light,
    hair: HAIR.brown,
    style: 'cap',
    hat: hex('#c83838'),
    shirt: hex('#2b2a6e'),
    front: hex('#f0f0f0'),
    pants: hex('#2b2a6e'),
  },
  mp: { skin: SKIN.light, hair: HAIR.chestnut, style: 'short', shirt: hex('#46a5e1'), pants: hex('#f0e0b0') },
  recepcionista: {
    skin: SKIN.light,
    hair: HAIR.chestnut,
    style: 'long',
    shirt: hex('#e86890'),
    pants: hex('#404050'),
  },
  informatico: {
    skin: SKIN.mid,
    hair: HAIR.black,
    style: 'short',
    shirt: hex('#506878'),
    pants: hex('#3c4c80'),
    front: hex('#303840'),
  },
  camarero: {
    skin: SKIN.tan,
    hair: HAIR.black,
    style: 'short',
    shirt: hex('#f8f8f8'),
    front: hex('#282830'),
    pants: hex('#282830'),
  },
  camarera: {
    skin: SKIN.light,
    hair: HAIR.blond,
    style: 'bun',
    shirt: hex('#f8f8f8'),
    front: hex('#282830'),
    pants: hex('#282830'),
  },
  tendero: {
    skin: SKIN.mid,
    hair: HAIR.grey,
    style: 'bald',
    shirt: hex('#5888c8'),
    front: hex('#f0f0e8'),
    pants: hex('#504838'),
  },
  tendera: {
    skin: SKIN.tan,
    hair: HAIR.brown,
    style: 'bun',
    shirt: hex('#c85050'),
    front: hex('#f0f0e8'),
    pants: hex('#504838'),
  },
  cliente: { skin: SKIN.light, hair: HAIR.red, style: 'short', shirt: hex('#78b848'), pants: hex('#5068a0') },
  becario: {
    skin: SKIN.light,
    hair: HAIR.blond,
    style: 'short',
    shirt: hex('#f0d048'),
    pants: hex('#4060a0'),
  },
  hortelano: {
    skin: SKIN.tan,
    hair: HAIR.grey,
    style: 'cap',
    hat: hex('#d8c070'),
    shirt: hex('#6c9048'),
    pants: hex('#6c5838'),
  },
  recolectora: {
    skin: SKIN.mid,
    hair: HAIR.brown,
    style: 'cap',
    hat: hex('#f0e0a0'),
    shirt: hex('#f09030'),
    pants: hex('#486080'),
  },
  turista: {
    skin: hex('#ffc0a0'),
    hair: HAIR.blond,
    style: 'cap',
    hat: hex('#f8f8f8'),
    shirt: hex('#40b8e0'),
    pants: hex('#d8c8a0'),
  },
  consultor: {
    skin: SKIN.light,
    hair: HAIR.brown,
    style: 'short',
    shirt: hex('#f8f8f8'),
    front: hex('#384058'),
    tie: hex('#c03040'),
    pants: hex('#384058'),
  },
  funcionaria: {
    skin: SKIN.mid,
    hair: HAIR.black,
    style: 'bun',
    shirt: hex('#9878b8'),
    pants: hex('#383848'),
  },
  repartidor: {
    skin: SKIN.tan,
    hair: HAIR.black,
    style: 'cap',
    hat: hex('#e8c030'),
    shirt: hex('#e8c030'),
    pants: hex('#383838'),
  },
  comercial: {
    skin: SKIN.light,
    hair: HAIR.black,
    style: 'short',
    shirt: hex('#f0f0f8'),
    front: hex('#5058a0'),
    tie: hex('#f0c040'),
    pants: hex('#5058a0'),
  },
  ponente: {
    skin: SKIN.dark,
    hair: HAIR.black,
    style: 'short',
    shirt: hex('#f8f8f8'),
    front: hex('#283050'),
    tie: hex('#3080d0'),
    pants: hex('#283050'),
  },
  socorrista: {
    skin: SKIN.tan,
    hair: HAIR.blond,
    style: 'short',
    shirt: hex('#e83838'),
    pants: hex('#e83838'),
    shoes: SKIN.tan,
  },
  surfera: {
    skin: SKIN.tan,
    hair: HAIR.blond,
    style: 'long',
    shirt: hex('#30c0c0'),
    pants: hex('#f07850'),
    shoes: SKIN.tan,
  },
  jefe: {
    skin: SKIN.light,
    hair: HAIR.grey,
    style: 'bald',
    shirt: hex('#f8f8f8'),
    front: hex('#202028'),
    tie: hex('#d02828'),
    pants: hex('#202028'),
  },
  murciano: {
    skin: SKIN.tan,
    hair: HAIR.black,
    style: 'cap',
    hat: hex('#a03040'),
    shirt: hex('#f0f0e0'),
    front: hex('#a03040'),
    pants: hex('#405070'),
  },
  enologa: {
    skin: SKIN.light,
    hair: HAIR.red,
    style: 'long',
    shirt: hex('#781c40'),
    front: hex('#f0e8d8'),
    pants: hex('#383040'),
  },
  companera: {
    skin: SKIN.mid,
    hair: HAIR.brown,
    style: 'long',
    shirt: hex('#f0f0f8'),
    front: hex('#48a8a0'),
    pants: hex('#383c58'),
  },
  encargado: {
    skin: SKIN.mid,
    hair: HAIR.brown,
    style: 'short',
    shirt: hex('#48a068'),
    front: hex('#f0f0e8'),
    pants: hex('#404040'),
  },
};

/** A look for a sprite name that has none in {@link NPC_LOOKS} (picked from the name, so it is stable). */
export function lookFor(name: string): Look {
  const known = NPC_LOOKS[name];
  if (known) return known;
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const shirts = ['#e05050', '#5080d0', '#50a860', '#e0a030', '#9060c0', '#30a0a0'];
  const hairs = Object.values(HAIR);
  const skins = Object.values(SKIN);
  const styles: Look['style'][] = ['short', 'long', 'bun', 'short', 'bald'];
  return {
    skin: skins[h % skins.length]!,
    hair: hairs[(h >>> 3) % hairs.length]!,
    style: styles[(h >>> 6) % styles.length]!,
    shirt: hex(shirts[(h >>> 9) % shirts.length]!),
    pants: hex('#404860'),
  };
}
