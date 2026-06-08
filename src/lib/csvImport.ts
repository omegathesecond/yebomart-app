// Client-side CSV import helpers for bulk product upload.
//
// We hand-roll a small RFC-4180-ish parser rather than pull in papaparse — the
// only thing we import is a flat product table, so a ~40-line state machine that
// handles quoted fields, embedded commas/newlines and "" escaping is plenty.
//
// Parsing is deliberately strict-but-loud: every row that can't be turned into a
// valid product is reported back as a `ParseRowError` (with its 1-based line in
// the file) so the UI can surface failures instead of silently dropping rows.

/** One row that passed client-side validation, shaped for `bulkImportProducts`. */
export interface ParsedProduct {
  barcode?: string;
  name: string;
  category?: string;
  costPrice: number;
  sellPrice: number;
  quantity: number;
  reorderAt: number;
  unit: string;
}

export interface ParseRowError {
  /** 1-based line number in the source file (header is line 1). */
  line: number;
  message: string;
}

export interface ParseResult {
  rows: ParsedProduct[];
  errors: ParseRowError[];
}

/** Units the API accepts (see bulkImportSchema). */
export const ALLOWED_UNITS = ['each', 'kg', 'litre', 'pack', 'box'] as const;

/** Canonical header row used for both export and the downloadable template. */
export const PRODUCT_CSV_HEADERS = [
  'barcode',
  'name',
  'category',
  'costPrice',
  'sellPrice',
  'quantity',
  'reorderAt',
  'unit',
];

/** Max rows the API accepts in a single import. */
export const MAX_IMPORT_ROWS = 500;

// Accepted header spellings per field (compared lower-cased + trimmed).
const HEADER_ALIASES: Record<keyof ParsedProduct, string[]> = {
  barcode: ['barcode', 'sku', 'code'],
  name: ['name', 'product', 'product name', 'description'],
  category: ['category'],
  costPrice: ['costprice', 'cost price', 'cost', 'buy price', 'buying price'],
  sellPrice: ['sellprice', 'sell price', 'sell', 'price', 'selling price', 'retail price'],
  quantity: ['quantity', 'qty', 'stock', 'in stock'],
  reorderAt: ['reorderat', 'reorder at', 'reorder', 'reorder level', 'min stock'],
  unit: ['unit', 'units', 'uom'],
};

/**
 * Parse raw CSV text into a table of string cells. Handles quoted fields,
 * embedded commas/newlines, "" escaping, CRLF line endings and a leading BOM.
 * Fully-blank lines are dropped.
 */
export function parseCsv(input: string): string[][] {
  let text = input;
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // strip BOM

  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\r') {
      // swallow — handled by the following \n (or EOF)
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += c;
    }
  }
  // flush trailing field/row (file not ending in newline)
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

function toInt(raw: string): number | null {
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return null;
  return n;
}

/**
 * Parse + validate a product CSV against the bulkImport schema.
 *
 * Throws if the required header columns (name, costPrice, sellPrice) are absent
 * — that's a malformed file, not a per-row problem. Otherwise every row is
 * validated and either collected into `rows` or reported in `errors`.
 */
export function parseProductCsv(text: string): ParseResult {
  const table = parseCsv(text);
  if (table.length === 0) {
    throw new Error('The file is empty.');
  }

  const header = table[0].map((h) => h.trim().toLowerCase());
  const colOf = (field: keyof ParsedProduct): number =>
    header.findIndex((h) => HEADER_ALIASES[field].includes(h));

  const idx = {
    barcode: colOf('barcode'),
    name: colOf('name'),
    category: colOf('category'),
    costPrice: colOf('costPrice'),
    sellPrice: colOf('sellPrice'),
    quantity: colOf('quantity'),
    reorderAt: colOf('reorderAt'),
    unit: colOf('unit'),
  };

  const missing = (['name', 'costPrice', 'sellPrice'] as const).filter((f) => idx[f] === -1);
  if (missing.length > 0) {
    throw new Error(
      `CSV is missing required column(s): ${missing.join(', ')}. ` +
        `Required columns are name, costPrice, sellPrice (headers are case-insensitive). ` +
        `Use "Download template" for the correct format.`,
    );
  }

  const cell = (cols: string[], i: number): string => (i >= 0 && i < cols.length ? cols[i].trim() : '');

  const rows: ParsedProduct[] = [];
  const errors: ParseRowError[] = [];

  for (let r = 1; r < table.length; r++) {
    const cols = table[r];
    const line = r + 1; // header is line 1

    const name = cell(cols, idx.name);
    if (!name) {
      errors.push({ line, message: 'Missing product name.' });
      continue;
    }

    const costRaw = cell(cols, idx.costPrice);
    const cost = Number(costRaw);
    if (costRaw === '' || !Number.isFinite(cost) || cost < 0) {
      errors.push({ line, message: `"${name}": costPrice must be a number ≥ 0 (got "${costRaw}").` });
      continue;
    }

    const sellRaw = cell(cols, idx.sellPrice);
    const sell = Number(sellRaw);
    if (sellRaw === '' || !Number.isFinite(sell) || sell < 0) {
      errors.push({ line, message: `"${name}": sellPrice must be a number ≥ 0 (got "${sellRaw}").` });
      continue;
    }

    const qtyRaw = cell(cols, idx.quantity);
    let quantity = 0;
    if (qtyRaw !== '') {
      const q = toInt(qtyRaw);
      if (q === null || q < 0) {
        errors.push({ line, message: `"${name}": quantity must be a whole number ≥ 0 (got "${qtyRaw}").` });
        continue;
      }
      quantity = q;
    }

    const reorderRaw = cell(cols, idx.reorderAt);
    let reorderAt = 10;
    if (reorderRaw !== '') {
      const ro = toInt(reorderRaw);
      if (ro === null || ro < 0) {
        errors.push({ line, message: `"${name}": reorderAt must be a whole number ≥ 0 (got "${reorderRaw}").` });
        continue;
      }
      reorderAt = ro;
    }

    const unitRaw = cell(cols, idx.unit).toLowerCase();
    let unit = 'each';
    if (unitRaw !== '') {
      if (!(ALLOWED_UNITS as readonly string[]).includes(unitRaw)) {
        errors.push({
          line,
          message: `"${name}": unit must be one of ${ALLOWED_UNITS.join(', ')} (got "${unitRaw}").`,
        });
        continue;
      }
      unit = unitRaw;
    }

    const barcode = cell(cols, idx.barcode);
    const category = cell(cols, idx.category);

    rows.push({
      ...(barcode ? { barcode } : {}),
      name,
      ...(category ? { category } : {}),
      costPrice: cost,
      sellPrice: sell,
      quantity,
      reorderAt,
      unit,
    });
  }

  return { rows, errors };
}
