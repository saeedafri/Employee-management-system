import { expect } from 'chai';
import {
  normalizeStatutoryComponents,
  flatBodyToPackData,
  fmtStatutoryPackRow,
} from '../../src/utils/statutoryPackShape.js';

describe('statutoryPackShape', function () {
  describe('normalizeStatutoryComponents', function () {
    it('passes through string codes', function () {
      expect(normalizeStatutoryComponents(['PF', 'PF_ER'])).to.deep.equal(['PF', 'PF_ER']);
    });

    it('extracts code from legacy objects', function () {
      expect(normalizeStatutoryComponents([{ code: 'PF' }, { code: 'PF_ER' }])).to.deep.equal(['PF', 'PF_ER']);
    });

    it('handles mixed string and object input', function () {
      expect(normalizeStatutoryComponents(['PF', { code: 'PF_ER' }])).to.deep.equal(['PF', 'PF_ER']);
    });

    it('returns empty array for non-array input', function () {
      expect(normalizeStatutoryComponents(null)).to.deep.equal([]);
      expect(normalizeStatutoryComponents('PF')).to.deep.equal([]);
    });
  });

  describe('flatBodyToPackData', function () {
    it('stores statutoryComponents as strings from string[] body', function () {
      const packData = flatBodyToPackData({
        statutoryComponents: ['PF', 'PF_ER'],
      });
      expect(packData.statutoryComponents).to.deep.equal(['PF', 'PF_ER']);
    });

    it('normalizes legacy object body before store', function () {
      const packData = flatBodyToPackData({
        statutoryComponents: [{ code: 'PF' }],
      });
      expect(packData.statutoryComponents).to.deep.equal(['PF']);
    });
  });

  describe('fmtStatutoryPackRow', function () {
    it('returns only strings even when DB has object rows', function () {
      const row = fmtStatutoryPackRow({
        id: 'pack_1',
        country: 'IN',
        version: '2026.1',
        effectiveFrom: new Date('2026-04-01'),
        effectiveTo: null,
        packData: {
          statutoryComponents: [{ code: 'PF' }, { code: 'PF_ER' }],
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      expect(row.statutoryComponents).to.deep.equal(['PF', 'PF_ER']);
      expect(row.statutoryComponents.every((c) => typeof c === 'string')).to.equal(true);
    });

    it('preserves seeded string[] from DB', function () {
      const row = fmtStatutoryPackRow({
        id: 'pack_2',
        country: 'IN',
        version: '2026.1',
        effectiveFrom: new Date('2026-04-01'),
        effectiveTo: null,
        packData: { statutoryComponents: ['PF', 'PF_ER', 'TDS'] },
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      expect(row.statutoryComponents).to.deep.equal(['PF', 'PF_ER', 'TDS']);
    });
  });
});
