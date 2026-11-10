import { describe, expect, it } from 'vitest';
import { parseNotes } from './parser';

describe('parseNotes', () => {
  it('parses basic expense notes with commas', () => {
    const input = 'grab 25k, nasi padang 18k, pulsa 50k';
    const result = parseNotes(input);

    expect(result.unparsed).toEqual([]);
    expect(result.items).toHaveLength(3);
    expect(result.items[0]).toMatchObject({ name: 'grab', amount: 25000 });
    expect(result.items[1]).toMatchObject({ name: 'nasi padang', amount: 18000 });
    expect(result.items[2]).toMatchObject({ name: 'pulsa', amount: 50000 });
    expect(result.items[0].id).toBeDefined();
  });

  it('splits on newlines and semicolons', () => {
    const input = 'grab 25k\nnasi padang 18k; pulsa 50k\r\nkopi 15k';
    const result = parseNotes(input);

    expect(result.unparsed).toEqual([]);
    expect(result.items).toHaveLength(4);
    expect(result.items.map((i) => ({ name: i.name, amount: i.amount }))).toEqual([
      { name: 'grab', amount: 25000 },
      { name: 'nasi padang', amount: 18000 },
      { name: 'pulsa', amount: 50000 },
      { name: 'kopi', amount: 15000 },
    ]);
  });

  describe('amount formats', () => {
    it('handles 25k', () => {
      const result = parseNotes('grab 25k');
      expect(result.items[0]).toMatchObject({ name: 'grab', amount: 25000 });
    });

    it('handles 25rb', () => {
      const result = parseNotes('buku 25rb');
      expect(result.items[0]).toMatchObject({ name: 'buku', amount: 25000 });
    });

    it('handles 25.000', () => {
      const result = parseNotes('bensin 25.000');
      expect(result.items[0]).toMatchObject({ name: 'bensin', amount: 25000 });
    });

    it('handles 25,000', () => {
      const result = parseNotes('belanja 25,000');
      expect(result.items[0]).toMatchObject({ name: 'belanja', amount: 25000 });
    });

    it('handles 1,5jt', () => {
      const result = parseNotes('sepatu 1,5jt');
      expect(result.items[0]).toMatchObject({ name: 'sepatu', amount: 1500000 });
    });

    it('handles 1.5jt', () => {
      const result = parseNotes('sepatu 1.5jt');
      expect(result.items[0]).toMatchObject({ name: 'sepatu', amount: 1500000 });
    });

    it('handles 2jt', () => {
      const result = parseNotes('sewa 2jt');
      expect(result.items[0]).toMatchObject({ name: 'sewa', amount: 2000000 });
    });
  });

  describe('ambiguity rules', () => {
    it('treats 25.000 and 25,000 as thousands separator', () => {
      const resDot = parseNotes('item 25.000');
      const resComma = parseNotes('item 25,000');
      expect(resDot.items[0].amount).toBe(25000);
      expect(resComma.items[0].amount).toBe(25000);
    });

    it('treats 1,5jt and 1.5jt as decimal separator', () => {
      const resComma = parseNotes('item 1,5jt');
      const resDot = parseNotes('item 1.5jt');
      expect(resComma.items[0].amount).toBe(1500000);
      expect(resDot.items[0].amount).toBe(1500000);
    });

    it('treats decimal suffixes in k and rb properly', () => {
      const res1 = parseNotes('snack 1.5k');
      const res2 = parseNotes('snack 1,5rb');
      expect(res1.items[0].amount).toBe(1500);
      expect(res2.items[0].amount).toBe(1500);
    });

    it('handles larger thousands separated numbers', () => {
      const res = parseNotes('laptop 1.500.000, handphone 2,500,000');
      expect(res.items[0].amount).toBe(1500000);
      expect(res.items[1].amount).toBe(2500000);
    });
  });

  describe('item name parsing and quantity stripping', () => {
    it('strips leading 2x quantity', () => {
      const result = parseNotes('2x nasi padang 18k');
      expect(result.items[0]).toMatchObject({ name: 'nasi padang', amount: 18000 });
    });

    it('strips leading 2X and spaced 2 x quantity', () => {
      const res1 = parseNotes('2X es jeruk 5k');
      const res2 = parseNotes('2 x sate ayam 30k');
      expect(res1.items[0]).toMatchObject({ name: 'es jeruk', amount: 5000 });
      expect(res2.items[0]).toMatchObject({ name: 'sate ayam', amount: 30000 });
    });

    it('preserves numbers inside item name', () => {
      const result = parseNotes('mie ayam level 3 25k');
      expect(result.items[0]).toMatchObject({ name: 'mie ayam level 3', amount: 25000 });
    });

    it('supports amount before item name', () => {
      const result = parseNotes('25k grab, 18.000 nasi padang');
      expect(result.items[0]).toMatchObject({ name: 'grab', amount: 25000 });
      expect(result.items[1]).toMatchObject({ name: 'nasi padang', amount: 18000 });
    });
  });

  describe('unparsed handling', () => {
    it('captures lines without amount', () => {
      const result = parseNotes('grab 25k, beli makan siang, pulsa 50k');
      expect(result.items).toHaveLength(2);
      expect(result.unparsed).toEqual(['beli makan siang']);
    });

    it('captures lines without name', () => {
      const result = parseNotes('25k, 25.000, 2x 18k');
      expect(result.items).toHaveLength(0);
      expect(result.unparsed).toEqual(['25k', '25.000', '2x 18k']);
    });
  });

  describe('edge cases', () => {
    it('handles empty input', () => {
      expect(parseNotes('')).toEqual({ items: [], unparsed: [] });
      expect(parseNotes('   \n\t  ')).toEqual({ items: [], unparsed: [] });
      expect(parseNotes(',,,;;;\n')).toEqual({ items: [], unparsed: [] });
    });

    it('handles only numbers', () => {
      const res1 = parseNotes('25000');
      expect(res1.items).toEqual([]);
      expect(res1.unparsed).toEqual(['25000']);

      const res2 = parseNotes('12345\n67890');
      expect(res2.items).toEqual([]);
      expect(res2.unparsed).toEqual(['12345', '67890']);
    });

    it('handles mixed case units', () => {
      const result = parseNotes('makan 25K, pulsa 50RB, sewa 2JT, buku 1.5Jt');
      expect(result.unparsed).toEqual([]);
      expect(result.items.map((i) => ({ name: i.name, amount: i.amount }))).toEqual([
        { name: 'makan', amount: 25000 },
        { name: 'pulsa', amount: 50000 },
        { name: 'sewa', amount: 2000000 },
        { name: 'buku', amount: 1500000 },
      ]);
    });

    it('handles extra spaces', () => {
      const result = parseNotes('   grab    25k   ;   nasi   padang   18k   \n  pulsa   50k  ');
      expect(result.unparsed).toEqual([]);
      expect(result.items.map((i) => ({ name: i.name, amount: i.amount }))).toEqual([
        { name: 'grab', amount: 25000 },
        { name: 'nasi padang', amount: 18000 },
        { name: 'pulsa', amount: 50000 },
      ]);
    });
  });
});
