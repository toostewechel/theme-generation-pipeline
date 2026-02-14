import { StyleDictionary } from 'style-dictionary-utils';
import { readFileSync, mkdirSync } from 'fs';

/**
 * Manifest structure matching src/tokens/manifest.json
 */
interface Manifest {
  collections: {
    [collectionName: string]: {
      modes: {
        [modeName: string]: string[];
      };
    };
  };
  styles: {
    [styleName: string]: string[];
  };
}

/**
 * Build tokens using Style Dictionary v5
 * Reads manifest.json and discovers all token files
 */
async function buildTokens() {
  try {
    // Read and parse manifest
    const manifestPath = 'src/tokens/manifest.json';
    const manifestContent = readFileSync(manifestPath, 'utf-8');
    const manifest: Manifest = JSON.parse(manifestContent);

    // Flatten collections to source array with stable sorting
    const sourceFiles: string[] = [];

    // Process collections
    const collectionNames = Object.keys(manifest.collections).sort((a, b) =>
      a.localeCompare(b)
    );

    for (const collectionName of collectionNames) {
      const collection = manifest.collections[collectionName];
      const modeNames = Object.keys(collection.modes).sort((a, b) =>
        a.localeCompare(b)
      );

      for (const modeName of modeNames) {
        const files = collection.modes[modeName];
        for (const file of files) {
          sourceFiles.push(`src/tokens/${file}`);
        }
      }
    }

    // Process styles
    const styleNames = Object.keys(manifest.styles).sort((a, b) =>
      a.localeCompare(b)
    );

    for (const styleName of styleNames) {
      const files = manifest.styles[styleName];
      for (const file of files) {
        sourceFiles.push(`src/tokens/${file}`);
      }
    }

    // Sort final array for deterministic ordering
    sourceFiles.sort((a, b) => a.localeCompare(b));

    console.log(`Discovered ${sourceFiles.length} token files from manifest`);

    // Create output directory
    mkdirSync('dist/css', { recursive: true });

    // Configure Style Dictionary v5
    const sd = new StyleDictionary({
      source: sourceFiles,
      platforms: {
        css: {
          transformGroup: 'css/extended',
          buildPath: 'dist/css/',
          files: [
            {
              destination: 'tokens.css',
              format: 'css/variables',
            },
          ],
        },
      },
    });

    // Build all platforms (async in v5)
    await sd.buildAllPlatforms();

    console.log('Build completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

// Execute
buildTokens();
