import { describe, it, expect } from 'vitest';
import { javaMajor, selectDevice } from '../scripts/android.mjs';
describe('Android build/install tool boundaries', () => {
 it('reads Java 21 versions and distinguishes incompatible runtimes', () => {
  expect(javaMajor('openjdk version "21.0.12.1" 2026-08-18')).toBe(21);
  expect(javaMajor('openjdk version "17.0.20"')).toBe(17);
  expect(javaMajor('not a runtime')).toBe(0);
 });
 it('uses the one authorized device and requires a serial when there are several', () => {
  expect(selectDevice('List of devices attached\nphone123\tdevice\n')).toBe('phone123');
  expect(() => selectDevice('a\tdevice\nb\tdevice\n')).toThrow(/serial/i);
  expect(selectDevice('a\tdevice\nb\tdevice\n', 'b')).toBe('b');
 });
 it('never installs to an offline, unauthorized or absent requested device', () => {
  expect(() => selectDevice('a\tunauthorized\n')).toThrow();
  expect(() => selectDevice('a\tdevice\nb\toffline\n', 'b')).toThrow();
  expect(() => selectDevice('a\tdevice\n', 'missing')).toThrow();
 });
});
