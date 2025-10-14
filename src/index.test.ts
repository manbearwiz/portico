import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import {
  analyzeImportMap,
  getPackageName,
  getPort,
  HASH,
  type HashFunction,
  parseImportMap,
  REDUCERS,
  type ReducerFunction,
} from './index.js';

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
    test('should return package name from package.json', async () => {
      await expect(getPackageName()).resolves.toBe('portico');
    });

    test('should throw error if package.json is not found', async () => {
      await expect(getPackageName('/nonexistent/package.json')).rejects.toThrow(
        `ENOENT: no such file or directory, open '/nonexistent/package.json'`,
      );
    });
  });

  describe('parseImportMap', () => {
    const testImportMapPath = path.join(
      import.meta.dirname || __dirname,
      'test-parse-import-map.json',
    );

    beforeEach(() => {
      // Clean up any existing test file
      if (fs.existsSync(testImportMapPath)) {
        fs.unlinkSync(testImportMapPath);
      }

      // Reset fetch mock
      vi.resetAllMocks();
    });

    afterEach(() => {
      // Clean up test file
      if (fs.existsSync(testImportMapPath)) {
        fs.unlinkSync(testImportMapPath);
      }

      // Restore fetch mock
      vi.restoreAllMocks();
    });

    describe('local file parsing', () => {
      test('should parse valid local import map file', async () => {
        const importMap = {
          imports: {
            react: 'https://esm.sh/react@18',
            lodash: 'https://esm.sh/lodash@4',
          },
        };
        fs.writeFileSync(testImportMapPath, JSON.stringify(importMap, null, 2));

        const result = await parseImportMap(testImportMapPath);

        expect(result).toEqual(importMap);
        expect(result.imports).toHaveProperty('react');
        expect(result.imports).toHaveProperty('lodash');
      });

      test('should throw error if local file does not exist', async () => {
        await expect(
          parseImportMap('/nonexistent/import-map.json'),
        ).rejects.toThrow(
          `ENOENT: no such file or directory, open '/nonexistent/import-map.json'`,
        );
      });

      test('should throw error if local file has invalid JSON', async () => {
        fs.writeFileSync(testImportMapPath, '{ invalid json }');

        await expect(parseImportMap(testImportMapPath)).rejects.toThrow(
          `Expected property name or '}' in JSON at position 2 (line 1 column 3)`,
        );
      });

      test('should throw error if local file has no imports field', async () => {
        const invalidImportMap = { notImports: {} };
        fs.writeFileSync(
          testImportMapPath,
          JSON.stringify(invalidImportMap, null, 2),
        );

        await expect(parseImportMap(testImportMapPath)).rejects.toThrow(
          'Import map must have an "imports" object',
        );
      });
    });

    describe('remote URL fetching', () => {
      test('should fetch and parse valid remote import map', async () => {
        const mockImportMap = {
          imports: {
            vue: 'https://esm.sh/vue@3',
            axios: 'https://esm.sh/axios@1',
          },
        };

        global.fetch = vi.fn().mockResolvedValueOnce({
          ok: true,
          json: async () => mockImportMap,
        });

        const result = await parseImportMap('https://example.com/imports.json');

        expect(result).toEqual(mockImportMap);
        expect(global.fetch).toHaveBeenCalledWith(
          'https://example.com/imports.json',
        );
      });

      test('should handle HTTP error responses', async () => {
        global.fetch = vi.fn().mockResolvedValueOnce({
          ok: false,
          status: 404,
          statusText: 'Not Found',
        });

        await expect(
          parseImportMap('https://example.com/missing.json'),
        ).rejects.toThrow(`response.json is not a function`);
      });

      test('should handle network errors', async () => {
        global.fetch = vi
          .fn()
          .mockRejectedValueOnce(new Error('Network error'));

        await expect(
          parseImportMap('https://example.com/imports.json'),
        ).rejects.toThrow(`Network error`);
      });

      test('should throw error if remote response is invalid JSON', async () => {
        global.fetch = vi.fn().mockResolvedValueOnce({
          ok: true,
          json: async () => {
            throw new Error('Invalid JSON');
          },
        });

        await expect(
          parseImportMap('https://example.com/malformed.json'),
        ).rejects.toThrow(`Invalid JSON`);
      });
    });

    describe('URL detection', () => {
      test.for([
        ['http', 'http://example.com/imports.json'],
        ['https', 'https://example.com/imports.json'],
      ] as const)('should detect %s URLs', async ([, url]) => {
        const mockImportMap = {
          imports: { test: url.replace('imports.json', 'test.js') },
        };
        global.fetch = vi.fn().mockResolvedValueOnce({
          ok: true,
          json: async () => mockImportMap,
        });

        await parseImportMap(url);

        expect(global.fetch).toHaveBeenCalledWith(url);
      });

      test('should treat non-URL strings as local file paths', async () => {
        const importMap = { imports: { local: './local.js' } };
        fs.writeFileSync(testImportMapPath, JSON.stringify(importMap, null, 2));

        const result = await parseImportMap(testImportMapPath);

        expect(result).toEqual(importMap);
        expect(global.fetch).not.toHaveBeenCalled();
      });
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

    test('should analyze import map and generate ports for all entries', async () => {
      const importMap = {
        imports: {
          '@company/app-one': 'https://example.com/app-one.js',
          '@company/app-two': 'https://example.com/app-two.js',
          'library-a': 'https://example.com/lib-a.js',
        },
      };
      fs.writeFileSync(testImportMapPath, JSON.stringify(importMap, null, 2));

      const analysis = await analyzeImportMap(testImportMapPath);

      expect(Object.values(analysis.entries)).toHaveLength(3);
      Object.entries(analysis.entries).forEach(([key, port]) => {
        expect(port).toBe(getPort(key));
        expect(port).toBeGreaterThanOrEqual(3001);
        expect(port).toBeLessThan(4998);
      });
    });

    test('should detect and handle port collisions correctly', async () => {
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
      const analysis = await analyzeImportMap(testImportMapPath, 3001, 3);

      expect(Object.keys(analysis.entries)).toHaveLength(5);
      expect(Object.keys(analysis.ports).length).toBeLessThan(5);

      // Verify collision structure and distribution
      const totalInDistribution = Object.values(analysis.ports).reduce(
        (sum, packages) => sum + packages.length,
        0,
      );
      expect(totalInDistribution).toBe(Object.keys(analysis.entries).length);

      Object.entries(analysis.ports).forEach(([port, packages]) => {
        expect(+port).toBeGreaterThanOrEqual(3001);
        expect(+port).toBeLessThan(3004);

        // All packages in collision should have the same port
        packages.forEach((pkg) => {
          expect(analysis.entries[pkg]).toBe(+port);
        });
      });
    });

    test('should throw error if import map file does not exist', async () => {
      await expect(
        analyzeImportMap('/nonexistent/import-map.json'),
      ).rejects.toThrow(
        `ENOENT: no such file or directory, open '/nonexistent/import-map.json'`,
      );
    });

    test('should throw error if import map is invalid JSON', async () => {
      fs.writeFileSync(testImportMapPath, '{ invalid json }');

      await expect(() => analyzeImportMap(testImportMapPath)).rejects.toThrow(
        `Expected property name or '}' in JSON at position 2 (line 1 column 3)`,
      );
    });

    test('should throw error if import map has no imports field', async () => {
      const invalidImportMap = { notImports: {} };
      fs.writeFileSync(
        testImportMapPath,
        JSON.stringify(invalidImportMap, null, 2),
      );

      await expect(() => analyzeImportMap(testImportMapPath)).rejects.toThrow(
        `Import map must have an "imports" object`,
      );
    });

    test('should handle empty import map', async () => {
      const emptyImportMap = { imports: {} };
      fs.writeFileSync(
        testImportMapPath,
        JSON.stringify(emptyImportMap, null, 2),
      );

      const analysis = await analyzeImportMap(testImportMapPath);

      expect(analysis.entries).toEqual({});
      expect(analysis.ports).toEqual({});
    });

    test('should work with custom hash and reducer functions', async () => {
      const importMap = {
        imports: {
          'package-a': 'https://example.com/a.js',
          'package-b': 'https://example.com/b.js',
          'package-c': 'https://example.com/c.js',
        },
      };
      fs.writeFileSync(testImportMapPath, JSON.stringify(importMap, null, 2));

      const analysis1 = await analyzeImportMap(
        testImportMapPath,
        3001,
        1997,
        'double',
        'lcg',
      );
      const analysis2 = await analyzeImportMap(
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
  });
});
