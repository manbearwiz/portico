import fs from 'node:fs';
import path from 'node:path';

export interface PackageData {
  name?: string;
  [key: string]: unknown;
}

export interface ImportMap {
  imports: Record<string, string>;
  [key: string]: unknown;
}

export interface PortCollision {
  port: number;
  packages: string[];
}

export interface ImportMapAnalysis {
  ports: Record<number, string[]>;
  entries: Record<string, number>;
}

function primeHash(
  name: string,
  primes: [number, ...number[]],
  initial?: number,
): number {
  let hash = initial ?? name.length;

  for (let i = 0; i < name.length; i++) {
    // biome-ignore lint/style/noNonNullAssertion: using the modulo operator on the length guarantees a valid index
    const prime = primes[i % primes.length]!;
    hash = (Math.imul(hash, prime) + name.charCodeAt(i)) >>> 0;
  }

  return hash;
}

export const HASH = {
  sdbm: (name: string): number => primeHash(name, [65599]),
  twin: (name: string): number => primeHash(name, [31, 37]),
  double: (name: string): number => {
    const hash1 = primeHash(name, [31]) % 2147483647;
    const hash2 = primeHash(name, [37], 1) % 2147483647;
    const combined = (hash1 ^ (hash2 << 1)) >>> 0;
    const phi = 2654435761;
    return Math.imul(combined, phi) >>> 0;
  },
} as const;

export const REDUCERS = {
  modulo: (hash: number, range: number): number => hash % range,
  knuth: (hash: number, range: number): number => {
    const constant = 2654435769;
    const multiplied = Math.imul(hash, constant) >>> 0;
    return (multiplied >>> (32 - Math.ceil(Math.log2(range)))) % range;
  },
  lcg: (hash: number, range: number): number => {
    const a = 1664525;
    const c = 1013904223;
    const result = (Math.imul(a, hash) + c) >>> 0;
    return Math.floor((result / 0x100000000) * range);
  },
} as const;

// Extract types for hash functions and reducers
export type HashFunction = keyof typeof HASH;
export type ReducerFunction = keyof typeof REDUCERS;

/**
 * Generate a stable, unique development port based on a package name
 */
export function getPort(
  packageName: string,
  basePort = 3001,
  range = 1997,
  hash: HashFunction = 'twin',
  reducer: ReducerFunction = 'knuth',
): number {
  if (!packageName || typeof packageName !== 'string') {
    throw new Error('Package name must be a non-empty string');
  }

  if (basePort < 1024 || basePort > 65535) {
    throw new Error('Base port must be between 1024 and 65535');
  }

  if (range < 1 || range > 10000) {
    throw new Error('Port range must be between 1 and 10000');
  }

  // Get the hash and reducer functions
  const hashFunction = HASH[hash] || HASH.twin;
  const reducerFunction = REDUCERS[reducer] || REDUCERS.knuth;

  // Generate hash and apply reducer
  const hashValue = hashFunction(packageName);
  const offset = reducerFunction(hashValue, range);
  const port = basePort + offset;

  // Safety check: ensure the generated port is within the expected range
  if (port < basePort || port >= basePort + range) {
    throw new Error(
      `Hash '${hash}' + Reducer '${reducer}' generated invalid port ${port}. ` +
        `Expected range: ${basePort} to ${basePort + range - 1}. ` +
        `Offset: ${offset}, Range: ${range}. ` +
        `This indicates a bug in the implementation.`,
    );
  }

  return port;
}

export function getPackageName(packageJsonPath?: string) {
  const pkgPath = packageJsonPath || path.join(process.cwd(), 'package.json');

  if (!fs.existsSync(pkgPath)) {
    throw new Error(`package.json not found at ${pkgPath}`);
  }

  let packageData: PackageData;
  try {
    const packageContent = fs.readFileSync(pkgPath, 'utf8');
    packageData = JSON.parse(packageContent) as PackageData;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to parse package.json: ${errorMessage}`);
  }

  if (!packageData.name) {
    throw new Error('package.json must have a "name" field');
  }

  return packageData.name;
}

export function parseImportMap(importMap: string): ImportMap {
  if (!fs.existsSync(importMap)) {
    throw new Error(`Import map file not found at ${importMap}`);
  }

  try {
    const importMapContent = fs.readFileSync(importMap, 'utf8');
    const importMapData = JSON.parse(importMapContent) as ImportMap;

    if (!importMapData.imports || typeof importMapData.imports !== 'object') {
      throw new Error('Import map must have an "imports" object');
    }
    return importMapData;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to parse import map: ${errorMessage}`);
  }
}

/**
 * Analyze an import map file and generate ports for all entries
 * @param importMap - The import map object or path to the JSON file
 * @param basePort - The base port to start from (default: 3001)
 * @param range - The range of ports to use (default: 1997)
 * @param hash - The hash function to use (default: 'twin')
 * @param reducer - The reducer function to use (default: 'knuth')
 * @returns Analysis results including ports, collisions, and distribution
 */
export function analyzeImportMap(
  importMap: string | ImportMap,
  basePort = 3001,
  range = 1997,
  hash: HashFunction = 'twin',
  reducer: ReducerFunction = 'knuth',
): ImportMapAnalysis {
  const importMapBody =
    typeof importMap === 'string' ? parseImportMap(importMap) : importMap;

  const entries = Object.fromEntries(
    Object.keys(importMapBody.imports).map((packageName) => [
      packageName,
      getPort(packageName, basePort, range, hash, reducer),
    ]),
  );

  const ports = Object.entries(entries).reduce(
    (acc, [packageName, port]) => {
      acc[port] = [...(acc[port] || []), packageName];
      return acc;
    },
    {} as Record<number, string[]>,
  );

  return { entries, ports };
}
