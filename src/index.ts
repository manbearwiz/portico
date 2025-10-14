import fs from 'node:fs/promises';
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

  // Get functions with fallbacks
  const hashFunction = HASH[hash] ?? HASH.twin;
  const reducerFunction = REDUCERS[reducer] ?? REDUCERS.knuth;

  // Generate and return port
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

export async function getPackageName(packageJsonPath?: string) {
  const pkgPath = packageJsonPath || path.join(process.cwd(), 'package.json');

  const packageContent = await fs.readFile(pkgPath, 'utf8');
  const packageData = JSON.parse(packageContent) as PackageData;

  if (!packageData.name) {
    throw new Error('package.json must have a "name" field');
  }

  return packageData.name;
}

/**
 * Determine if a string is a URL
 */
function isUrl(source: string): boolean {
  return source.startsWith('http://') || source.startsWith('https://');
}

export async function parseImportMap(source: string): Promise<ImportMap> {
  let importMapData: ImportMap;

  if (isUrl(source)) {
    const response = await fetch(source);
    importMapData = await response.json();
  } else {
    const content = await fs.readFile(source, 'utf8');
    importMapData = JSON.parse(content);
  }

  if (!importMapData.imports || typeof importMapData.imports !== 'object') {
    throw new Error('Import map must have an "imports" object');
  }

  return importMapData;
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
export async function analyzeImportMap(
  importMap: string | ImportMap,
  basePort = 3001,
  range = 1997,
  hash: HashFunction = 'twin',
  reducer: ReducerFunction = 'knuth',
): Promise<ImportMapAnalysis> {
  const importMapBody =
    typeof importMap === 'string' ? await parseImportMap(importMap) : importMap;

  // Generate port entries for all packages
  const entries: Record<string, number> = {};
  for (const packageName of Object.keys(importMapBody.imports)) {
    entries[packageName] = getPort(packageName, basePort, range, hash, reducer);
  }

  // Group packages by port for collision detection
  const ports: Record<number, string[]> = {};
  for (const [packageName, port] of Object.entries(entries)) {
    ports[port] = ports[port] ?? [];
    ports[port].push(packageName);
  }

  return { entries, ports };
}
