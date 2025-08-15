#!/usr/bin/env node

import { program } from 'commander';
import { getPort, getPortFromPackageJson } from './index.js';

interface Options {
  base: string;
  range: string;
  package?: string;
  name?: string;
}

program
  .name('portico')
  .description('Generate stable, unique development ports based on package name')
  .option('-b, --base <port>', 'Base port number (default: 4200)', '4200')
  .option('-r, --range <range>', 'Port range size (default: 200)', '200')
  .option('-p, --package <path>', 'Path to package.json (default: ./package.json)')
  .option('-n, --name <name>', 'Package name to calculate port for')
  .action((options: Options) => {
    try {
      const basePort = parseInt(options.base, 10);
      const range = parseInt(options.range, 10);

      let port: number;

      if (options.name) {
        // Use provided package name
        port = getPort(options.name, basePort, range);
      } else {
        // Use package.json (with optional custom path)
        port = getPortFromPackageJson(options.package, basePort, range);
      }

      console.log(port);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Error: ${errorMessage}`);
      process.exit(1);
    }
  });

program.parse();
