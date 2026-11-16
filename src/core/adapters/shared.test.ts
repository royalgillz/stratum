import { describe, expect, it } from 'vitest';
import { lifeFloor, powerDemand, sectorId } from './shared.ts';

describe('adapter shared helpers', () => {
  // @spec ADAPT-POLICY-005
  it('names sector claims s00 to s23 and rejects other indexes', () => {
    expect(sectorId(0)).toBe('s00');
    expect(sectorId(7)).toBe('s07');
    expect(sectorId(23)).toBe('s23');
    expect(() => sectorId(24)).toThrow(RangeError);
    expect(() => sectorId(-1)).toThrow(RangeError);
    expect(() => sectorId(1.5)).toThrow(RangeError);
  });

  // @spec ADAPT-POLICY-005
  it('takes power demand at BASE_KW and the life floor at LIFE_KW per person, in MW', () => {
    expect(powerDemand(500)).toBeCloseTo(0.5, 12);
    expect(lifeFloor(500)).toBeCloseTo(0.15, 12);
    expect(powerDemand(0)).toBe(0);
  });
});
