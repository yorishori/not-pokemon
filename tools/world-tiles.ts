/**
 * World tileset, part 2 (world redesign): the extra tiles the redesigned maps need (huerta crops, the sea,
 * the industrial estate and the ahora façade, stations and trains, the open-plan office, the Turia park, the CAC…).
 * Each is a 16 × 16 design grid (one character per pixel, a palette per tile; `.` is transparent), scaled ×2 like
 * every tile of `tools/art/tiles.ts`. They come after the base tiles and their variants in `world.png`, so their
 * local ids ({@link XT}) are computed, never hard-coded. An extra tile is its own base: no autotile variants.
 *
 * Colours follow the handheld-RPG palette of `tools/art/tiles.ts` (dark outlines, bright fills). The office uses the
 * ahora logo's deep navy, light blue and white; the flexygo accent is orange (open question in `docs/PROGRESS.md`).
 */
import { BASE_TILES, VARIANT_TILES, type TileArt } from './art/tiles';
import { hex, Pix, type Rgba } from './art/pixels';

/** Shared palette; tiles may add their own letters. */
const C: Record<string, Rgba> = {
  g: hex('#78d080'), // grass
  G: hex('#58b068'), // dark grass
  d: hex('#2e7840'), // deep leaf
  l: hex('#a8e8a0'), // light leaf
  o: hex('#f89838'), // orange
  y: hex('#f8d848'), // yellow
  b: hex('#8a6038'), // brown
  B: hex('#5a3c20'), // dark brown
  s: hex('#c88850'), // soil
  S: hex('#a06838'), // soil furrow
  w: hex('#fbfbf8'), // white
  W: hex('#d4d8e4'), // off-white shadow
  k: hex('#283828'), // outline
  K: hex('#5c5a64'), // dark grey
  m: hex('#9c9888'), // mid grey
  M: hex('#cdc8b8'), // light grey
  n: hex('#2b2a6e'), // ahora navy
  N: hex('#1e1e50'), // navy shadow
  a: hex('#46a5e1'), // ahora light blue
  A: hex('#a8d8f0'), // pale blue / glass
  f: hex('#f08828'), // flexygo orange accent
  r: hex('#e84848'), // red
  R: hex('#a82838'), // dark red
  t: hex('#e07850'), // terracotta
  c: hex('#f4ecd4'), // cream
  C: hex('#d8ccac'), // cream shadow
  p: hex('#8048b0'), // purple
  P: hex('#5a2e82'), // dark purple
  e: hex('#58b8e8'), // sea
  E: hex('#3890c8'), // deep sea
  u: hex('#f8e4b0'), // sand
  U: hex('#e2c486'), // sand shadow
  v: hex('#6e2870'), // eggplant / plum
  i: hex('#d8a060'), // light wood
};

/** One tile: a 16-row pixel grid (16 chars a row) and optional extra palette entries. */
interface PixelTile {
  rows: string[];
  pal?: Record<string, Rgba>;
}

/** Names of the extra tiles, in tileset order. */
const EXTRA_NAMES = [
  'soil',
  'onion',
  'lettuce',
  'eggplant',
  'sea',
  'shore',
  'sidewalk',
  'crosswalk',
  'paseo',
  'officeFloor',
  'carpet',
  'platform',
  'rails',
  'stationFloor',
  'orangeTree',
  'palm',
  'whiteHouse',
  'creamHouse',
  'industrial',
  'industrialWindows',
  'ahoraFacade',
  'logoA',
  'logoB',
  'logoC',
  'shutter',
  'brick',
  'metroSign',
  'train',
  'trainDoor',
  'glass',
  'sofa',
  'plant',
  'meetingTable',
  'modernDesk',
  'coffeeBar',
  'screen',
  'umbrella',
  'towel',
  'bench',
  'bankWall',
  'stairs',
  'agora',
  'cac',
  'oldStone',
  'plumTree',
  'stationFacade',
  'boat',
  'stoneBridge',
  'officeWall',
  'flatRoof',
  'greyRoof',
  'assut',
  'bullring',
  'lamp',
  'dryGrass',
  'wave',
  'mysteryDoor',
  'storyNode',
] as const;
/** An extra tile's name. */
export type ExtraName = (typeof EXTRA_NAMES)[number];

/** Local id of the first extra tile: after the base tiles and their variants. */
export const EXTRA_FIRST = BASE_TILES.length + VARIANT_TILES.length;

/** Local tile ids of the extra tiles (`XT.soil`, `XT.logoA`, …), right after the variants. */
export const XT = Object.fromEntries(EXTRA_NAMES.map((n, i) => [n, EXTRA_FIRST + i])) as Record<
  ExtraName,
  number
>;

const solidRow = (ch: string) => ch.repeat(16);

/** The pixel art, by id. */
const TILES: Record<ExtraName, PixelTile> = {
  soil: {
    rows: Array.from({ length: 16 }, (_, y) => solidRow(y % 4 === 1 ? 'S' : 's')),
  },
  onion: {
    rows: Array.from({ length: 16 }, (_, y) =>
      y % 8 === 0
        ? '.l...l...l...l..'
        : y % 8 === 1
          ? '.l...l...l...l..'
          : y % 8 === 2
            ? 'wWw.wWw.wWw.wWw.'
            : y % 8 === 3
              ? '.w...w...w...w..'
              : solidRow('s'),
    ).map((r) => r.replace(/\./g, 's')),
  },
  lettuce: {
    rows: [
      'ssssssssssssssss',
      'slllsssslllsssss',
      'llLllsslllLlssss',
      'lLLLlsslLLLlssss',
      'llLllsslllLlssss',
      'sllssssslllsssss',
      'SSSSSSSSSSSSSSSS',
      'ssssssssssssssss',
      'sssslllssssslllss'.slice(0, 16),
      'sssllLllssslllLl',
      'sssLLLLlssslLLLl',
      'sssllLllssslllLl',
      'ssssllssssssllss',
      'SSSSSSSSSSSSSSSS',
      'ssssssssssssssss',
      'ssssssssssssssss',
    ],
    pal: { L: [70, 160, 60, 255] },
  },
  eggplant: {
    rows: [
      'sssGssssssGsssss',
      'ssGGGsssssGGGsss',
      'ssdvvssssssdvvss',
      'ssvvvvsssssvvvvs',
      'ssvvvvsssssvvvvs',
      'sssvvsssssssvvss',
      'SSSSSSSSSSSSSSSS',
      'ssssssssssssssss',
      'GssssssGssssssss',
      'GGGssssGGGssssss',
      'dvvssssdvvssssss',
      'vvvvsssvvvvsssss',
      'vvvvsssvvvvsssss',
      'svvssssvvsssssss',
      'SSSSSSSSSSSSSSSS',
      'ssssssssssssssss',
    ],
  },
  sea: {
    rows: Array.from({ length: 16 }, (_, y) =>
      y === 3 ? 'eeAAeeeeeeeeeeee' : y === 10 ? 'eeeeeeeeeAAeeeee' : solidRow(y > 12 ? 'E' : 'e'),
    ),
  },
  shore: {
    rows: Array.from({ length: 16 }, (_, y) =>
      y < 3
        ? solidRow('u')
        : y === 3
          ? 'uuwwuuuwwwuuuwwu'
          : y < 7
            ? solidRow('A')
            : y === 7
              ? 'AwAAwwAAAwAAwwAA'
              : solidRow('e'),
    ),
  },
  sidewalk: {
    rows: Array.from({ length: 16 }, (_, y) => (y % 8 === 7 ? solidRow('M') : 'WWWWWWWMWWWWWWWM')),
  },
  crosswalk: {
    rows: Array.from({ length: 16 }, (_, y) => (y % 4 < 2 ? 'KwwwwwwwwwwwwwwK' : solidRow('K'))),
  },
  paseo: {
    rows: Array.from({ length: 16 }, (_, y) =>
      Array.from({ length: 16 }, (_, x) => ((Math.floor(x / 4) + Math.floor(y / 4)) % 2 ? 'c' : 'r')).join(
        '',
      ),
    ),
    pal: { r: [226, 150, 120, 255] },
  },
  officeFloor: {
    rows: Array.from({ length: 16 }, (_, y) => (y === 15 ? solidRow('M') : 'WWWWWWWWWWWWWWWM')),
  },
  carpet: {
    rows: Array.from({ length: 16 }, (_, y) => (y % 4 === 0 ? 'AaAAAaAAAaAAAaAA' : solidRow('A'))),
  },
  platform: {
    rows: Array.from({ length: 16 }, (_, y) =>
      y >= 13 ? solidRow(y === 13 ? 'y' : 'k') : y % 8 === 7 ? solidRow('m') : 'MMMMMMMmMMMMMMMm',
    ),
  },
  rails: {
    rows: Array.from({ length: 16 }, (_, y) =>
      y === 3 || y === 12 ? solidRow('m') : y % 4 === 1 ? solidRow('b') : solidRow('K'),
    ),
  },
  stationFloor: {
    rows: Array.from({ length: 16 }, (_, y) =>
      Array.from({ length: 16 }, (_, x) => ((x + y) % 8 === 0 || (x - y + 16) % 8 === 0 ? 't' : 'c')).join(
        '',
      ),
    ),
  },
  orangeTree: {
    rows: [
      '................',
      '.....dddddd.....',
      '...ddGGGGGGdd...',
      '..dGGGoGGGGGGd..',
      '.dGGGGGGGoGGGGd.',
      '.dGoGGGGGGGGoGd.',
      'dGGGGGoGGGGGGGGd',
      'dGGGGGGGGGoGGGGd',
      'dGoGGGGGGGGGGoGd',
      '.dGGGGoGGGGGGGd.',
      '.dGGGGGGGoGGGGd.',
      '..ddGGGGGGGGdd..',
      '....dddbbddd....',
      '.......bb.......',
      '.......bb.......',
      '......BBBB......',
    ],
  },
  palm: {
    rows: [
      '...l........l...',
      '..lGl..ll..lGl..',
      '.lG..lGGGGl..Gl.',
      'lG..lGGddGGl..Gl',
      '...lG..bb..Gl...',
      '..lG...bb...Gl..',
      '..G....bb....G..',
      '.......bb.......',
      '.......bb.......',
      '......bbB.......',
      '......bbB.......',
      '......bbB.......',
      '.......bbB......',
      '.......bbB......',
      '.......bbB......',
      '......BBBBB.....',
    ],
  },
  whiteHouse: {
    rows: [
      'wwwwwwwwwwwwwwww',
      'wwwwwwwwwwwwwwww',
      'wwaaaaaaawwwwwww',
      'wwaAAkAAawwwwwww',
      'wwaAAkAAawwwwwww',
      'wwakkkkkawwwwwww',
      'wwaAAkAAawwwwwww',
      'wwaAAkAAawwwwwww',
      'wwaaaaaaawwwwwww',
      'wwwwwwwwwwwwwwww',
      'wwwwwwwwwwwwwwww',
      'wwwwwwwwwwwwwwww',
      'aaaaaaaaaaaaaaaa',
      'WWWWWWWWWWWWWWWW',
      'WWWWWWWWWWWWWWWW',
      'MMMMMMMMMMMMMMMM',
    ],
  },
  creamHouse: {
    rows: [
      'cccccccccccccccc',
      'cccccccccccccccc',
      'cccbbbbbbbbccccc',
      'cccbAAkAAkbccccc',
      'cccbAAkAAkbccccc',
      'cccbkkkkkkbccccc',
      'cccbAAkAAkbccccc',
      'cccbAAkAAkbccccc',
      'cccbbbbbbbbccccc',
      'ccrrrrrrrrrrcccc',
      'cccccccccccccccc',
      'cccccccccccccccc',
      'CCCCCCCCCCCCCCCC',
      'CCCCCCCCCCCCCCCC',
      'CCCCCCCCCCCCCCCC',
      'tttttttttttttttt',
    ],
  },
  industrial: {
    rows: Array.from({ length: 16 }, (_, y) => (y === 15 ? solidRow('K') : 'MmMMmMMmMMmMMmMM')),
  },
  industrialWindows: {
    rows: Array.from({ length: 16 }, (_, y) =>
      y >= 4 && y <= 9
        ? y === 4 || y === 9
          ? 'MmkkkkkkkkkkkkmM'
          : 'MmkAAkAAkAAkAAmM'
        : y === 15
          ? solidRow('K')
          : 'MmMMmMMmMMmMMmMM',
    ),
  },
  ahoraFacade: {
    rows: Array.from({ length: 16 }, (_, y) => (y === 15 ? solidRow('N') : 'nNnnNnnNnnNnnNnn')),
  },
  // The logo "ahora" in white with the light-blue check, over three façade tiles: "ah" | "o✓" | "ra".
  logoA: {
    rows: [
      'nNnnNnnNnnNnnNnn',
      'nNnnNnnNnnNnnNnn',
      'nNnnNnnNwwNnnNnn',
      'nNnnNnnNwwNnnNnn',
      'nNwwwwnNwwNnnNnn',
      'nNnnnwwNwwwwwNnn',
      'nNnnnwwNwwnnwwnn',
      'nNwwwwwNwwnnwwnn',
      'nwwnnwwNwwnnwwnn',
      'nwwnnwwNwwnnwwnn',
      'nNwwwwwNwwnnwwnn',
      'nNnnNnnNnnNnnNnn',
      'nNnnNnnNnnNnnNnn',
      'nNnnNnnNnnNnnNnn',
      'nNnnNnnNnnNnnNnn',
      'NNNNNNNNNNNNNNNN',
    ],
  },
  logoB: {
    rows: [
      'nNnnNnnNnnNnnNnn',
      'nNnnNnnNnnNnnNnn',
      'nNnnNnnNnnNnnNnn',
      'nNnnNnnNnnNnnNnn',
      'nNnnNwwwwwNnnNnn',
      'nNnnwwnnnwwnnNnn',
      'nNnwwnnNnnwwnNnn',
      'nNnwnanNnanwnNnn',
      'nNnwnnaNannwnNnn',
      'nNnwwnnaanwwnNnn',
      'nNnnwwnaNwwnnNnn',
      'nNnnNwwwwwNnnNnn',
      'nNnnNnnNnnNnnNnn',
      'nNnnNnnNnnNnnNnn',
      'nNnnNnnNnnNnnNnn',
      'NNNNNNNNNNNNNNNN',
    ],
  },
  logoC: {
    rows: [
      'nNnnNnnNnnNnnNnn',
      'nNnnNnnNnnNnnNnn',
      'nNnnNnnNnnNnnNnn',
      'nNnnNnnNnnNnnNnn',
      'nNwwnwwwnNwwwwnn',
      'nNwwwnnNnnnnnwwn',
      'nNwwnnnNnnnnnwwn',
      'nNwwnnnNnNwwwwwn',
      'nNwwnnnNnwwnnwwn',
      'nNwwnnnNnwwnnwwn',
      'nNwwnnnNnNwwwwwn',
      'nNnnNnnNnnNnnNnn',
      'nNnnNnnNnnNnnNnn',
      'nNnnNnnNnnNnnNnn',
      'nNnnNnnNnnNnnNnn',
      'NNNNNNNNNNNNNNNN',
    ],
  },
  shutter: {
    rows: Array.from({ length: 16 }, (_, y) =>
      y < 2 ? solidRow('M') : y === 15 ? solidRow('K') : y % 2 ? 'MNNNNNNNNNNNNNNM' : 'MnnnnnnnnnnnnnnM',
    ),
  },
  brick: {
    rows: Array.from({ length: 16 }, (_, y) =>
      y % 4 === 3 ? solidRow('C') : y % 8 < 4 ? 'tttCtttttttCtttt' : 'tttttttCttttttttt'.slice(0, 16),
    ),
    pal: { t: [214, 160, 110, 255], C: [176, 128, 86, 255] },
  },
  metroSign: {
    rows: [
      '................',
      '....rrrrrrrr....',
      '...rrrrrrrrrr...',
      '..rrwwrrrrwwrr..',
      '..rrwwwrrwwwrr..',
      '..rrwwrwwrwwrr..',
      '..rrwwrrrrwwrr..',
      '..rrwwrrrrwwrr..',
      '...rrrrrrrrrr...',
      '....rrrrrrrr....',
      '.......KK.......',
      '.......KK.......',
      '.......KK.......',
      '.......KK.......',
      '.......KK.......',
      '......KKKK......',
    ],
  },
  train: {
    rows: [
      'KKKKKKKKKKKKKKKK',
      'wwwwwwwwwwwwwwww',
      'wwwwwwwwwwwwwwww',
      'wkkkkkwwwwkkkkkw',
      'wkAAAkwwwwkAAAkw',
      'wkAAAkwwwwkAAAkw',
      'wkkkkkwwwwkkkkkw',
      'wwwwwwwwwwwwwwww',
      'rrrrrrrrrrrrrrrr',
      'wwwwwwwwwwwwwwww',
      'wwwwwwwwwwwwwwww',
      'WWWWWWWWWWWWWWWW',
      'KKKKKKKKKKKKKKKK',
      'kKKkkkkkkkkkKKkk',
      'kKKkkkkkkkkkKKkk',
      'kkkkkkkkkkkkkkkk',
    ],
  },
  trainDoor: {
    rows: [
      'KKKKKKKKKKKKKKKK',
      'wwwwwwwwwwwwwwww',
      'wwkkkkkkkkkkkkww',
      'wwkAAAAkkAAAAkww',
      'wwkAAAAkkAAAAkww',
      'wwkAAAAkkAAAAkww',
      'wwkmmmmkkmmmmkww',
      'wwkmmmmkkmmmmkww',
      'rrkmmmmkkmmmmkrr',
      'wwkmmmmkkmmmmkww',
      'wwkmmmmkkmmmmkww',
      'WWkmmmmkkmmmmkWW',
      'KKkkkkkkkkkkkkKK',
      'yyyyyyyyyyyyyyyy',
      'MMMMMMMMMMMMMMMM',
      'MMMMMMMMMMMMMMMM',
    ],
  },
  glass: {
    rows: Array.from({ length: 16 }, (_, y) =>
      y === 0 || y === 15 ? solidRow('m') : y % 5 === 2 ? 'mAAwAAAAAAAAAAAm' : 'mAAAAAAAAAAAAAAm',
    ),
  },
  sofa: {
    rows: [
      '................',
      '................',
      '.nnnnnnnnnnnnnn.',
      'nNNNNNNNNNNNNNNn',
      'nNnnnnnnnnnnnnNn',
      'nNnnnnnnnnnnnnNn',
      'nNaaaaaaaaaaaaNn',
      'nNaaaaaaaaaaaaNn',
      'nNaaaaaaaaaaaaNn',
      'nNNNNNNNNNNNNNNn',
      '.nnnnnnnnnnnnnn.',
      '.K............K.',
      '................',
      '................',
      '................',
      '................',
    ],
  },
  plant: {
    rows: [
      '.....l...l......',
      '...l.ll.ll.l....',
      '..lGl.lGl.lGl...',
      '...GGlGGGlGG....',
      '..lGGGdGdGGGl...',
      '...GdGGGGGdG....',
      '....GGdGdGG.....',
      '.....GGGGG......',
      '....ffffffff....',
      '....fffffff.f...',
      '.....ffffff.....',
      '.....ffffff.....',
      '.....ffffff.....',
      '......ffff......',
      '................',
      '................',
    ],
  },
  meetingTable: {
    rows: [
      '................',
      '..KKK..KKK..KK..',
      '..KaK..KaK..Kf..',
      '.wwwwwwwwwwwwww.',
      '.wWWWWWWWWWWWWw.',
      '.wWwwwwwwwwwwWw.',
      '.wWwwkkwwwwwwWw.',
      '.wWwwkAwwwwwwWw.',
      '.wWwwwwwwwwwwWw.',
      '.wWWWWWWWWWWWWw.',
      '.wwwwwwwwwwwwww.',
      '..KfK..KaK..Ka..',
      '..KKK..KKK..KK..',
      '................',
      '................',
      '................',
    ],
  },
  modernDesk: {
    rows: [
      '................',
      '...kkkkkkkkkk...',
      '...kaaaaaaaak...',
      '...kaAAAAAAak...',
      '...kaAAAAAAak...',
      '...kkkkkkkkkk...',
      '.......kk.......',
      'wwwwwwwwwwwwwwww',
      'wWWWWWWWWWWWWWWw',
      'wWWKKKKKKKWWfWWw',
      'wWWWWWWWWWWWWWWw',
      'wwwwwwwwwwwwwwww',
      '.m............m.',
      '.m.....nn.....m.',
      '......nnnn......',
      '.......nn.......',
    ],
  },
  coffeeBar: {
    rows: [
      'MMMMMMMMMMMMMMMM',
      'MkkkkMMMMMMwwwMM',
      'MkfrkMMMMMwnnnwM',
      'MkkkkMMMMMwnnnwM',
      'MkMMkMMMMMMwwwMM',
      'MkkkkMMMMMMMMMMM',
      'nnnnnnnnnnnnnnnn',
      'nNNNNNNNNNNNNNNn',
      'nNnnnnnnnnnnnnNn',
      'nNnnnnnnnnnnnnNn',
      'nNnnnnnnnnnnnnNn',
      'nNnnnnnnnnnnnnNn',
      'nNnnnnnnnnnnnnNn',
      'nNNNNNNNNNNNNNNn',
      'nnnnnnnnnnnnnnnn',
      'kkkkkkkkkkkkkkkk',
    ],
  },
  screen: {
    rows: [
      'wwwwwwwwwwwwwwww',
      'wkkkkkkkkkkkkkkw',
      'wknnnnnnnnnnnnkw',
      'wknwnwwwnaaannkw',
      'wknnnnnnnnaannkw',
      'wknffnnnnnnannkw',
      'wknffnaannnnnnkw',
      'wknffnaanffnnnkw',
      'wknnnnnnnnnnnnkw',
      'wkkkkkkkkkkkkkkw',
      'wwwwwwwkkwwwwwww',
      'WWWWWWWkkWWWWWWW',
      'WWWWWWWWWWWWWWWW',
      'WWWWWWWWWWWWWWWW',
      'WWWWWWWWWWWWWWWW',
      'MMMMMMMMMMMMMMMM',
    ],
  },
  umbrella: {
    rows: [
      '................',
      '.....rrwwrr.....',
      '...rrrwwwwrrr...',
      '..rrrrwwwwrrrr..',
      '.wwwwrrrrrrwwww.',
      'wwwwwrrrrrrwwwww',
      '.......bb.......',
      '.......bb.......',
      '.......bb.......',
      '.......bb.......',
      '.......bb.......',
      '.......bb.......',
      '.......bb.......',
      '......UbbU......',
      '.....UUUUUU.....',
      '................',
    ],
  },
  towel: {
    rows: [
      '................',
      '................',
      '..aaaaaaaaaaaa..',
      '..wwwwwwwwwwww..',
      '..aaaaaaaaaaaa..',
      '..wwwwwwwwwwww..',
      '..aaaaaaaaaaaa..',
      '..wwwwwwwwwwww..',
      '..aaaaaaaaaaaa..',
      '..wwwwwwwwwwww..',
      '..aaaaaaaaaaaa..',
      '..wwwwwwwwwwww..',
      '..aaaaaaaaaaaa..',
      '................',
      '................',
      '................',
    ],
  },
  bench: {
    rows: [
      '................',
      '................',
      '................',
      'iiiiiiiiiiiiiiii',
      'BBBBBBBBBBBBBBBB',
      'iiiiiiiiiiiiiiii',
      'BBBBBBBBBBBBBBBB',
      '................',
      'iiiiiiiiiiiiiiii',
      'iiiiiiiiiiiiiiii',
      'BBBBBBBBBBBBBBBB',
      '.kk..........kk.',
      '.kk..........kk.',
      '................',
      '................',
      '................',
    ],
  },
  // The Turia's retaining wall: pale stone with a dark shadow at the foot, so the park reads as sunken.
  bankWall: {
    rows: [
      'MMMMMMMMMMMMMMMM',
      'WWWWWWWWWWWWWWWW',
      'cCcccCcccCcccCcc',
      'CCCCCCCCCCCCCCCC',
      'ccCcccCcccCcccCc',
      'CCCCCCCCCCCCCCCC',
      'cCcccCcccCcccCcc',
      'CCCCCCCCCCCCCCCC',
      'ccCcccCcccCcccCc',
      'CCCCCCCCCCCCCCCC',
      'cCcccCcccCcccCcc',
      'CCCCCCCCCCCCCCCC',
      'KKKKKKKKKKKKKKKK',
      'GGGGGGGGGGGGGGGG',
      'GGGGGGGGGGGGGGGG',
      'gggggggggggggggg',
    ],
  },
  stairs: {
    rows: Array.from({ length: 16 }, (_, y) =>
      y % 4 === 3 ? solidRow('C') : y % 4 === 0 ? solidRow('w') : solidRow('c'),
    ),
  },
  agora: {
    rows: Array.from({ length: 16 }, (_, y) =>
      y < 3 ? (y === 0 ? solidRow('w') : 'AeAAeAAeAAeAAeAA') : y === 15 ? solidRow('K') : 'pPwpppPwpppPwppp',
    ),
  },
  cac: {
    rows: Array.from({ length: 16 }, (_, y) =>
      y < 4 ? 'wwWwwwWwwwWwwwWw' : y < 8 ? 'wWAAwWAAwWAAwWAA' : y === 15 ? solidRow('M') : 'wWkkwWkkwWkkwWkk',
    ),
  },
  oldStone: {
    rows: Array.from({ length: 16 }, (_, y) =>
      y % 4 === 3 ? solidRow('U') : y % 8 < 4 ? 'CCCUCCCCCCCUCCCC' : 'CCCCCCCUCCCCCCCU',
    ),
    pal: { C: [196, 172, 130, 255], U: [150, 130, 96, 255] },
  },
  plumTree: {
    rows: [
      '................',
      '.....dddddd.....',
      '...ddGGGGGGdd...',
      '..dGGGvGGGGGGd..',
      '.dGGGGGGGvGGGGd.',
      '.dGvGGGGGGGGvGd.',
      'dGGGGGvGGGGGGGGd',
      'dGGGGGGGGGvGGGGd',
      'dGvGGGGGGGGGGvGd',
      '.dGGGGvGGGGGGGd.',
      '.dGGGGGGGvGGGGd.',
      '..ddGGGGGGGGdd..',
      '....dddbbddd....',
      '.......bb.......',
      '.......bb.......',
      '......BBBB......',
    ],
  },
  // Estació del Nord: orange modernist façade with a band of glazed tiles and an orange.
  stationFacade: {
    rows: [
      'oooooooooooooooo',
      'oRoooooooooooRoo',
      'oooooggoooooooo'.padEnd(16, 'o'),
      'oooogooggoooooooo'.slice(0, 16),
      'ooooooggoooooooo',
      'yyyyyyyyyyyyyyyy',
      'awawawawawawawaw',
      'yyyyyyyyyyyyyyyy',
      'ooRRRRooooRRRRoo',
      'ooRAARooooRAARoo',
      'ooRAARooooRAARoo',
      'ooRAARooooRAARoo',
      'ooRRRRooooRRRRoo',
      'oooooooooooooooo',
      'oooooooooooooooo',
      'RRRRRRRRRRRRRRRR',
    ],
    pal: { o: [232, 120, 52, 255], g: [60, 140, 60, 255] },
  },
  boat: {
    rows: [
      'eeeeeeeweeeeeeee',
      'eeeeeeewweeeeeee',
      'eeeeeeewwweeeeee',
      'eeeeeeewwwweeeee',
      'eeeeeeewwwwweeee',
      'eeeeeeeKeeeeeeee',
      'eeewwwwwwwwwweee',
      'eeewrrrrrrrrweee',
      'eeeewwwwwwwweeee',
      'eeeeewwwwwweeeee',
      'eeeeeeeeeeeeeeee',
      'eeeeeeeeeeeeeeee',
      'eeAAeeeeeeeeeeee',
      'eeeeeeeeeeeAAeee',
      'EEEEEEEEEEEEEEEE',
      'EEEEEEEEEEEEEEEE',
    ],
  },
  stoneBridge: {
    rows: Array.from({ length: 16 }, (_, x) => x).map((y) =>
      y < 2 || y > 13
        ? solidRow('U')
        : y === 2 || y === 13
          ? solidRow('K')
          : y % 4 === 0
            ? 'cCccccCcccccCccc'
            : solidRow('c'),
    ),
    pal: { c: [206, 190, 160, 255], C: [176, 160, 130, 255], U: [150, 130, 96, 255] },
  },
  officeWall: {
    rows: Array.from({ length: 16 }, (_, y) =>
      y >= 12 ? solidRow(y === 12 ? 'f' : y < 15 ? 'n' : 'N') : solidRow('w'),
    ),
  },
  flatRoof: {
    rows: Array.from({ length: 16 }, (_, y) =>
      y === 0
        ? solidRow('C')
        : y === 6
          ? '..KK........mm..'.replace(/\./g, 'c')
          : y === 7
            ? '..KK........mm..'.replace(/\./g, 'c')
            : solidRow('c'),
    ),
    pal: { c: [216, 200, 176, 255], C: [180, 164, 140, 255] },
  },
  greyRoof: {
    rows: Array.from({ length: 16 }, (_, y) => (y % 4 === 0 ? solidRow('K') : 'mmmMmmmmmmmMmmmm')),
  },
  // L'Assut de l'Or: the white harp bridge's mast and cables (from the reference photo).
  assut: {
    rows: [
      'wwW.............',
      '.wwW..........k.',
      '..wwW.......kk..',
      '...wwW....kk....',
      '....wwW.kk......',
      '.....wwWk.......',
      '......wwW.......',
      '.....k.wwW......',
      '....k...wwW.....',
      '...k.....wwW....',
      '..k.......wwW...',
      '.k.........wwW..',
      'cccccccccccccccc',
      'WWWWWWWWWWWWWWWW',
      'MMMMMMMMMMMMMMMM',
      'MMMMMMMMMMMMMMMM',
    ].map((r) => r.replace(/\./g, 'e')),
    pal: { e: [200, 225, 245, 255], c: [206, 190, 160, 255] },
  },
  bullring: {
    rows: Array.from({ length: 16 }, (_, y) =>
      y < 2 ? solidRow('t') : y === 15 ? solidRow('R') : y % 7 < 4 ? 'tRRtttRRtttRRttt' : solidRow('t'),
    ),
    pal: { t: [214, 150, 100, 255] },
  },
  lamp: {
    rows: [
      '................',
      '......kkkk......',
      '.....kyyyyk.....',
      '.....kyyyyk.....',
      '......kkkk......',
      '.......kk.......',
      '.......kk.......',
      '.......kk.......',
      '.......kk.......',
      '.......kk.......',
      '.......kk.......',
      '.......kk.......',
      '.......kk.......',
      '......kkkk......',
      '.....kkkkkk.....',
      '................',
    ],
  },
  dryGrass: {
    rows: Array.from({ length: 16 }, (_, y) =>
      y % 5 === 0
        ? 'dddhdddddhdddhdd'
        : y % 5 === 1
          ? 'ddhhdddhdhhddhdd'
          : y % 5 === 2
            ? 'dhdhdddhdhdhdhdd'
            : solidRow('d'),
    ),
    pal: { d: [212, 180, 120, 255], h: [170, 150, 70, 255] },
  },
  wave: {
    rows: Array.from({ length: 16 }, (_, y) =>
      y === 4
        ? 'eewwweeeeeewwwee'
        : y === 5
          ? 'ewweewweewweewwe'
          : y === 11
            ? 'eeeeeewwweeeeeee'
            : solidRow('e'),
    ),
  },
  // The mystery door in the office's back wall (the way to the story realm): a violet arched door with a "?".
  mysteryDoor: {
    rows: [
      'wwwwwwwwwwwwwwww',
      'wwwwkkkkkkkkwwww',
      'wwwkPPPPPPPPkwww',
      'wwkPpppppppppkww',
      'wwkPpppyyppppkww',
      'wwkPppyppyppPkww',
      'wwkPpppppyppPkww',
      'wwkPppppyppPPkww',
      'wwkPpppyyppPPkww',
      'wwkPpppppppPPkww',
      'wwkPpppyyppPPkww',
      'wwkPpppppppyPkww',
      'nnkPpppppppPPknn',
      'nnkPPPPPPPPPPknn',
      'nnkkkkkkkkkkkknn',
      'NNNNNNNNNNNNNNNN',
    ],
  },
  // A stop on the story map's path: a round stone marker on the sandy path.
  storyNode: {
    rows: [
      'uuuuuuuuuuuuuuuu',
      'uuuuuUUUUUUuuuuu',
      'uuuUUkkkkkkUUuuu',
      'uuUkkMMMMMMkkUuu',
      'uuUkMwwMMMMMMkUu',
      'uUkMwwMMMMMMMmkU',
      'uUkMwMMMMMMMMmkU',
      'uUkMMMMMMMMMMmkU',
      'uUkMMMMMMMMMMmkU',
      'uUkMMMMMMMMMmmkU',
      'uUkmMMMMMMMmmmkU',
      'uuUkmmMMMMmmmkUu',
      'uuUkkmmmmmmkkUuu',
      'uuuUUkkkkkkUUuuu',
      'uuuuuUUUUUUuuuuu',
      'uuuuuuuuuuuuuuuu',
    ],
    pal: { u: [240, 216, 160, 255], U: [214, 188, 128, 255] },
  },
};

/** Ids of the extra tiles that block (`solid = true`). */
export const EXTRA_SOLID: number[] = [
  XT.sea,
  XT.rails,
  XT.orangeTree,
  XT.palm,
  XT.whiteHouse,
  XT.creamHouse,
  XT.industrial,
  XT.industrialWindows,
  XT.ahoraFacade,
  XT.logoA,
  XT.logoB,
  XT.logoC,
  XT.shutter,
  XT.brick,
  XT.metroSign,
  XT.train,
  XT.glass,
  XT.sofa,
  XT.plant,
  XT.meetingTable,
  XT.modernDesk,
  XT.coffeeBar,
  XT.screen,
  XT.umbrella,
  XT.bench,
  XT.bankWall,
  XT.agora,
  XT.cac,
  XT.oldStone,
  XT.plumTree,
  XT.stationFacade,
  XT.boat,
  XT.officeWall,
  XT.flatRoof,
  XT.greyRoof,
  XT.assut,
  XT.bullring,
  XT.lamp,
  XT.wave,
  XT.mysteryDoor,
];

/** Ids of the extra tiles that start encounters (`encounter = true`): the huerta's crops and the dry scrub. */
export const EXTRA_ENCOUNTER: number[] = [XT.onion, XT.lettuce, XT.eggplant, XT.dryGrass];

/** Draw one extra tile's 16 × 16 grid. */
function drawPixelTile(name: string, tile: PixelTile): Pix {
  const p = new Pix(16, 16);
  if (tile.rows.length !== 16) throw new Error(`world tile ${name}: ${tile.rows.length} rows, expected 16`);
  tile.rows.forEach((row, y) => {
    if (row.length !== 16)
      throw new Error(`world tile ${name}: row ${y} has ${row.length} pixels, expected 16`);
    [...row].forEach((ch, x) => {
      if (ch === '.') return;
      const c = tile.pal?.[ch] ?? C[ch];
      if (!c) throw new Error(`world tile ${name}: unknown colour "${ch}"`);
      p.set(x, y, c);
    });
  });
  return p;
}

/** The extra tiles in tileset order (keys `x:<name>`), appended to `world.png` after the variants. */
export const EXTRA_TILES: TileArt[] = EXTRA_NAMES.map((name) => ({
  key: `x:${name}`,
  draw: () => drawPixelTile(name, TILES[name]),
}));
