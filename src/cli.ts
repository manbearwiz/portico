#!/usr/bin/env node

import { Command } from 'commander';
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
const HASH_LIST_STRING = HASH_NAMES.join(', ');
const REDUCER_LIST_STRING = REDUCER_NAMES.join(', ');

program
  .name('portico')
  .description(
    'Generate stable, unique development ports based on package name',
  );

// Generate command
program
  .command('generate')
  .description('Generate a port from package.json or package name')
  .option('-b, --base <port>', 'Base port number (default: 3001)', '3001')
  .option('-r, --range <range>', 'Port range size (default: 1997)', '1997')
  .option(
    '--hash <type>',
    `Hash function: ${HASH_LIST_STRING} (default: twin)`,
    'twin',
  )
  .option(
    '--reducer <type>',
    `Reducer function: ${REDUCER_LIST_STRING} (default: knuth)`,
    'knuth',
  )
  .option(
    '-p, --package <path>',
    'Path to package.json (default: ./package.json)',
  )
  .option('-n, --name <name>', 'Package name to calculate port for')
  .action((options) => {
    try {
      const basePort = parseInt(options.base, 10);
      const range = parseInt(options.range, 10);
      const hash = options.hash as HashFunction;
      const reducer = options.reducer as ReducerFunction;
      const name = options.name ?? getPackageName(options.package);
      const port = getPort(name, basePort, range, hash, reducer);

      console.log(port);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      console.error(`Error: ${errorMessage}`);
      process.exit(1);
    }
  });

// Analyze command
program
  .command('analyze')
  .description('Analyze import map and generate ports for all entries')
  .option('-b, --base <port>', 'Base port number (default: 3001)', '3001')
  .option('-r, --range <range>', 'Port range size (default: 1997)', '1997')
  .option(
    '--hash <type>',
    `Hash function: ${HASH_LIST_STRING} (default: twin)`,
    'twin',
  )
  .option(
    '--reducer <type>',
    `Reducer function: ${REDUCER_LIST_STRING} (default: knuth)`,
    'knuth',
  )
  .requiredOption('-i, --import-map <path>', 'Path to import map JSON file')
  .option(
    '-o, --output <format>',
    'Output format: table, json, csv (default: table)',
    'table',
  )
  .action((options) => {
    try {
      const basePort = parseInt(options.base, 10);
      const range = parseInt(options.range, 10);
      const hash = options.hash as HashFunction;
      const reducer = options.reducer as ReducerFunction;

      const analysis = analyzeImportMap(
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
            `Generating ${packageCount} ports in range ${basePort} - ${basePort + range - 1}`,
          );
          console.log(
            `Collision Probability: ${(collisionProbability * 100).toFixed(2)}%\n`,
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
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      console.error(`Error: ${errorMessage}`);
      process.exit(1);
    }
  });

// Benchmark command
program
  .command('benchmark')
  .description('Compare the two port strategies')
  .option('-b, --base <port>', 'Base port number (default: 3001)', '3001')
  .option('-r, --range <range>', 'Port range size (default: 1997)', '1997')
  .option(
    '-o, --output <format>',
    'Output format: table, json (default: table)',
    'table',
  )
  .requiredOption('-i, --import-map <path>', 'Path to import map JSON file')
  .action((options) => {
    try {
      const basePort = parseInt(options.base, 10);
      const range = parseInt(options.range, 10);

      interface BenchmarkResult {
        hash: string;
        reducer: string;
        collisions: number;
        uniquePorts: number;
      }

      const importMap = parseImportMap(options.importMap);

      const packageCount = Object.keys(importMap.imports).length;
      const probability =
        1 - Math.exp((-packageCount * packageCount) / (2 * range));

      const results: BenchmarkResult[] = [];

      // Test each hash+reducer combination
      for (const hash of HASH_NAMES) {
        for (const reducer of REDUCER_NAMES) {
          try {
            const analysis = analyzeImportMap(
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
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      console.error(`Error: ${errorMessage}`);
      process.exit(1);
    }
  });

program.parse();
