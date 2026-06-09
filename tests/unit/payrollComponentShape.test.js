import { expect } from 'chai';
import {
  fmtComponentStatutoryFields,
  parsePayInPeriods,
  serializePayInPeriods,
} from '../../src/utils/payrollComponentShape.js';

describe('payrollComponentShape', () => {
  it('parsePayInPeriods returns array from JSON string', () => {
    expect(parsePayInPeriods('[1,2,3]')).to.deep.equal([1, 2, 3]);
    expect(parsePayInPeriods(null)).to.equal(null);
    expect(parsePayInPeriods([4, 5])).to.deep.equal([4, 5]);
  });

  it('serializePayInPeriods stores JSON string', () => {
    expect(serializePayInPeriods([1, 2])).to.equal('[1,2]');
    expect(serializePayInPeriods(null)).to.equal(null);
  });

  it('fmtComponentStatutoryFields maps DB row', () => {
    const out = fmtComponentStatutoryFields({
      statutoryTag: 'PF_WAGE',
      prorate: true,
      payInPeriods: '[6,12]',
      glAccountCode: 'GL-100',
      costCenterRule: 'DEPARTMENT',
    });
    expect(out.statutoryTag).to.equal('PF_WAGE');
    expect(out.payInPeriods).to.deep.equal([6, 12]);
    expect(out.costCenterRule).to.equal('DEPARTMENT');
  });
});
