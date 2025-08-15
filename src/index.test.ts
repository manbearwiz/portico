import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { getPort, getPortFromPackageJson } from '../src/index.js';

describe('portico', () => {
  describe('getPort', () => {
    test('should generate consistent ports for the same package name', () => {
      const port1 = getPort('my-awesome-app');
      const port2 = getPort('my-awesome-app');
      expect(port1).toBe(port2);
    });

    test('should generate different ports for different package names', () => {
      const port1 = getPort('app-one');
      const port2 = getPort('app-two');
      expect(port1).not.toBe(port2);
    });

    test('should respect custom base port and range', () => {
      const port = getPort('test-app', 5000, 100);
      expect(port).toBeGreaterThanOrEqual(5000);
      expect(port).toBeLessThan(5100);
    });

    test('should handle scoped package names', () => {
      const port1 = getPort('@company/app-one');
      const port2 = getPort('@company/app-two');
      expect(port1).not.toBe(port2);
    });

    test('should throw error for invalid package name', () => {
      expect(() => getPort('')).toThrow('Package name must be a non-empty string');
      // @ts-expect-error - Testing invalid input
      expect(() => getPort(null)).toThrow('Package name must be a non-empty string');
    });

    test('should throw error for invalid base port', () => {
      expect(() => getPort('test', 100)).toThrow('Base port must be between 1024 and 65535');
      expect(() => getPort('test', 70000)).toThrow('Base port must be between 1024 and 65535');
    });

    test('should throw error for invalid range', () => {
      expect(() => getPort('test', 4200, 0)).toThrow('Port range must be between 1 and 1000');
      expect(() => getPort('test', 4200, 1001)).toThrow('Port range must be between 1 and 1000');
    });
  });

  describe('getPortFromPackageJson', () => {
    const testPackageJsonPath = path.join(import.meta.dirname || __dirname, 'test-package.json');

    beforeEach(() => {
      // Clean up any existing test file
      if (fs.existsSync(testPackageJsonPath)) {
        fs.unlinkSync(testPackageJsonPath);
      }
    });

    afterEach(() => {
      // Clean up test file
      if (fs.existsSync(testPackageJsonPath)) {
        fs.unlinkSync(testPackageJsonPath);
      }
    });

    test('should read package name from package.json and generate port', () => {
      const packageData = { name: 'test-package', version: '1.0.0' };
      fs.writeFileSync(testPackageJsonPath, JSON.stringify(packageData, null, 2));

      const port = getPortFromPackageJson(testPackageJsonPath);
      const expectedPort = getPort('test-package');
      expect(port).toBe(expectedPort);
    });

    test('should throw error if package.json does not exist', () => {
      expect(() => getPortFromPackageJson('/nonexistent/package.json')).toThrow(
        'package.json not found'
      );
    });

    test('should throw error if package.json has no name field', () => {
      const packageData = { version: '1.0.0' };
      fs.writeFileSync(testPackageJsonPath, JSON.stringify(packageData, null, 2));

      expect(() => getPortFromPackageJson(testPackageJsonPath)).toThrow(
        'package.json must have a "name" field'
      );
    });

    test('should throw error if package.json is invalid JSON', () => {
      fs.writeFileSync(testPackageJsonPath, '{ invalid json }');

      expect(() => getPortFromPackageJson(testPackageJsonPath)).toThrow(
        'Failed to parse package.json'
      );
    });
  });
});
