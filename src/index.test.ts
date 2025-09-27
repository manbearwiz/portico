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
  describe.for(Object.keys(HASH) as (keyof typeof HASH)[])(
    'HASH %s',
    (hashName) => {
      const hashFunction = HASH[hashName];

      test('should generate different hashes for different inputs', () => {
        const name1 = 'package-one';
        const name2 = 'package-two';
        expect(hashFunction(name1)).not.toBe(hashFunction(name2));
      });

      describe.for([
        ['simple', 'test-package'],
        ['scoped', '@company/my-app'],
        ['long', 'a'.repeat(214)],
      ] as const)('with %s input', ([, input]) => {
        test('should not throw', () => {
          expect(() => hashFunction(input)).not.toThrow();
        });

        test('should be deterministic', () => {
          expect(hashFunction(input)).toBe(hashFunction(input));
        });
      });
    },
  );

  describe.for(Object.keys(REDUCERS) as (keyof typeof REDUCERS)[])(
    'REDUCER %s',
    (reducerName) => {
      const reducerFunction = REDUCERS[reducerName];

      describe.for([
        [1000, 12345678],
        [500, 87654321],
        [1, 123456],
      ] as const)('with range [0, %s) for hash %s', ([range, hash]) => {
        test('should not throw', () => {
          expect(() => reducerFunction(hash, range)).not.toThrow();
        });

        test('should generate values in range', () => {
          const result = reducerFunction(hash, range);
          expect(result).toBeGreaterThanOrEqual(0);
          expect(result).toBeLessThan(range);
        });

        test('should be deterministic', () => {
          const port1 = reducerFunction(hash, range);
          const port2 = reducerFunction(hash, range);
          expect(port1).toBe(port2);
        });
      });
    },
  );

  describe('getPort', () => {
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

    test.for([
      ['empty string', ''],
      ['null', null],
    ])('should throw error for invalid package name: %s', ([, input]) => {
      // @ts-expect-error - Testing invalid input
      expect(() => getPort(input)).toThrow(
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
      const buggyReducers = {
        ...REDUCERS,
        buggy: () => 999999,
      };

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
        Object.keys(REDUCERS).forEach((key) => {
          // @ts-expect-error - Cleanup requires dynamic deletion
          delete REDUCERS[key];
        });
        Object.assign(REDUCERS, originalReducers);
      }
    });

    describe.for(Object.keys(HASH) as HashFunction[])(
      'with hash %s',
      (hash) => {
        describe.for(Object.keys(REDUCERS) as ReducerFunction[])(
          'and reducer %s',
          (reducer) => {
            test('should be deterministic', () => {
              const name = 'my-awesome-app';
              const p1 = getPort(name, 3001, 1997, hash, reducer);
              const p2 = getPort(name, 3001, 1997, hash, reducer);
              expect(p1).toBe(p2);
            });

            test('should be in range', () => {
              const name = 'test-app';

              const port = getPort(name, 3001, 1997, hash, reducer);
              expect(port).toBeGreaterThanOrEqual(3001);
              expect(port).toBeLessThan(4998);
            });
          },
        );
      },
    );

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
        'sdbm',
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
