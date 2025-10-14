#!/usr/bin/env node

import { Command, Option } from 'commander';
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

const program = new Command();

// Available options
const HASH_NAMES = Object.keys(HASH) as HashFunction[];
const REDUCER_NAMES = Object.keys(REDUCERS) as ReducerFunction[];

// Helper functions to reduce duplication
function createBasePortOption() {
  return new Option('-b, --base <port>', 'Base port number')
    .default(3001)
    .env('PORTICO_BASE_PORT')
    .argParser((value) => {
      const parsed = parseInt(value, 10);
      if (
        Number.isNaN(parsed) ||
        typeof parsed !== 'number' ||
        parsed < 1 ||
        parsed > 65535
      ) {
        console.error('Error: Base port must be a number between 1 and 65535');
        process.exit(1);
      }
      return parsed;
    });
}

function createRangeOption() {
  return new Option('-r, --range <range>', 'Port range size')
    .default(1997)
    .env('PORTICO_RANGE')
    .argParser((value) => {
      const parsed = parseInt(value, 10);
      if (Number.isNaN(parsed) || typeof parsed !== 'number' || parsed < 1) {
        throw new Error('Range must be a positive number');
      }
      return parsed;
    });
}

function createHashOption() {
  return new Option('--hash <type>', `Hash function`)
    .default('twin')
    .choices(HASH_NAMES)
    .env('PORTICO_HASH');
}

function createReducerOption() {
  return new Option('--reducer <type>', `Reducer function`)
    .default('knuth')
    .choices(REDUCER_NAMES)
    .env('PORTICO_REDUCER');
}

function parsePortOptions(options: any): { basePort: number; range: number } {
  const basePort = options.base;
  const range = options.range;
  if (basePort + range > 65535) {
    console.error(
      'Error: Base port + range exceeds maximum port number (65535)',
    );
    process.exit(1);
  }
  return { basePort, range };
}

function createEnvironmentVariablesHelpText(): string {
  return `
Environment Variables:
  PORTICO_BASE_PORT                   # Default base port
  PORTICO_RANGE                       # Default port range
  PORTICO_HASH                        # Default hash function
  PORTICO_REDUCER                     # Default reducer function`;
}

function handleError(error: unknown, message?: string): never {
  if (error instanceof Error) {
    console.error(`Error: ${message ? `${message}: ` : ''}${error.message}`);
  } else {
    console.error(`Error: ${message || 'An unexpected error occurred'}`);
  }
  process.exit(1);
}

program
  .name('portico')
  .description(
    'Generate stable, unique development ports based on package name',
  )
  .option('--verbose', 'Enable verbose output')
  .configureHelp({
    sortSubcommands: true,
    showGlobalOptions: true,
  })
  .showHelpAfterError('(add --help for additional information)')
  .showSuggestionAfterError()
  .addHelpText(
    'after',
    `

Examples:
  $ portico                    # Generate port from package.json
  $ portico g -n my-app           # Same as above (shorthand)

For more help on a specific command:
  $ portico <command> --help

Repository: https://github.com/manbearwiz/portico`,
  );

// Generate command
program
  .command('generate', { isDefault: true })
  .alias('g')
  .description('Generate a port from package.json or package name')
  .addOption(createBasePortOption())
  .addOption(createRangeOption())
  .addOption(createHashOption())
  .addOption(createReducerOption())
  .option('-p, --package <path>', 'Path to package.json', './package.json')
  .option('-n, --name <name>', 'Package name to calculate port for')
  .addHelpText(
    'after',
    `

Examples:
  $ portico                              # Use current package.json
  $ portico g -n my-app                  # Same as above (shorthand)
  $ portico --base 4000 -n my-app        # Custom base port
  $ portico --hash sdbm -n my-app        # Different hash algorithm${createEnvironmentVariablesHelpText()}`,
  )
  .action(async (options) => {
    try {
      const { basePort, range } = parsePortOptions(options);
      const hash = options.hash as HashFunction;
      const reducer = options.reducer as ReducerFunction;
      const name = options.name ?? (await getPackageName(options.package));
      const port = getPort(name, basePort, range, hash, reducer);

      // Verbose output if requested
      const globalOptions = program.optsWithGlobals();
      if (globalOptions['verbose']) {
        console.error(`Package: ${name}`);
        console.error(`Strategy: ${hash}+${reducer}`);
        console.error(`Range: ${basePort}-${basePort + range - 1}`);
        console.error(`Port: ${port}`);
      } else {
        console.log(port);
      }
    } catch (error) {
      handleError(error);
    }
  });

// Analyze command
program
  .command('analyze')
  .alias('a')
  .description('Analyze import map and generate ports for all entries')
  .addOption(createBasePortOption())
  .addOption(createRangeOption())
  .addOption(createHashOption())
  .addOption(createReducerOption())
  .requiredOption(
    '-i, --import-map <path>',
    'Path to import map JSON file or URL',
  )
  .addOption(
    new Option('-o, --output <format>', 'Output format')
      .default('table')
      .choices(['table', 'json', 'csv']),
  )
  .addHelpText(
    'after',
    `

Examples:
  $ portico analyze -i imports.json                          # Local file
  $ portico analyze -i https://example.com/imports.json      # Remote URL
  $ portico a -i imports.json -o json                        # JSON output (shorthand)
  $ portico analyze -i imports.json -o csv                   # CSV output${createEnvironmentVariablesHelpText()}`,
  )
  .action(async (options) => {
    try {
      const { basePort, range } = parsePortOptions(options);
      const hash = options.hash as HashFunction;
      const reducer = options.reducer as ReducerFunction;

      const analysis = await analyzeImportMap(
        options.importMap,
        basePort,
        range,
        hash,
        reducer,
      );

      switch (options.output) {
        case 'json':
          console.log(JSON.stringify(analysis, null, 2));
          break;
        case 'csv':
          console.log('Package Name,Port,Collision Count');
          Object.entries(analysis.entries).forEach(([packageName, port]) => {
            const collisionCount =
              analysis.ports[port]?.filter((p) => p !== packageName).length ||
              0;
            console.log(`"${packageName}",${port},${collisionCount}`);
          });
          break;
        default: {
          const collisions = Object.entries(analysis.ports).filter(
            ([, packages]) => packages.length > 1,
          );
          const collisionCount = collisions.reduce(
            (total, [, packages]) => total + packages.length,
            0,
          );
          const packageCount = Object.keys(analysis.entries).length;
          const uniquePortCount = Object.keys(analysis.ports).length;
          const collisionProbability =
            1 - Math.exp((-packageCount * packageCount) / (2 * range));

          console.log('\n📊 Import Map Port Analysis\n');
          console.log(`Strategy: ${hash}+${reducer}`);
          console.log(
            `Generating ${packageCount} ports in range ${basePort} - ${
              basePort + range - 1
            }`,
          );
          console.log(
            `Collision Probability: ${(collisionProbability * 100).toFixed(
              2,
            )}%\n`,
          );

          if (uniquePortCount < packageCount) {
            console.log(`Unique ports: ${uniquePortCount}`);
            console.log(
              `Collisions: ${collisionCount} packages in ${collisions.length} collision groups\n`,
            );

            console.log('⚠️ Collisions:');
            Object.entries(analysis.ports).forEach(([port, packages]) => {
              if (packages.length > 1) {
                console.log(`  Port ${port}: ${packages.join(', ')}`);
              }
            });
            console.log();
          } else {
            console.log('No collisions detected!');
          }

          break;
        }
      }
    } catch (error) {
      handleError(error, 'Failed to analyze import map');
    }
  });

// Benchmark command
program
  .command('benchmark')
  .alias('b')
  .description('Compare hash and reducer strategy combinations')
  .addOption(createBasePortOption())
  .addOption(createRangeOption())
  .addOption(
    new Option('-o, --output <format>', 'Output format')
      .default('table')
      .choices(['table', 'json']),
  )
  .requiredOption(
    '-i, --import-map <path>',
    'Path to import map JSON file or URL',
  )
  .addHelpText(
    'after',
    `

Examples:
  $ portico benchmark -i imports.json                     # Local file
  $ portico benchmark -i https://example.com/imports.json # Remote URL
  $ portico b -i imports.json -o json                     # JSON output (shorthand)
  $ portico benchmark -i imports.json --base 4000         # Custom base port${createEnvironmentVariablesHelpText()}`,
  )
  .action(async (options) => {
    try {
      const { basePort, range } = parsePortOptions(options);

      interface BenchmarkResult {
        hash: string;
        reducer: string;
        collisions: number;
        uniquePorts: number;
      }

      const importMap = await parseImportMap(options.importMap);

      const packageCount = Object.keys(importMap.imports).length;
      const probability =
        1 - Math.exp((-packageCount * packageCount) / (2 * range));

      const results: BenchmarkResult[] = [];

      // Test each hash+reducer combination
      for (const hash of HASH_NAMES) {
        for (const reducer of REDUCER_NAMES) {
          try {
            const analysis = await analyzeImportMap(
              importMap,
              basePort,
              range,
              hash,
              reducer,
            );

            const collisions = Object.values(analysis.ports)
              .filter((packages) => packages.length > 1)
              .reduce((total, packages) => total + packages.length, 0);

            const uniquePorts = Object.keys(analysis.ports).length;

            results.push({
              hash: hash.charAt(0).toUpperCase() + hash.slice(1),
              reducer: reducer.charAt(0).toUpperCase() + reducer.slice(1),
              collisions,
              uniquePorts,
            });
          } catch (error) {
            console.warn(
              `⚠️  Failed to test ${hash}+${reducer}: ${
                error instanceof Error ? error.message : 'Unknown error'
              }`,
            );
          }
        }
      }

      // Sort by collisions (ascending), then by unique ports (descending)
      results.sort((a, b) => {
        if (a.collisions !== b.collisions) {
          return a.collisions - b.collisions;
        }
        return b.uniquePorts - a.uniquePorts;
      });

      if (options.output === 'json') {
        // JSON output
        const output = {
          metadata: {
            importMap: options.importMap,
            basePort,
            range,
            totalCombinations: results.length,
            timestamp: new Date().toISOString(),
          },
          results: results.map((r) => ({
            hash: r.hash.toLowerCase(),
            reducer: r.reducer.toLowerCase(),
            collisions: r.collisions,
            uniquePorts: r.uniquePorts,
          })),
          summary:
            results.length > 0
              ? {
                  bestCombination: {
                    hash: results[0]?.hash.toLowerCase(),
                    reducer: results[0]?.reducer.toLowerCase(),
                    collisions: results[0]?.collisions,
                    uniquePorts: results[0]?.uniquePorts,
                  },
                  worstCombination:
                    results.length > 1
                      ? {
                          hash: results[results.length - 1]?.hash.toLowerCase(),
                          reducer:
                            results[results.length - 1]?.reducer.toLowerCase(),
                          collisions: results[results.length - 1]?.collisions,
                          uniquePorts: results[results.length - 1]?.uniquePorts,
                        }
                      : null,
                }
              : null,
        };
        console.log(JSON.stringify(output, null, 2));
      } else {
        // Table output (default)
        console.log(`Import Map: ${options.importMap}`);
        console.log(
          `Range: ${basePort} - ${basePort + range - 1} (${range} ports)\n`,
        );

        const strategiesWithCollisions = results.filter(
          (r) => r.collisions > 0,
        ).length;
        console.log(
          `Collision Probability: ${(probability * 100).toFixed(2)}%`,
        );
        const collisionPercent = (
          (strategiesWithCollisions / results.length) *
          100
        ).toFixed(2);
        console.log(
          `Strategies with collisions: ${strategiesWithCollisions} / ${results.length} (${collisionPercent}%)\n`,
        );

        console.log('📊 Comparison:');
        console.table(
          results.map((r) => ({
            Hash: r.hash,
            Reducer: r.reducer,
            Collisions: r.collisions,
            'Unique Ports': r.uniquePorts,
          })),
        );

        // Show winner
        if (results.length && results[0]) {
          const winner = results[0];
          console.log(
            `\n🏆 Best Combination: ${winner.hash} + ${winner.reducer}`,
          );
          console.log(
            `   ${winner.collisions} collisions, ${winner.uniquePorts} unique ports`,
          );

          const loser = results.length > 1 && results[results.length - 1];
          if (loser) {
            const improvement = loser.collisions - winner.collisions;
            const improvementPercent =
              improvement > 0
                ? ((improvement / loser.collisions) * 100).toFixed(1)
                : '0';

            console.log(`\n📈 Performance Difference:`);
            console.log(
              `   ${improvement} fewer collisions (${improvementPercent}% improvement)`,
            );
            console.log(
              `   ${winner.uniquePorts - loser.uniquePorts} more unique ports`,
            );
          }
        }
      }
    } catch (error) {
      handleError(error, 'Failed to benchmark import map');
    }
  });

program.parse();
