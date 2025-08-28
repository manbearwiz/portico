# 🏛️ Portico

> Generate stable, unique development ports for microfrontends based on package name

Portico assigns each microfrontend a **stable, unique development port** based on its `package.json` name, avoiding collisions without manual tracking.

## 🚀 Quick Start

```bash
# Install globally
npm install -g portico

# Or use with npx (no installation required)
npx portico
```

## 🎯 Problem Solved

In microfrontend architectures, each app needs its own development port. Manual port assignment leads to:

- Port conflicts between developers
- Manual tracking overhead
- Inconsistent ports across environments
- Time wasted on port collision resolution

## ✨ Solution

Portico generates **deterministic ports** by hashing the package name and applying a series of transformations.

**Benefits:**

- ✅ Same app → same port every time
- ✅ Low collision probability within range
- ✅ No shared registry or manual tracking
- ✅ Works in isolated development environments
- ✅ Portable across repos and machines

## 📖 Usage

### CLI Usage

```bash
# Get port for current package (reads ./package.json)
portico
# Output: 4703

# Get port with custom base and range
portico --base 5000 --range 100
# Output: 5067

# Calculate port for any package name
portico --name my-awesome-app
# Output: 4318

# Use custom package.json location
portico --package /path/to/package.json

# Use specific hash and reducer algorithms
portico --name my-app --hash twin --reducer knuth
portico --name my-app --hash double --reducer knuth
portico --name my-app --hash safe --reducer lcg
```

### Integration Examples

```bash
# .env file
PORT=$(portico)

# Or directly in package.json
{
  "scripts": {
    "start": "PORT=$(portico) npm start"
    //or
    "dev": "npm start -- --port $(portico)"
  }
}
```

### Programmatic Usage

```javascript
// ESM (recommended)
import { getPort, getPortFromPackageJson } from "portico";

// Calculate port for any package name
const port1 = getPort("my-awesome-app");

// Get port for current package
const port2 = getPortFromPackageJson();

// Custom configuration with specific algorithms
const port3 = getPort("my-app", 5000, 100, "twin", "knuth");
const port4 = getPort("my-app", 3001, 1997, "double", "knuth");
const port5 = getPort("my-app", 3001, 1997, "safe", "lcg");
```

## ⚙️ Configuration

### CLI Options

| Option      | Short | Description                                      | Default          |
| ----------- | ----- | ------------------------------------------------ | ---------------- |
| `--base`    | `-b`  | Base port number                                 | `3001`           |
| `--range`   | `-r`  | Port range size                                  | `1997`           |
| `--hash`    |       | Hash function: sdbm, safe, twin, cascade, double | `twin`           |
| `--reducer` |       | Reducer: modulo, knuth, lcg                      | `knuth`          |
| `--package` | `-p`  | Path to package.json                             | `./package.json` |
| `--name`    | `-n`  | Package name to use                              | -                |

### Benchmark and Analysis Commands

```bash
# Analyze import map for port collisions
portico analyze -i import-map.json

# Compare all hash+reducer combinations (table output)
portico benchmark -i import-map.json

# Get JSON output for programmatic analysis
portico benchmark -i import-map.json --output json

# Custom range analysis
portico benchmark -i import-map.json --range 997 --base 4000
```

### API Reference

#### `getPort(packageName, basePort?, range?, hash?, reducer?)`

Generate a port for a specific package name.

- `packageName` (string): Package name to hash
- `basePort` (number, optional): Starting port (default: 3001)
- `range` (number, optional): Port range size (default: 1997)
- `hash` (string, optional): Hash function - 'sdbm', 'safe', 'twin', 'cascade', 'double' (default: 'twin')
- `reducer` (string, optional): Reducer function - 'modulo', 'knuth', 'lcg' (default: 'knuth')
- **Returns:** Port number between `basePort` and `basePort + range - 1`

#### `getPortFromPackageJson(packageJsonPath?, basePort?, range?, hash?, reducer?)`

Generate a port by reading the current package.json.

- `packageJsonPath` (string, optional): Path to package.json (default: ./package.json)
- `basePort` (number, optional): Starting port (default: 3001)
- `range` (number, optional): Port range size (default: 1997)
- `hash` (string, optional): Hash function (default: 'twin')
- `reducer` (string, optional): Reducer function (default: 'knuth')
- **Returns:** Port number for the package

#### `analyzeImportMap(importMapPath, basePort?, range?, hash?, reducer?)`

Analyze an import map file for port collisions and distribution.

- `importMapPath` (string): Path to import map JSON file
- `basePort` (number, optional): Starting port (default: 3001)
- `range` (number, optional): Port range size (default: 1997)
- `hash` (string, optional): Hash function (default: 'twin')
- `reducer` (string, optional): Reducer function (default: 'knuth')
- **Returns:** Analysis object with collision data and port distribution

## 🔧 Advanced Usage

### Algorithm Selection

Choose the best hash+reducer combination for your needs:

```javascript
const port = getPort("my-app", 3001, 1997, "twin", "knuth");

const port = getPort("my-app", 3001, 1997, "double", "knuth");

const port = getPort("my-app", 3001, 1997, "safe", "lcg");
```

**Available Hash Functions:**

- `twin` - Twin prime hashing (recommended) 🏆
- `double` - Double hashing algorithm 🥈
- `safe` - Safe prime hashing 🥉
- `cascade` - Prime cascade method
- `sdbm` - Simple SDBM algorithm

**Available Reducers:**

- `knuth` - Multiplicative method (recommended) 🏆
- `lcg` - Linear congruential generator 🥈
- `modulo` - Simple modulo operation 🥉

### Collision Analysis

Analyze your microfrontend ecosystem for potential port conflicts:

```bash
portico analyze -i importmaps.json
```

### Docker Integration

```dockerfile
# Dockerfile
FROM node:18
WORKDIR /app
COPY package*.json ./
RUN npm install

# Generate port at build time
RUN echo "VITE_PORT=$(npx portico)" >> .env

COPY . .
EXPOSE $VITE_PORT
CMD ["npm", "run", "dev"]
```

### CI/CD Integration

```yaml
# .github/workflows/test.yml
- name: Get dev port
  run: echo "DEV_PORT=$(npx portico)" >> $GITHUB_ENV

- name: Start dev server
  run: npm run dev -- --port $DEV_PORT
```

### 🧪 Testing

```bash
# Run tests
npm test

# Watch mode
npm run test:watch

# Test specific package names
portico --name @company/my-app
portico --name my-awesome-microfrontend

# Benchmark different algorithms
portico benchmark -i importmaps.json

# Test collision rates with different configurations
portico benchmark -i importmaps.json --range 787  # Prime range
portico benchmark -i importmaps.json --range 1000 # Round number
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

---

Made with ❤️ for microfrontend developers
