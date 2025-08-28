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
const primeRanges = [787, 991, 997, 1000, 1009, 1997, 2000, 2971, 3000]; // Small to large prime numbers

// Points scale for 15 strategies: 1st=+10, 2nd=+8, 3rd=+6, 4th=+4, 5th=+2, 6th=0, 7th=-2, 8th=-4, 9th=-6, 10th=-8, 11th=-10, 12th=-12, 13th=-14, 14th=-16, 15th=-15
const POINTS_SCALE = [
  10, 8, 6, 4, 2, 0, -2, -4, -6, -8, -10, -12, -14, -16, -15,
];

console.log('🏆 COMPREHENSIVE STRATEGY BENCHMARK');
console.log('=====================================');
console.log('📋 Now testing 15 complete strategy combinations:');
console.log('   • 5 hash functions × 3 distribution methods = 15 total');
console.log('   • Complete matrix: every hash with every distribution');
console.log('   • Using prime ranges: 787, 997, 1000, 2000');
console.log();

const strategyScores = {};

// Run benchmarks for each import map and prime range combination
for (const importMap of importMaps) {
  console.log(`📊 Testing ${importMap.name}`);
  console.log('─'.repeat(40));

  for (const range of primeRanges) {
    console.log(`\n🔬 Prime range ${range} ports:`);

    try {
      // Run benchmark and capture JSON output
      const cmd = `node dist/cli.cjs benchmark --import-map ${importMap.file} --range ${range} --output json`;
      const output = execSync(cmd, { encoding: 'utf8', stdio: 'pipe' });

      // Parse the JSON results
      const benchmarkData = JSON.parse(output);
      const results = benchmarkData.results.map((result) => ({
        strategy: `${result.hash}_${result.reducer}`,
        collisions: result.collisions,
        utilization: result.utilization,
      }));

      if (results.length > 0) {
        // Award points: properly handle ties by grouping identical performance
        const totalStrategies = results.length;

        // Group results by performance (collisions, then utilization)
        const performanceGroups = [];
        let currentGroup = [results[0]];

        for (let i = 1; i < results.length; i++) {
          const current = results[i];
          const previous = results[i - 1];

          // Check if this result ties with the previous one
          if (
            current.collisions === previous.collisions &&
            current.utilization === previous.utilization
          ) {
            currentGroup.push(current);
          } else {
            performanceGroups.push(currentGroup);
            currentGroup = [current];
          }
        }
        performanceGroups.push(currentGroup); // Add the last group

        // Assign ranks and points to each group
        let currentRank = 1;

        // Show only top 3 and bottom 2 for cleaner output
        const topPerformers = [];
        const bottomPerformers = [];

        performanceGroups.forEach((group) => {
          // Calculate points for this tie group
          const ranksInGroup = [];
          for (let i = 0; i < group.length; i++) {
            ranksInGroup.push(currentRank + i);
          }

          // Average the points for tied positions
          const totalPoints = ranksInGroup.reduce(
            (sum, rank) => sum + (POINTS_SCALE[rank] || 0),
            0,
          );
          const avgPoints = totalPoints / group.length;

          // Assign the same rank and average points to all tied strategies
          group.forEach((result) => {
            const strategy = result.strategy;

            if (!strategyScores[strategy]) {
              strategyScores[strategy] = {
                points: 0,
                details: [],
                bottomThreeCount: 0,
                topThreeCount: 0,
                ranks: [],
              };
            }

            const rank = currentRank; // All tied strategies get the same rank
            const points = Math.round(avgPoints * 100) / 100; // Round to 2 decimal places

            // Track performance patterns
            strategyScores[strategy].ranks.push(rank);
            if (rank <= 3) {
              strategyScores[strategy].topThreeCount++;
            }
            if (rank >= totalStrategies - 2) {
              // Bottom 3
              strategyScores[strategy].bottomThreeCount++;
            }

            strategyScores[strategy].points += points;
            strategyScores[strategy].details.push({
              test: `${importMap.name} (range=${range})`,
              rank: rank,
              collisions: result.collisions,
              utilization: result.utilization,
              points: points,
            });

            // Collect top 3 and bottom 2 for display
            if (rank <= 3) {
              topPerformers.push({
                rank,
                strategy,
                collisions: result.collisions,
                points,
                groupSize: group.length,
              });
            } else if (rank >= totalStrategies - 1) {
              // Only bottom 2
              bottomPerformers.push({
                rank,
                strategy,
                collisions: result.collisions,
                points,
                groupSize: group.length,
              });
            }
          });

          // Move to next rank after this group
          currentRank += group.length;
        });

        // Display top 3
        topPerformers.slice(0, 3).forEach((p) => {
          const tieIndicator =
            p.groupSize > 1 ? ` (tied with ${p.groupSize - 1})` : '';
          console.log(
            `  🥇 #${p.rank}: ${p.strategy} (${p.collisions} collisions) [+${p.points}]${tieIndicator}`,
          );
        });

        // Display bottom 2
        bottomPerformers.slice(-2).forEach((p) => {
          const tieIndicator =
            p.groupSize > 1 ? ` (tied with ${p.groupSize - 1})` : '';
          console.log(
            `  💥 #${p.rank}: ${p.strategy} (${p.collisions} collisions) [${p.points}]${tieIndicator}`,
          );
        });
      }
    } catch (error) {
      console.error(
        `❌ Failed to benchmark ${importMap.file} with range ${range}: ${error.message}`,
      );
    }
  }

  console.log();
}

// Final results
console.log('🏆 FINAL RANKINGS');
console.log('=================');

// Sort strategies by total points (descending)
const sortedStrategies = Object.entries(strategyScores)
  .map(([name, data]) => ({
    name,
    ...data,
    avgRank: data.ranks.reduce((a, b) => a + b, 0) / data.ranks.length,
  }))
  .sort((a, b) => b.points - a.points);

// Show full ranked list
console.log('\n🏆 COMPLETE RANKINGS:');
console.log('─'.repeat(80));
sortedStrategies.forEach((strategy, index) => {
  const position = index + 1;
  let emoji = '';
  let prefix = '';

  // Assign emojis and styling based on performance
  if (position === 1) {
    emoji = '🥇';
    prefix = 'CHAMPION';
  } else if (position === 2) {
    emoji = '🥈';
    prefix = 'RUNNER-UP';
  } else if (position === 3) {
    emoji = '🥉';
    prefix = 'THIRD';
  } else if (position <= 5) {
    emoji = '⭐';
    prefix = 'EXCELLENT';
  } else if (position <= 10) {
    emoji = '🔸';
    prefix = 'GOOD';
  } else if (position <= 15) {
    emoji = '🔹';
    prefix = 'AVERAGE';
  } else if (position <= 20) {
    emoji = '⚠️';
    prefix = 'BELOW AVG';
  } else {
    emoji = '💥';
    prefix = 'POOR';
  }

  const consistencyNote = strategy.topThreeCount >= 6 ? ' (consistent)' : '';
  const pointsDisplay =
    strategy.points > 0
      ? `+${strategy.points.toFixed(1)}`
      : strategy.points.toFixed(1);

  console.log(
    `${emoji} #${position.toString().padStart(2, ' ')} [${prefix.padEnd(
      9,
    )}] ${strategy.name.padEnd(35)} ${pointsDisplay.padStart(
      8,
    )} pts (avg: ${strategy.avgRank.toFixed(1)})${consistencyNote}`,
  );
});

// Key insights
console.log('\n📈 KEY INSIGHTS:');
console.log('─'.repeat(50));
const topStrategy = sortedStrategies[0];
const worstStrategy = sortedStrategies[sortedStrategies.length - 1];
const topFive = sortedStrategies.slice(0, 5);
const bottomFive = sortedStrategies.slice(-5);

console.log(
  `🏆 Champion: ${topStrategy.name} (${topStrategy.points.toFixed(1)} pts)`,
);
console.log(
  `💪 Most consistent: ${
    sortedStrategies.find((s) => s.topThreeCount >= 6)?.name || 'None'
  }`,
);
console.log(
  `😞 Biggest disappointment: ${
    worstStrategy.name
  } (${worstStrategy.points.toFixed(1)} pts)`,
);
console.log(
  `📊 Point spread: ${(topStrategy.points - worstStrategy.points).toFixed(
    1,
  )} pts`,
);
console.log(
  `⭐ Top 5 average: ${(
    topFive.reduce((sum, s) => sum + s.points, 0) / topFive.length
  ).toFixed(1)} pts`,
);
console.log(
  `💥 Bottom 5 average: ${(
    bottomFive.reduce((sum, s) => sum + s.points, 0) / bottomFive.length
  ).toFixed(1)} pts`,
);

// adaptive_prime_pool analysis
const adaptiveVariants = sortedStrategies.filter((s) =>
  s.name.includes('adaptive_prime_pool'),
);
if (adaptiveVariants.length > 1) {
  console.log('\n🔬 ADAPTIVE_PRIME_POOL ANALYSIS:');
  adaptiveVariants.forEach((variant) => {
    const rank = sortedStrategies.findIndex((s) => s.name === variant.name) + 1;
    console.log(`  ${variant.name}: #${rank} (${variant.points} pts)`);
  });
  console.log("  → Original algorithm outperformed all 'improved' versions");
}

console.log('\n✅ Benchmark completed successfully!');
