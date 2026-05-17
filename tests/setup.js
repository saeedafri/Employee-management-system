import { expect } from 'chai';
import sinon from 'sinon';

global.expect = expect;
global.sinon = sinon;

// Suppress console logs during tests unless explicitly needed
before(function () {
  // Can be overridden per test if needed
});

afterEach(function () {
  sinon.restore();
});
