const { execSync } = require('node:child_process');

// Import maps with their entry counts
const importMaps = [
  {
    file: 'examples/comprehensive-benchmark/importmaps.json',
    entries: 73,
    name: 'Medium (73 entries)',
  },
  {
    file: 'examples/comprehensive-benchmark/importmaps-lg.json',
    entries: 133,
    name: 'Large (133 entries)',
  },
  {
    file: 'examples/comprehensive-benchmark/importmaps-xl.json',
    entries: 287,
    name: 'XL (287 entries)',
  },
];

// Prime number ranges to test - enables prime-optimized strategies to work properly
const primeRanges = [
  787, 991, 997, 1000, 1009, 1023, 1997, 2000, 2047, 2971, 3000,
]; // Small to large prime numbers

// Simple points scale - better performers get higher points
function calculatePoints(rank, totalStrategies) {
  // Award points from totalStrategies down to 1
  // 1st place gets max points, last place gets 1 point
  return totalStrategies - rank + 1;
}

console.log('🏆 COMPREHENSIVE STRATEGY BENCHMARK');
console.log('Testing hash/reducer combinations across multiple scenarios...\n');

const strategyScores = {};

// Run benchmarks for each import map and prime range combination
for (const importMap of importMaps) {
  process.stdout.write(`Testing ${importMap.name}...`);

  for (const range of primeRanges) {
    try {
      // Run benchmark and capture JSON output
      const cmd = `node dist/cli.cjs benchmark --import-map ${importMap.file} --range ${range} --output json`;
      const output = execSync(cmd, { encoding: 'utf8', stdio: 'pipe' });

      // Parse the JSON results
      const benchmarkData = JSON.parse(output);
      const results = benchmarkData.results.map((result) => ({
        strategy: `${result.hash}_${result.reducer}`,
        collisions: result.collisions,
      }));

      if (results.length > 0) {
        // Award points based on rank - simpler and more intuitive
        const totalStrategies = results.length;

        results.forEach((result, index) => {
          const strategy = result.strategy;
          const rank = index + 1; // 1-based ranking
          const points = calculatePoints(rank, totalStrategies);

          if (!strategyScores[strategy]) {
            strategyScores[strategy] = {
              points: 0,
              details: [],
              topThreeCount: 0,
              ranks: [],
            };
          }

          // Track performance patterns
          strategyScores[strategy].ranks.push(rank);
          if (rank <= 3) {
            strategyScores[strategy].topThreeCount++;
          }

          strategyScores[strategy].points += points;
          strategyScores[strategy].details.push({
            test: `${importMap.name} (range=${range})`,
            rank: rank,
            collisions: result.collisions,
            points: points,
          });
        });
      }
    } catch (error) {
      console.error(
        `\n❌ Failed to benchmark ${importMap.file} with range ${range}: ${error.message}`,
      );
    }
  }

  console.log(' ✓');
}

// Final results
console.log('\n🏆 FINAL RANKINGS');
console.log('=================');

// Sort strategies by total points (descending)
const sortedStrategies = Object.entries(strategyScores)
  .map(([name, data]) => ({
    name,
    ...data,
    avgRank: data.ranks.reduce((a, b) => a + b, 0) / data.ranks.length,
  }))
  .sort((a, b) => b.points - a.points);

// Show top 10 and bottom 3
console.log('\nTop performers:');
sortedStrategies.slice(0, 10).forEach((strategy, index) => {
  const position = index + 1;
  const emoji =
    position === 1
      ? '🥇'
      : position === 2
        ? '🥈'
        : position === 3
          ? '🥉'
          : '  ';
  const consistencyNote = strategy.topThreeCount >= 6 ? ' ★' : '';

  console.log(
    `${emoji} ${position.toString().padStart(2, ' ')}. ${strategy.name.padEnd(35)} ${strategy.points.toString().padStart(4)} pts${consistencyNote}`,
  );
});

if (sortedStrategies.length > 13) {
  console.log('   ...');
  console.log('\nBottom performers:');
  sortedStrategies.slice(-3).forEach((strategy, index, arr) => {
    const position = sortedStrategies.length - arr.length + index + 1;
    console.log(
      `💥 ${position.toString().padStart(2, ' ')}. ${strategy.name.padEnd(35)} ${strategy.points.toString().padStart(4)} pts`,
    );
  });
}

// Key insights
console.log('\n📈 KEY INSIGHTS:');
const topStrategy = sortedStrategies[0];
const mostConsistent = sortedStrategies.find((s) => s.topThreeCount >= 6);

console.log(`🏆 Champion: ${topStrategy.name} (${topStrategy.points} pts)`);
if (mostConsistent && mostConsistent.name !== topStrategy.name) {
  console.log(
    `� Most consistent: ${mostConsistent.name} (${mostConsistent.topThreeCount} top-3 finishes)`,
  );
}

console.log('\n✅ Benchmark completed successfully!');
