/**
 * Matching raw offer rows onto the product catalogue.
 *
 * Real feeds give a product name and a pack size as printed on the label. Two
 * things have to happen: recognise the products the app already knows (so the
 * recipes keep working and get real prices), and create clean catalogue entries
 * for everything else.
 */
import type { Allergen, Product, ProductCategory } from '../../../src/types';

const CATEGORY_KEYWORDS: [ProductCategory, RegExp][] = [
  ['Obst & Gemüse', /apfel|äpfel|banane|tomate|gurke|erdapfel|kartoffel|zwiebel|karotte|paprika|zucchini|champignon|pilz|spinat|knoblauch|zitrone|avocado|erdbeer|salat|obst|gemüse|birne|traube|melone|kraut|lauch|sellerie/i],
  ['Fleisch & Fisch', /huhn|hühner|hendl|faschiert|schnitzel|gulasch|rind|schwein|pute|truthahn|lachs|thunfisch|fisch|wurst|würstel|schinken|speck|salami|steak|kotelett/i],
  ['Milchprodukte', /milch|joghurt|butter|käse|gouda|bergkäse|topfen|obers|sahne|ei\b|eier|mozzarella|rahm|frischkäse|skyr|haferdrink|sojadrink|mandeldrink/i],
  ['Brot & Gebäck', /brot|semmel|weckerl|toast|croissant|gebäck|kipferl|baguette|striezel|brioche/i],
  ['Tiefkühl', /tk-|tiefkühl|gefroren|eis\b|pizza tk/i],
  ['Getränke', /wasser|saft|limonade|cola|bier|wein|kaffee|tee|energy|smoothie|spritzer/i],
  ['Süßes & Snacks', /schokolade|keks|riegel|chips|salzstang|snack|zucker|bonbon|gummibär|studentenfutter|nüsse|kuchen|torte/i],
  ['Vorratskammer', /nudel|spaghetti|pasta|reis|mehl|öl|essig|tomaten|linsen|kichererbsen|bohnen|polenta|kokosmilch|erdnussbutter|honig|hafer|gewürz|sauce|dose|konserve|müsli|marmelade/i],
];

const ALLERGEN_KEYWORDS: [Allergen, RegExp][] = [
  ['gluten', /mehl|brot|semmel|toast|nudel|spaghetti|pasta|weizen|dinkel|gerste|roggen|hafer|bier|griess|grieß|paniert|kipferl|croissant|keks|kuchen/i],
  ['laktose', /milch|joghurt|butter|käse|obers|sahne|topfen|rahm|mozzarella|frischkäse|schlagobers|skyr/i],
  ['nuesse', /nuss|nüsse|mandel|hasel|walnuss|cashew|pistazie|erdnuss|studentenfutter/i],
  ['ei', /\bei\b|eier|mayonnaise|eiernudel/i],
  ['fisch', /fisch|lachs|thunfisch|forelle|hering|sardine|garnele/i],
  ['soja', /soja|tofu|edamame/i],
];

const NON_VEGAN = /fleisch|huhn|hühner|hendl|rind|schwein|pute|wurst|würstel|schinken|speck|salami|fisch|lachs|thunfisch|milch|joghurt|butter|käse|obers|sahne|topfen|rahm|mozzarella|honig|\bei\b|eier|gelatine/i;

const EMOJI_BY_CATEGORY: Record<ProductCategory, string> = {
  'Obst & Gemüse': '🥬',
  'Fleisch & Fisch': '🥩',
  Milchprodukte: '🥛',
  'Brot & Gebäck': '🍞',
  Vorratskammer: '🥫',
  Getränke: '🥤',
  Tiefkühl: '🧊',
  'Süßes & Snacks': '🍫',
};

export const normaliseName = (value: string): string =>
  value
    .toLowerCase()
    .replace(/ä/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const STOP_WORDS = new Set([
  'bio', 'frisch', 'aus', 'der', 'die', 'das', 'mit', 'ohne', 'gr', 'stk', 'kg', 'ml',
  'osterreich', 'osterreichisch', 'packung', 'stuck', 'je', 'ca', 'g', 'l',
]);

/** "freiland" vs "freilandhaltung": one token is a prefix of the other. */
const isPrefixOf = (a: string, b: string): boolean => {
  if (a === b) return false;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  return short.length >= 5 && long.startsWith(short);
};

const tokens = (value: string): string[] =>
  normaliseName(value)
    .split(' ')
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));

/**
 * Pack size as printed → grams (or millilitres).
 * Understands "500 g", "1,5 kg", "6 Stk", "3 x 80 g", "1 l".
 */
export const parsePackSize = (
  unit: string | undefined,
  productName = '',
): { baseGrams: number; pieceGrams?: number; unitLabel: string } => {
  const source = `${unit ?? ''} ${productName}`.replace(',', '.').toLowerCase();

  const multi = source.match(/(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*(kg|g|ml|l)\b/);
  if (multi) {
    const count = Number(multi[1]);
    const size = Number(multi[2]) * unitFactor(multi[3]);
    return { baseGrams: count * size, unitLabel: `${count} x ${multi[2]} ${multi[3]}` };
  }

  const single = source.match(/(\d+(?:\.\d+)?)\s*(kg|g|ml|l)\b/);
  if (single) {
    const grams = Number(single[1]) * unitFactor(single[2]);
    return { baseGrams: grams, unitLabel: `${single[1].replace('.', ',')} ${single[2]}` };
  }

  const pieces = source.match(/(\d+)\s*(stk|stück|st\b)/);
  if (pieces) {
    const count = Number(pieces[1]);
    // no weight given: assume a 100 g piece so per-gram maths stays sane
    return { baseGrams: count * 100, pieceGrams: 100, unitLabel: `${count} Stk` };
  }

  return { baseGrams: 1000, pieceGrams: 1000, unitLabel: unit?.trim() || '1 Stk' };
};

const unitFactor = (unit: string): number => (unit === 'kg' || unit === 'l' ? 1000 : 1);

export const guessCategory = (name: string, hint?: string): ProductCategory => {
  const haystack = `${hint ?? ''} ${name}`;
  const hit = CATEGORY_KEYWORDS.find(([, pattern]) => pattern.test(haystack));
  return hit ? hit[0] : 'Vorratskammer';
};

export const guessAllergens = (name: string): Allergen[] =>
  ALLERGEN_KEYWORDS.filter(([, pattern]) => pattern.test(name)).map(([allergen]) => allergen);

export const guessVegan = (name: string, category?: ProductCategory): boolean => {
  if (category === 'Fleisch & Fisch') return false;
  if (category === 'Milchprodukte') return /drink|pflanzlich|vegan|soja|hafer|mandel/i.test(name);
  return !NON_VEGAN.test(name);
};

/**
 * Product catalogue that grows as offers come in.
 *
 * Seeded with the products the app ships (so recipes stay linked), then extended
 * with everything a feed brings along.
 */
export class ProductCatalogue {
  private readonly byId = new Map<string, Product>();
  private readonly byName = new Map<string, Product>();
  private readonly byTokens: { product: Product; tokens: Set<string> }[] = [];
  private created = 0;

  constructor(seed: Product[]) {
    seed.forEach((product) => this.register(product));
  }

  private register(product: Product): void {
    this.byId.set(product.id, product);
    this.byName.set(normaliseName(product.name), product);
    this.byTokens.push({ product, tokens: new Set(tokens(product.name)) });
  }

  /**
   * Best match for a raw product name, or null when nothing is close enough.
   *
   * Real feeds prefix the brand ("SPAR Premium Hühnerbrustfilet", "Zurück zum
   * Ursprung Bergkäse"), so the decisive test is whether the catalogue name is
   * contained in the feed name; a plain overlap score decides the rest.
   */
  match(rawName: string): Product | null {
    const exact = this.byName.get(normaliseName(rawName));
    if (exact) return exact;

    const wanted = tokens(rawName);
    if (wanted.length === 0) return null;

    let best: Product | null = null;
    let bestScore = 0;

    this.byTokens.forEach(({ product, tokens: productTokens }) => {
      if (productTokens.size === 0) return;

      let exact = 0;
      let fuzzy = 0;
      productTokens.forEach((token) => {
        if (wanted.includes(token)) exact += 1;
        else if (wanted.some((candidate) => isPrefixOf(candidate, token))) fuzzy += 1;
      });
      if (exact + fuzzy === 0) return;

      // The catalogue name is fully contained in the feed name and at least one
      // token matched exactly → that is our match; the longest such name wins.
      // A prefix-only "match" (hafer ~ haferdrink) never qualifies on its own.
      const fullyCovered = exact + fuzzy === productTokens.size && exact >= 1;
      const score = fullyCovered
        ? 1 + productTokens.size / 100
        : (exact + fuzzy * 0.5) / Math.max(productTokens.size, wanted.length);

      if (score > bestScore) {
        bestScore = score;
        best = product;
      }
    });

    return bestScore >= 0.6 ? best : null;
  }

  /** Match, or create and remember a new catalogue entry. */
  resolve(input: {
    name: string;
    unit?: string;
    category?: string;
    shelfPrice: number;
  }): Product {
    const matched = this.match(input.name);
    if (matched) return matched;

    const { baseGrams, pieceGrams, unitLabel } = parsePackSize(input.unit, input.name);
    const category = guessCategory(input.name, input.category);
    const id = `p-auto-${String(++this.created).padStart(4, '0')}`;

    const product: Product = {
      id,
      name: input.name.trim(),
      category,
      unit: unitLabel,
      baseGrams,
      ...(pieceGrams ? { pieceGrams } : {}),
      basePrice: Number(input.shelfPrice.toFixed(2)),
      emoji: EMOJI_BY_CATEGORY[category],
      allergens: guessAllergens(input.name),
      vegan: guessVegan(input.name, category),
    };

    this.register(product);
    return product;
  }

  all(): Product[] {
    return Array.from(this.byId.values());
  }

  createdCount(): number {
    return this.created;
  }
}
