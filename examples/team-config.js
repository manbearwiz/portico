const { getPort } = require('../index');

// Example: Team configuration for consistent port ranges
const TEAM_CONFIG = {
  // Development port ranges by framework
  angular: { base: 4200, range: 200 }, // 4200-4399
  react: { base: 3000, range: 200 }, // 3000-3199
  vue: { base: 8080, range: 200 }, // 8080-8279
  api: { base: 5000, range: 100 }, // 5000-5099
};

/**
 * Get a port for an Angular microfrontend
 */
function getAngularPort(packageName) {
  const config = TEAM_CONFIG.angular;
  return getPort(packageName, config.base, config.range);
}

/**
 * Get a port for a React microfrontend
 */
function getReactPort(packageName) {
  const config = TEAM_CONFIG.react;
  return getPort(packageName, config.base, config.range);
}

/**
 * Get a port for a Vue microfrontend
 */
function getVuePort(packageName) {
  const config = TEAM_CONFIG.vue;
  return getPort(packageName, config.base, config.range);
}

/**
 * Get a port for an API service
 */
function getApiPort(packageName) {
  const config = TEAM_CONFIG.api;
  return getPort(packageName, config.base, config.range);
}

// Example usage
console.log('📍 Example Port Assignments:');
console.log('');

const apps = [
  { name: '@company/shell-app', type: 'angular' },
  { name: '@company/auth-app', type: 'react' },
  { name: '@company/dashboard-app', type: 'vue' },
  { name: '@company/user-api', type: 'api' },
  { name: '@company/product-api', type: 'api' },
];

apps.forEach((app) => {
  let port;
  switch (app.type) {
    case 'angular':
      port = getAngularPort(app.name);
      break;
    case 'react':
      port = getReactPort(app.name);
      break;
    case 'vue':
      port = getVuePort(app.name);
      break;
    case 'api':
      port = getApiPort(app.name);
      break;
  }
  console.log(`${app.name.padEnd(25)} → ${port} (${app.type})`);
});

console.log('');
console.log(
  '✅ All ports are deterministic and collision-free within their ranges!',
);

module.exports = {
  getAngularPort,
  getReactPort,
  getVuePort,
  getApiPort,
  TEAM_CONFIG,
};
