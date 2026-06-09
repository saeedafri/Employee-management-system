import { expect } from 'chai';
import { computeStatutoryContributions, schemeManagedComponentCodes } from '../../src/utils/statutoryCalculation.js';

describe('statutoryCalculation', () => {
  const schemes = [{
    code: 'IN_EPF',
    name: 'Employees\' Provident Fund',
    wageBaseTag: 'PF_WAGE',
    wageCeiling: 1500000,
    employee: { rate: 12, component: 'PF' },
    employer: { rate: 12, component: 'PF_ER' },
  }];

  it('computes PF from tagged earnings with wage ceiling', () => {
    const componentByCode = new Map([
      ['BASIC', { code: 'BASIC', statutoryTag: 'PF_WAGE' }],
      ['HRA', { code: 'HRA', statutoryTag: null }],
    ]);
    const earnings = [
      { code: 'BASIC', name: 'Basic', amount: 50000, taxable: true },
      { code: 'HRA', name: 'HRA', amount: 20000, taxable: true },
    ];
    const { statutoryDeductions, employerContributions } = computeStatutoryContributions(
      earnings, componentByCode, schemes,
    );
    expect(statutoryDeductions).to.have.length(1);
    expect(statutoryDeductions[0].code).to.equal('PF');
    expect(statutoryDeductions[0].amount).to.equal(1800);
    expect(employerContributions[0].code).to.equal('PF_ER');
    expect(employerContributions[0].amount).to.equal(1800);
  });

  it('excludes untagged earnings from wage base', () => {
    const componentByCode = new Map([['HRA', { code: 'HRA', statutoryTag: null }]]);
    const earnings = [{ code: 'HRA', name: 'HRA', amount: 50000, taxable: true }];
    const result = computeStatutoryContributions(earnings, componentByCode, schemes);
    expect(result.statutoryDeductions).to.have.length(0);
    expect(result.employerContributions).to.have.length(0);
  });

  it('schemeManagedComponentCodes collects employee and employer component codes', () => {
    const { employeeCodes, employerCodes } = schemeManagedComponentCodes(schemes);
    expect(employeeCodes.has('PF')).to.be.true;
    expect(employerCodes.has('PF_ER')).to.be.true;
  });
});
