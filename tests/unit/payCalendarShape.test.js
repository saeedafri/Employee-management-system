import { expect } from 'chai';
import { fmtPayCalendar, normalizePeriodAnchor, payCalendarInputToDb } from '../../src/utils/payCalendarShape.js';

describe('payCalendarShape', () => {
  it('normalizePeriodAnchor maps MONTH_START and legacy strings to 1', () => {
    expect(normalizePeriodAnchor('MONTH_START')).to.equal(1);
    expect(normalizePeriodAnchor(null)).to.equal(1);
    expect(normalizePeriodAnchor(5)).to.equal(5);
    expect(normalizePeriodAnchor(99)).to.equal(28);
    expect(normalizePeriodAnchor(0)).to.equal(1);
  });

  it('fmtPayCalendar returns numeric periodAnchor', () => {
    const out = fmtPayCalendar({
      id: 'c1', name: 'Monthly', paySchedule: 'MONTHLY', periodAnchor: 'MONTH_START',
      createdAt: new Date(), updatedAt: new Date(),
    });
    expect(out.periodAnchor).to.be.a('number');
    expect(out.periodAnchor).to.equal(1);
  });

  it('payCalendarInputToDb stores normalized periodAnchor as string', () => {
    const db = payCalendarInputToDb({ name: 'X', code: 'X', frequency: 'MONTHLY', periodAnchor: 10 });
    expect(db.periodAnchor).to.equal('10');
  });
});
