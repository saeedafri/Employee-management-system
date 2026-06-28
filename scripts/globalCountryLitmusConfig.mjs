/**
 * Global payroll litmus — 5 countries as pure DATA (config-over-code).
 * Monetary amounts in pack definitions are ISO minor units unless noted.
 */
import {
  computeIncomeTaxFromRegime,
  computeStatutoryContributions,
} from '../src/utils/statutoryCalculation.js';

const m2 = (major, currency) => {
  const exp = { BHD: 3, JOD: 3, KWD: 3, OMR: 3, TND: 3, CLP: 0, JPY: 0, KRW: 0, VND: 0 }[currency] ?? 2;
  return Math.round(major * 10 ** exp);
};

export const LITMUS_TENANT_KEY = 'global-payroll-litmus-001';
export const LITMUS_PASSWORD = 'Password123!';
export const LITMUS_PERIOD = '2026-06';
export const LITMUS_HR_EMAIL = 'hr@global-litmus.test';

/** @type {Record<string, object>} */
export const COUNTRY_LITMUS = {
  SA: {
    reportFile: 'SAUDI_ARABIA.md',
    name: 'Saudi Arabia',
    code: 'SA',
    currency: 'SAR',
    locale: 'ar-SA',
    timezone: 'Asia/Riyadh',
    fiscalYearStartMonth: 1,
    workWeekDays: ['SUN', 'MON', 'TUE', 'WED', 'THU'],
    hoursPerDay: 8,
    annualCtcMajor: 180_000,
    employeeEmail: 'litmus.sa@global.test',
    employeeCode: 'GL-SA-001',
    wageTag: 'GOSI_WAGE',
    packVersion: '2026.1',
    pack: {
      rounding: { mode: 'NEAREST', precision: 2 },
      proration: { basis: 'CALENDAR_DAYS' },
      taxRegimes: [],
      contributionSchemes: [
        {
          code: 'SA_GOSI',
          name: 'GOSI (expatriate contribution)',
          wageBaseTag: 'GOSI_WAGE',
          wageCeiling: m2(45_000, 'SAR'),
          employee: { rate: 9.75, component: 'GOSI_EE' },
          employer: { rate: 11.75, component: 'GOSI_ER' },
        },
      ],
      localTaxes: [],
      statutoryComponents: ['GOSI_EE', 'GOSI_ER'],
    },
    sources: 'GOSI expat rates 9.75% EE / 11.75% ER; no personal income tax on employment income.',
  },
  AE: {
    reportFile: 'UAE.md',
    name: 'United Arab Emirates',
    code: 'AE',
    currency: 'AED',
    locale: 'en-AE',
    timezone: 'Asia/Dubai',
    fiscalYearStartMonth: 1,
    workWeekDays: ['SUN', 'MON', 'TUE', 'WED', 'THU'],
    hoursPerDay: 8,
    annualCtcMajor: 240_000,
    employeeEmail: 'litmus.ae@global.test',
    employeeCode: 'GL-AE-001',
    wageTag: 'EOS_WAGE',
    packVersion: '2026.1',
    pack: {
      rounding: { mode: 'NEAREST', precision: 2 },
      proration: { basis: 'CALENDAR_DAYS' },
      taxRegimes: [],
      contributionSchemes: [],
      localTaxes: [],
      statutoryComponents: [],
      gratuity: { daysPerYear: 21, monthDivisor: 30, minYears: 1 },
    },
    sources: 'UAE: no PIT on employment; EOS gratuity accrual config-only (not deducted from net pay in this litmus).',
  },
  VN: {
    reportFile: 'VIETNAM.md',
    name: 'Vietnam',
    code: 'VN',
    currency: 'VND',
    locale: 'vi-VN',
    timezone: 'Asia/Ho_Chi_Minh',
    fiscalYearStartMonth: 1,
    workWeekDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
    hoursPerDay: 8,
    annualCtcMajor: 360_000_000,
    employeeEmail: 'litmus.vn@global.test',
    employeeCode: 'GL-VN-001',
    wageTag: 'SI_WAGE',
    packVersion: '2026.1',
    pack: {
      rounding: { mode: 'NEAREST', precision: 0 },
      proration: { basis: 'CALENDAR_DAYS' },
      taxRegimes: [
        {
          code: 'VN_PIT',
          fiscalYear: '2026',
          currency: 'VND',
          standardDeduction: m2(11_000_000, 'VND'),
          slabs: [
            { from: m2(0, 'VND'), to: m2(60_000_000, 'VND'), rate: 5 },
            { from: m2(60_000_000, 'VND'), to: m2(120_000_000, 'VND'), rate: 10 },
            { from: m2(120_000_000, 'VND'), to: m2(216_000_000, 'VND'), rate: 15 },
            { from: m2(216_000_000, 'VND'), to: null, rate: 20 },
          ],
        },
      ],
      contributionSchemes: [
        {
          code: 'VN_SI',
          name: 'Social Insurance',
          wageBaseTag: 'SI_WAGE',
          wageCeiling: 4_680_000_000, // 46.8M VND/mo — stored ×100 for contribution engine parity
          employee: { rate: 8, component: 'SI_EE' },
          employer: { rate: 17.5, component: 'SI_ER' },
        },
      ],
      localTaxes: [],
      statutoryComponents: ['SI_EE', 'SI_ER', 'PIT'],
    },
    sources: 'VN PIT progressive 2026-style slabs; SI 8% EE / 17.5% ER on capped base (simplified).',
  },
  SG: {
    reportFile: 'SINGAPORE.md',
    name: 'Singapore',
    code: 'SG',
    currency: 'SGD',
    locale: 'en-SG',
    timezone: 'Asia/Singapore',
    fiscalYearStartMonth: 1,
    workWeekDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
    hoursPerDay: 8,
    annualCtcMajor: 72_000,
    employeeEmail: 'litmus.sg@global.test',
    employeeCode: 'GL-SG-001',
    wageTag: 'CPF_OW',
    packVersion: '2026.1',
    pack: {
      rounding: { mode: 'NEAREST', precision: 2 },
      proration: { basis: 'CALENDAR_DAYS' },
      taxRegimes: [],
      contributionSchemes: [
        {
          code: 'SG_CPF',
          name: 'CPF (age ≤55)',
          wageBaseTag: 'CPF_OW',
          wageCeiling: m2(6_800, 'SGD'),
          employee: { rate: 20, component: 'CPF_EE' },
          employer: { rate: 17, component: 'CPF_ER' },
        },
      ],
      localTaxes: [],
      statutoryComponents: ['CPF_EE', 'CPF_ER'],
    },
    sources: 'CPF OW ceiling SGD 6,800 (2025); EE 20% / ER 17% for ≤55 (litmus simplified).',
  },
  CA: {
    reportFile: 'CANADA.md',
    name: 'Canada',
    code: 'CA',
    currency: 'CAD',
    locale: 'en-CA',
    timezone: 'America/Toronto',
    fiscalYearStartMonth: 1,
    workWeekDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
    hoursPerDay: 8,
    annualCtcMajor: 60_000,
    employeeEmail: 'litmus.ca@global.test',
    employeeCode: 'GL-CA-001',
    wageTag: 'CPP_WAGE',
    packVersion: '2026.1',
    pack: {
      rounding: { mode: 'NEAREST', precision: 2 },
      proration: { basis: 'CALENDAR_DAYS' },
      taxRegimes: [
        {
          code: 'CA_FED',
          fiscalYear: '2026',
          currency: 'CAD',
          standardDeduction: m2(15_705, 'CAD'),
          slabs: [
            { from: m2(0, 'CAD'), to: m2(55_867, 'CAD'), rate: 15 },
            { from: m2(55_867, 'CAD'), to: m2(111_733, 'CAD'), rate: 20.5 },
            { from: m2(111_733, 'CAD'), to: m2(173_205, 'CAD'), rate: 26 },
            { from: m2(173_205, 'CAD'), to: m2(246_752, 'CAD'), rate: 29 },
            { from: m2(246_752, 'CAD'), to: null, rate: 33 },
          ],
        },
      ],
      contributionSchemes: [
        {
          code: 'CA_CPP',
          name: 'CPP',
          wageBaseTag: 'CPP_WAGE',
          wageCeiling: m2(5_000, 'CAD'),
          employee: { rate: 5.95, component: 'CPP_EE' },
          employer: { rate: 5.95, component: 'CPP_ER' },
        },
        {
          code: 'CA_EI',
          name: 'EI',
          wageBaseTag: 'CPP_WAGE',
          wageCeiling: m2(5_000, 'CAD'),
          employee: { rate: 1.64, component: 'EI_EE' },
          employer: { rate: 2.296, component: 'EI_ER' },
        },
      ],
      localTaxes: [],
      statutoryComponents: ['CPP_EE', 'CPP_ER', 'EI_EE', 'EI_ER', 'FED_TAX'],
    },
    sources: 'Federal brackets 2026 approx; CPP 5.95% / EI 1.64% EE on monthly pensionable (simplified cap).',
  },
};

export function computeExpectedLitmus(cfg) {
  const monthlyGross = cfg.annualCtcMajor / 12;
  const earnings = [{ code: 'BASIC', amount: monthlyGross, taxable: true }];
  const componentByCode = new Map([
    ['BASIC', { code: 'BASIC', statutoryTag: cfg.wageTag, taxable: true }],
  ]);
  const schemes = cfg.pack.contributionSchemes ?? [];
  const { statutoryDeductions, employerContributions } = computeStatutoryContributions(
    earnings,
    componentByCode,
    schemes,
  );
  const regime = (cfg.pack.taxRegimes ?? [])[0] ?? null;
  const annualTax = regime
    ? computeIncomeTaxFromRegime(cfg.annualCtcMajor, regime, cfg.currency)
    : 0;
  const monthlyTax = Math.round(annualTax / 12);
  const statDed = statutoryDeductions.reduce((s, d) => s + Number(d.amount ?? 0), 0);
  const net = monthlyGross - monthlyTax - statDed;
  return {
    monthlyGross,
    annualTax,
    monthlyTax,
    statutoryDeductions: statutoryDeductions.map((d) => ({ code: d.code, amount: Number(d.amount) })),
    employerContributions: employerContributions.map((d) => ({ code: d.code, amount: Number(d.amount) })),
    netMonthly: net,
  };
}
