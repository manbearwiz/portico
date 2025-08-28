import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import {
  analyzeImportMap,
  getPackageName,
  getPort,
  HASH,
  type HashFunction,
  REDUCERS,
  type ReducerFunction,
} from '../src/index.js';

describe('portico', () => {
  describe('HASH functions', () => {
    test('should export all hash functions', () => {
      expect(HASH).toHaveProperty('sdbm');
      expect(HASH).toHaveProperty('safe');
      expect(HASH).toHaveProperty('twin');
      expect(HASH).toHaveProperty('cascade');
      expect(HASH).toHaveProperty('double');
    });

    test('should generate consistent hashes for same input', () => {
      const testName = 'test-package';

      expect(HASH.sdbm(testName)).toBe(HASH.sdbm(testName));
      expect(HASH.safe(testName)).toBe(HASH.safe(testName));
      expect(HASH.twin(testName)).toBe(HASH.twin(testName));
      expect(HASH.cascade(testName)).toBe(HASH.cascade(testName));
      expect(HASH.double(testName)).toBe(HASH.double(testName));
    });

    test('should generate different hashes for different inputs', () => {
      const name1 = 'package-one';
      const name2 = 'package-two';

      expect(HASH.sdbm(name1)).not.toBe(HASH.sdbm(name2));
      expect(HASH.safe(name1)).not.toBe(HASH.safe(name2));
      expect(HASH.twin(name1)).not.toBe(HASH.twin(name2));
      expect(HASH.cascade(name1)).not.toBe(HASH.cascade(name2));
      expect(HASH.double(name1)).not.toBe(HASH.double(name2));
    });

    test('should generate different hashes between functions', () => {
      const testName = 'test-package';
      const hashes = [
        HASH.sdbm(testName),
        HASH.safe(testName),
        HASH.twin(testName),
        HASH.cascade(testName),
        HASH.double(testName),
      ];

      // All hashes should be different (very unlikely to collide)
      const uniqueHashes = new Set(hashes);
      expect(uniqueHashes.size).toBe(hashes.length);
    });

    test('should handle empty string', () => {
      expect(() => HASH.sdbm('')).not.toThrow();
      expect(() => HASH.safe('')).not.toThrow();
      expect(() => HASH.twin('')).not.toThrow();
      expect(() => HASH.cascade('')).not.toThrow();
      expect(() => HASH.double('')).not.toThrow();
    });

    test('should handle special characters', () => {
      const specialName = '@company/my-app-v2.0.0';
      expect(() => HASH.sdbm(specialName)).not.toThrow();
      expect(() => HASH.safe(specialName)).not.toThrow();
      expect(() => HASH.twin(specialName)).not.toThrow();
      expect(() => HASH.cascade(specialName)).not.toThrow();
      expect(() => HASH.double(specialName)).not.toThrow();
    });
  });

  describe('REDUCERS functions', () => {
    test('should export all reducer functions', () => {
      expect(REDUCERS).toHaveProperty('modulo');
      expect(REDUCERS).toHaveProperty('knuth');
      expect(REDUCERS).toHaveProperty('lcg');
    });

    test('should generate values within range', () => {
      const hash = 12345678;
      const range = 1000;

      const moduloResult = REDUCERS.modulo(hash, range);
      const knuthResult = REDUCERS.knuth(hash, range);
      const lcgResult = REDUCERS.lcg(hash, range);

      expect(moduloResult).toBeGreaterThanOrEqual(0);
      expect(moduloResult).toBeLessThan(range);
      expect(knuthResult).toBeGreaterThanOrEqual(0);
      expect(knuthResult).toBeLessThan(range);
      expect(lcgResult).toBeGreaterThanOrEqual(0);
      expect(lcgResult).toBeLessThan(range);
    });

    test('should be deterministic', () => {
      const hash = 87654321;
      const range = 500;

      expect(REDUCERS.modulo(hash, range)).toBe(REDUCERS.modulo(hash, range));
      expect(REDUCERS.knuth(hash, range)).toBe(REDUCERS.knuth(hash, range));
      expect(REDUCERS.lcg(hash, range)).toBe(REDUCERS.lcg(hash, range));
    });

    test('should handle edge case ranges', () => {
      const hash = 123456;

      // Test with range of 1
      expect(REDUCERS.modulo(hash, 1)).toBe(0);
      expect(REDUCERS.knuth(hash, 1)).toBe(0);
      expect(REDUCERS.lcg(hash, 1)).toBe(0);
    });
  });

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
      expect(() => getPort('')).toThrow(
        'Package name must be a non-empty string',
      );
      // @ts-expect-error - Testing invalid input
      expect(() => getPort(null)).toThrow(
        'Package name must be a non-empty string',
      );
    });

    test('should throw error for invalid base port', () => {
      expect(() => getPort('test', 100)).toThrow(
        'Base port must be between 1024 and 65535',
      );
      expect(() => getPort('test', 70000)).toThrow(
        'Base port must be between 1024 and 65535',
      );
    });

    test('should throw error for invalid range', () => {
      expect(() => getPort('test', 3001, 0)).toThrow(
        'Port range must be between 1 and 10000',
      );
      expect(() => getPort('test', 3001, 10001)).toThrow(
        'Port range must be between 1 and 10000',
      );
    });

    test('should detect implementation bugs in reducer functions', () => {
      // Create a mock reducer that returns out-of-range values to test safety check
      const buggyReducers = {
        ...REDUCERS,
        buggy: () => 999999, // Always returns a huge number
      };

      // Temporarily replace REDUCERS to test safety check
      const originalReducers = { ...REDUCERS };
      Object.assign(REDUCERS, buggyReducers);

      try {
        expect(() =>
          // @ts-expect-error - Testing invalid input
          getPort('test', 3000, 100, 'sdbm', 'buggy'),
        ).toThrow(
          /generated invalid port.*This indicates a bug in the implementation/,
        );
      } finally {
        // Restore original reducers
        Object.keys(REDUCERS).forEach((key) => {
          // biome-ignore lint/suspicious/noExplicitAny: test nonsense
          delete (REDUCERS as any)[key];
        });
        Object.assign(REDUCERS, originalReducers);
      }
    });

    test('should work with all hash functions', () => {
      const packageName = 'test-app';
      const hashFunctions: HashFunction[] = [
        'sdbm',
        'safe',
        'twin',
        'cascade',
        'double',
      ];

      hashFunctions.forEach((hash) => {
        const port = getPort(packageName, 3001, 1997, hash);
        expect(port).toBeGreaterThanOrEqual(3001);
        expect(port).toBeLessThan(4998);
      });
    });

    test('should work with all reducer functions', () => {
      const packageName = 'test-app';
      const reducerFunctions: ReducerFunction[] = ['modulo', 'knuth', 'lcg'];

      reducerFunctions.forEach((reducer) => {
        const port = getPort(packageName, 3001, 1997, 'twin', reducer);
        expect(port).toBeGreaterThanOrEqual(3001);
        expect(port).toBeLessThan(4998);
      });
    });

    test('should generate different ports with different hash functions', () => {
      const packageName = 'consistent-test';
      const ports = [
        getPort(packageName, 3001, 1997, 'sdbm'),
        getPort(packageName, 3001, 1997, 'safe'),
        getPort(packageName, 3001, 1997, 'twin'),
        getPort(packageName, 3001, 1997, 'cascade'),
        getPort(packageName, 3001, 1997, 'double'),
      ];

      const uniquePorts = new Set(ports);
      expect(uniquePorts).toHaveLength(5);
    });

    test('should generate different ports with different reducer functions', () => {
      const packageName = 'reducer-test';
      const ports = [
        getPort(packageName, 3001, 1997, 'twin', 'modulo'),
        getPort(packageName, 3001, 1997, 'twin', 'knuth'),
        getPort(packageName, 3001, 1997, 'twin', 'lcg'),
      ];

      const uniquePorts = new Set(ports);
      expect(uniquePorts).toHaveLength(3);
    });

    test('should use default hash and reducer when not specified', () => {
      const packageName = 'default-test';
      const defaultPort = getPort(packageName);
      const explicitPort = getPort(packageName, 3001, 1997, 'twin', 'knuth');

      expect(defaultPort).toBe(explicitPort);
    });

    test('should fallback to defaults for invalid hash/reducer', () => {
      const packageName = 'fallback-test';
      // @ts-expect-error - Testing invalid input
      const invalidHashPort = getPort(packageName, 3001, 1997, 'invalid-hash');
      const invalidReducerPort = getPort(
        packageName,
        3001,
        1997,
        'twin',
        // @ts-expect-error - Testing invalid input
        'invalid-reducer',
      );
      const validPort = getPort(packageName, 3001, 1997, 'twin', 'knuth');

      expect(invalidHashPort).toBe(validPort);
      expect(invalidReducerPort).toBe(validPort);
    });

    test('should handle extremely long package names', () => {
      const longName = 'a'.repeat(1000);
      expect(() => getPort(longName)).not.toThrow();

      const port = getPort(longName);
      expect(port).toBeGreaterThanOrEqual(3001);
      expect(port).toBeLessThan(4998);
    });

    test('should handle unicode characters', () => {
      const unicodeName = '@公司/应用程序-测试';
      expect(() => getPort(unicodeName)).not.toThrow();

      const port = getPort(unicodeName);
      expect(port).toBeGreaterThanOrEqual(3001);
      expect(port).toBeLessThan(4998);
    });

    test('should be consistent across multiple calls with same parameters', () => {
      const packageName = 'consistency-test';
      const hash: HashFunction = 'cascade';
      const reducer: ReducerFunction = 'lcg';

      const port1 = getPort(packageName, 5000, 100, hash, reducer);
      const port2 = getPort(packageName, 5000, 100, hash, reducer);
      const port3 = getPort(packageName, 5000, 100, hash, reducer);

      expect(port1).toBe(port2);
      expect(port2).toBe(port3);
    });
  });

  describe('getPackageName', () => {
    test('should return package name from package.json', () => {
      const packageName = getPackageName();
      expect(packageName).toBe('portico');
    });

    test('should throw error if package.json is not found', () => {
      expect(() => getPackageName('/nonexistent/package.json')).toThrow(
        'package.json not found',
      );
    });
  });

  describe('analyzeImportMap', () => {
    const testImportMapPath = path.join(
      import.meta.dirname || __dirname,
      'test-import-map.json',
    );

    beforeEach(() => {
      // Clean up any existing test file
      if (fs.existsSync(testImportMapPath)) {
        fs.unlinkSync(testImportMapPath);
      }
    });

    afterEach(() => {
      // Clean up test file
      if (fs.existsSync(testImportMapPath)) {
        fs.unlinkSync(testImportMapPath);
      }
    });

    test('should analyze import map and generate ports for all entries', () => {
      const importMap = {
        imports: {
          '@company/app-one': 'https://example.com/app-one.js',
          '@company/app-two': 'https://example.com/app-two.js',
          'library-a': 'https://example.com/lib-a.js',
        },
      };
      fs.writeFileSync(testImportMapPath, JSON.stringify(importMap, null, 2));

      const analysis = analyzeImportMap(testImportMapPath);

      expect(Object.values(analysis.entries)).toHaveLength(3);
      Object.entries(analysis.entries).forEach(([key, port]) => {
        expect(port).toBe(getPort(key));
        expect(port).toBeGreaterThanOrEqual(3001);
        expect(port).toBeLessThan(4998);
      });
    });

    test('should detect port collisions', () => {
      // Create packages that will likely have different ports
      const importMap = {
        imports: {
          'package-a': 'https://example.com/a.js',
          'package-b': 'https://example.com/b.js',
          'package-c': 'https://example.com/c.js',
          'package-d': 'https://example.com/d.js',
        },
      };
      fs.writeFileSync(testImportMapPath, JSON.stringify(importMap, null, 2));

      const analysis = analyzeImportMap(testImportMapPath, 3001, 10); // Small range to force collisions

      expect(Object.values(analysis.entries)).toHaveLength(4);
      expect(Object.values(analysis.ports).length).toBeLessThanOrEqual(4);
    });

    test('should throw error if import map file does not exist', () => {
      expect(() => analyzeImportMap('/nonexistent/import-map.json')).toThrow(
        'Import map file not found',
      );
    });

    test('should throw error if import map is invalid JSON', () => {
      fs.writeFileSync(testImportMapPath, '{ invalid json }');

      expect(() => analyzeImportMap(testImportMapPath)).toThrow(
        'Failed to parse import map',
      );
    });

    test('should throw error if import map has no imports field', () => {
      const invalidImportMap = { notImports: {} };
      fs.writeFileSync(
        testImportMapPath,
        JSON.stringify(invalidImportMap, null, 2),
      );

      expect(() => analyzeImportMap(testImportMapPath)).toThrow(
        'Import map must have an "imports" object',
      );
    });

    test('should handle empty import map', () => {
      const emptyImportMap = { imports: {} };
      fs.writeFileSync(
        testImportMapPath,
        JSON.stringify(emptyImportMap, null, 2),
      );

      const analysis = analyzeImportMap(testImportMapPath);

      expect(analysis.entries).toMatchInlineSnapshot(`{}`);
      expect(analysis.ports).toMatchInlineSnapshot(`{}`);
    });

    test('should work with custom hash and reducer functions', () => {
      const importMap = {
        imports: {
          'package-a': 'https://example.com/a.js',
          'package-b': 'https://example.com/b.js',
          'package-c': 'https://example.com/c.js',
        },
      };
      fs.writeFileSync(testImportMapPath, JSON.stringify(importMap, null, 2));

      const analysis1 = analyzeImportMap(
        testImportMapPath,
        3001,
        1997,
        'double',
        'lcg',
      );
      const analysis2 = analyzeImportMap(
        testImportMapPath,
        3001,
        1997,
        'safe',
        'modulo',
      );

      expect(Object.keys(analysis1.entries)).toHaveLength(3);
      expect(Object.keys(analysis2.entries)).toHaveLength(3);

      // Results should be different with different algorithms
      const ports1 = Object.values(analysis1.entries).sort();
      const ports2 = Object.values(analysis2.entries).sort();
      expect(ports1).not.toEqual(ports2);
    });

    test('should calculate distribution correctly', () => {
      const importMap = {
        imports: {
          'pkg-1': 'https://example.com/1.js',
          'pkg-2': 'https://example.com/2.js',
          'pkg-3': 'https://example.com/3.js',
        },
      };
      fs.writeFileSync(testImportMapPath, JSON.stringify(importMap, null, 2));

      const analysis = analyzeImportMap(testImportMapPath);

      // Check that distribution adds up to total packages
      const totalInDistribution = Object.values(analysis.ports).reduce(
        (sum, packages) => sum + packages.length,
        0,
      );
      expect(totalInDistribution).toBe(Object.keys(analysis.entries).length);

      // Each port in distribution should have count >= 1
      Object.values(analysis.ports).forEach((packages) => {
        expect(packages.length).toBeGreaterThanOrEqual(1);
      });
    });

    test('should detect and report collisions correctly', () => {
      const importMap = {
        imports: {
          'collision-test-1': 'https://example.com/1.js',
          'collision-test-2': 'https://example.com/2.js',
          'collision-test-3': 'https://example.com/3.js',
          'collision-test-4': 'https://example.com/4.js',
          'collision-test-5': 'https://example.com/5.js',
        },
      };
      fs.writeFileSync(testImportMapPath, JSON.stringify(importMap, null, 2));

      // Use small range to force collisions
      const analysis = analyzeImportMap(testImportMapPath, 3001, 3);

      expect(Object.keys(analysis.entries)).toHaveLength(5);
      expect(Object.keys(analysis.ports).length).toBeLessThan(5);

      // Verify collision structure
      Object.entries(analysis.ports).forEach(([port, packages]) => {
        expect(+port).toBeGreaterThanOrEqual(3001);
        expect(+port).toBeLessThan(3004);
        expect(packages.length).toBeGreaterThanOrEqual(1);

        // All packages in collision should have the same port
        packages.forEach((pkg) => {
          expect(analysis.entries[pkg]).toBe(+port);
        });
      });
    });

    test('should handle import map with numeric version suffixes in URLs', () => {
      const importMap = {
        imports: {
          'versioned-pkg-1': 'https://cdn.example.com/pkg1/v1.2.3/main.js',
          'versioned-pkg-2': 'https://cdn.example.com/pkg2/v2.0.0/main.js',
        },
      };
      fs.writeFileSync(testImportMapPath, JSON.stringify(importMap, null, 2));

      const analysis = analyzeImportMap(testImportMapPath);

      expect(Object.keys(analysis.entries)).toHaveLength(2);

      Object.values(analysis.entries).forEach((port) => {
        expect(port).toBeGreaterThanOrEqual(3001);
        expect(port).toBeLessThan(4998);
      });
    });

    test('should use default hash and reducer when not specified', () => {
      const importMap = {
        imports: {
          'default-test': 'https://example.com/test.js',
        },
      };
      fs.writeFileSync(testImportMapPath, JSON.stringify(importMap, null, 2));

      const defaultAnalysis = analyzeImportMap(testImportMapPath);
      const explicitAnalysis = analyzeImportMap(
        testImportMapPath,
        3001,
        1997,
        'twin',
        'knuth',
      );

      expect(defaultAnalysis.entries['default-test']).toBe(
        explicitAnalysis.entries['default-test'],
      );
    });

    test('should handle import map with imports field not being an object', () => {
      const invalidImportMap = { imports: 'not-an-object' };
      fs.writeFileSync(
        testImportMapPath,
        JSON.stringify(invalidImportMap, null, 2),
      );

      expect(() => analyzeImportMap(testImportMapPath)).toThrow(
        'Import map must have an "imports" object',
      );
    });

    test('should handle import map with null imports field', () => {
      const invalidImportMap = { imports: null };
      fs.writeFileSync(
        testImportMapPath,
        JSON.stringify(invalidImportMap, null, 2),
      );

      expect(() => analyzeImportMap(testImportMapPath)).toThrow(
        'Import map must have an "imports" object',
      );
    });
  });
});
