import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export interface PackageData {
  name?: string;
  [key: string]: unknown;
}

/**
 * Generate a stable, unique development port based on a package name
 * @param packageName - The package name to generate a port for
 * @param basePort - The base port to start from (default: 4200)
 * @param range - The range of ports to use (default: 200)
 * @returns A stable port number for the given package name
 */
export function getPort(
  packageName: string,
  basePort = 4200,
  range = 200,
): number {
  if (!packageName || typeof packageName !== 'string') {
    throw new Error('Package name must be a non-empty string');
  }

  if (basePort < 1024 || basePort > 65535) {
    throw new Error('Base port must be between 1024 and 65535');
  }

  if (range < 1 || range > 1000) {
    throw new Error('Port range must be between 1 and 1000');
  }

  // Create MD5 hash of the package name
  const hash = crypto.createHash('md5').update(packageName).digest('hex');

  // Take the first 8 characters and convert to integer
  const hashInt = parseInt(hash.substring(0, 8), 16);

  // Calculate port within the specified range
  const port = basePort + (hashInt % range);

  return port;
}

/**
 * Get port for the current package by reading package.json
 * @param packageJsonPath - Path to package.json (optional, defaults to current directory)
 * @param basePort - The base port to start from (default: 4200)
 * @param range - The range of ports to use (default: 200)
 * @returns A stable port number for the current package
 */
export function getPortFromPackageJson(
  packageJsonPath?: string,
  basePort = 4200,
  range = 200,
): number {
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

  return getPort(packageData.name, basePort, range);
}
