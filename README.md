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

Portico generates **deterministic ports** using:

1. **Package name hashing** (MD5) for consistency
2. **Modulo calculation** within a safe port range
3. **Base port offset** for customization

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
# Output: 4237

# Get port with custom base and range
portico --base 5000 --range 100
# Output: 5067

# Calculate port for any package name
portico --name my-awesome-app
# Output: 4318

# Use custom package.json location
portico --package /path/to/package.json
```

### Integration Examples

#### Angular

```bash
# package.json scripts
{
  "scripts": {
    "start": "ng serve --port=$(portico)",
    "dev": "ng serve --port=$(portico) --host=0.0.0.0"
  }
}
```

#### React (Create React App)

```bash
# .env file
PORT=$(portico)

# Or directly in package.json
{
  "scripts": {
    "start": "PORT=$(portico) react-scripts start"
  }
}
```

#### Webpack Dev Server

```bash
# package.json
{
  "scripts": {
    "dev": "webpack serve --port $(portico)"
  }
}
```

#### Vite

```bash
# package.json
{
  "scripts": {
    "dev": "vite --port $(portico)"
  }
}
```

### Programmatic Usage

```javascript
// ESM (recommended)
import { getPort, getPortFromPackageJson } from "portico";

// Calculate port for any package name
const port1 = getPort("my-awesome-app");
console.log(port1); // 4318

// Get port for current package
const port2 = getPortFromPackageJson();
console.log(port2); // Based on current package.json name

// Custom configuration
const port3 = getPort("my-app", 5000, 100); // base=5000, range=100
console.log(port3); // Between 5000-5099
```

```javascript
// CommonJS (legacy)
const { getPort, getPortFromPackageJson } = require("portico");

// Same usage as above
const port = getPort("my-awesome-app");
console.log(port); // 4318
```

## ⚙️ Configuration

### CLI Options

| Option      | Short | Description          | Default          |
| ----------- | ----- | -------------------- | ---------------- |
| `--base`    | `-b`  | Base port number     | `4200`           |
| `--range`   | `-r`  | Port range size      | `200`            |
| `--package` | `-p`  | Path to package.json | `./package.json` |
| `--name`    | `-n`  | Package name to use  | -                |

### Port Range Recommendations

| Framework   | Suggested Base | Range | Total Range |
| ----------- | -------------- | ----- | ----------- |
| **Angular** | `4200`         | `200` | `4200-4399` |
| **React**   | `3000`         | `200` | `3000-3199` |
| **Vue**     | `8080`         | `200` | `8080-8279` |
| **Custom**  | `5000`         | `500` | `5000-5499` |

### API Reference

#### `getPort(packageName, basePort?, range?)`

Generate a port for a specific package name.

- `packageName` (string): Package name to hash
- `basePort` (number, optional): Starting port (default: 4200)
- `range` (number, optional): Port range size (default: 200)
- **Returns:** Port number between `basePort` and `basePort + range - 1`

#### `getPortFromPackageJson(packageJsonPath?, basePort?, range?)`

Generate a port by reading the current package.json.

- `packageJsonPath` (string, optional): Path to package.json (default: ./package.json)
- `basePort` (number, optional): Starting port (default: 4200)
- `range` (number, optional): Port range size (default: 200)
- **Returns:** Port number for the package

## 🔧 Advanced Usage

### Team Configuration

Create a shared configuration file:

```javascript
// scripts/dev-ports.js
import { getPort } from "portico";

const TEAM_CONFIG = {
  basePort: 4200,
  range: 200,
};

function getTeamPort(packageName) {
  return getPort(packageName, TEAM_CONFIG.basePort, TEAM_CONFIG.range);
}

export { getTeamPort };
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
```

## 📊 Port Distribution

Portico uses MD5 hashing with modulo arithmetic for even distribution:

```javascript
// Example outputs with default config (base: 4200, range: 200)
getPort("app-auth"); // → 4237
getPort("app-dashboard"); // → 4318
getPort("app-profile"); // → 4156
getPort("@company/app"); // → 4389
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🔗 Related

- [Webpack Dev Server](https://webpack.js.org/configuration/dev-server/)
- [Angular CLI](https://angular.io/cli)
- [Create React App](https://create-react-app.dev/)
- [Vite](https://vitejs.dev/)

---

Made with ❤️ for microfrontend developers
