import { StyleDictionary } from 'style-dictionary-utils';
import { readFileSync, mkdirSync, writeFileSync, unlinkSync } from 'fs';

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
 * Build tokens using Style Dictionary v5 with multi-mode CSS output
 * Handles token name collisions across modes by building separately and concatenating
 */
async function buildTokens() {
  try {
    // Read and parse manifest
    const manifestPath = 'src/tokens/manifest.json';
    const manifestContent = readFileSync(manifestPath, 'utf-8');
    const manifest: Manifest = JSON.parse(manifestContent);

    // Identify base files (primitives, single-mode collections)
    const baseFiles: string[] = [];
    const colorModes: { [mode: string]: string[] } = {};
    const radiusModes: { [mode: string]: string[] } = {};

    // Process collections
    for (const collectionName of Object.keys(manifest.collections)) {
      const collection = manifest.collections[collectionName];
      const modes = Object.keys(collection.modes);

      if (collectionName === 'color' && modes.length > 1) {
        // Multi-mode color collection
        for (const mode of modes) {
          colorModes[mode] = collection.modes[mode].map(f => `src/tokens/${f}`);
        }
      } else if (collectionName === 'radius' && modes.length > 1) {
        // Multi-mode radius collection
        for (const mode of modes) {
          radiusModes[mode] = collection.modes[mode].map(f => `src/tokens/${f}`);
        }
      } else {
        // Single-mode or primitive collection
        for (const mode of modes) {
          baseFiles.push(...collection.modes[mode].map(f => `src/tokens/${f}`));
        }
      }
    }

    // Process styles
    for (const styleName of Object.keys(manifest.styles)) {
      baseFiles.push(...manifest.styles[styleName].map(f => `src/tokens/${f}`));
    }

    console.log(`Building multi-mode CSS...`);
    console.log(`Base files: ${baseFiles.length}`);
    console.log(`Color modes: ${Object.keys(colorModes).join(', ')}`);
    console.log(`Radius modes: ${Object.keys(radiusModes).join(', ')}`);

    // Create output directory
    mkdirSync('dist/css', { recursive: true });

    const tempFiles: string[] = [];
    let cssOutput = '/**\n * Do not edit directly, this file was auto-generated.\n */\n\n';

    // Build 1: :root with base tokens + light color + default radius
    const rootSources = [
      ...baseFiles,
      ...(colorModes['light'] || []),
      ...(radiusModes['default'] || []),
    ];

    const sdRoot = new StyleDictionary({
      source: rootSources,
      log: { warnings: 'disabled' }, // Suppress collision warnings
      platforms: {
        css: {
          transformGroup: 'css/extended',
          buildPath: 'dist/css/',
          files: [
            {
              destination: '_temp_root.css',
              format: 'css/variables',
              options: {
                outputReferences: true,
                selector: ':root',
              },
            },
          ],
        },
      },
    });

    await sdRoot.buildAllPlatforms();
    const rootCss = readFileSync('dist/css/_temp_root.css', 'utf-8')
      .replace(/\/\*\*[\s\S]*?\*\/\n\n/, ''); // Remove auto-generated comment
    cssOutput += rootCss;
    tempFiles.push('dist/css/_temp_root.css');

    // Build 2: [data-color-mode='light']
    if (colorModes['light']) {
      const sdLight = new StyleDictionary({
        source: [...baseFiles, ...colorModes['light']],
        log: { warnings: 'disabled' },
        platforms: {
          css: {
            transformGroup: 'css/extended',
            buildPath: 'dist/css/',
            files: [
              {
                destination: '_temp_light.css',
                format: 'css/variables',
                filter: (token: any) => token.filePath.includes('color.light.tokens.json'),
                options: {
                  outputReferences: true,
                  selector: "[data-color-mode='light']",
                },
              },
            ],
          },
        },
      });

      await sdLight.buildAllPlatforms();
      const lightCss = readFileSync('dist/css/_temp_light.css', 'utf-8')
        .replace(/\/\*\*[\s\S]*?\*\/\n\n/, '');
      cssOutput += lightCss;
      tempFiles.push('dist/css/_temp_light.css');
    }

    // Build 3: [data-color-mode='dark']
    if (colorModes['dark']) {
      const sdDark = new StyleDictionary({
        source: [...baseFiles, ...colorModes['dark']],
        log: { warnings: 'disabled' },
        platforms: {
          css: {
            transformGroup: 'css/extended',
            buildPath: 'dist/css/',
            files: [
              {
                destination: '_temp_dark.css',
                format: 'css/variables',
                filter: (token: any) => token.filePath.includes('color.dark.tokens.json'),
                options: {
                  outputReferences: true,
                  selector: "[data-color-mode='dark']",
                },
              },
            ],
          },
        },
      });

      await sdDark.buildAllPlatforms();
      const darkCss = readFileSync('dist/css/_temp_dark.css', 'utf-8')
        .replace(/\/\*\*[\s\S]*?\*\/\n\n/, '');
      cssOutput += darkCss;
      tempFiles.push('dist/css/_temp_dark.css');
    }

    // Build 4-7: Radius modes
    const radiusModeOrder = ['sharp', 'default', 'rounded', 'pill'];
    for (const mode of radiusModeOrder) {
      if (radiusModes[mode]) {
        const sdRadius = new StyleDictionary({
          source: [...baseFiles, ...radiusModes[mode]],
          log: { warnings: 'disabled' },
          platforms: {
            css: {
              transformGroup: 'css/extended',
              buildPath: 'dist/css/',
              files: [
                {
                  destination: `_temp_radius_${mode}.css`,
                  format: 'css/variables',
                  filter: (token: any) => token.filePath.includes(`radius.${mode}.tokens.json`),
                  options: {
                    outputReferences: true,
                    selector: `[data-radius-mode='${mode}']`,
                  },
                },
              ],
            },
          },
        });

        await sdRadius.buildAllPlatforms();
        const radiusCss = readFileSync(`dist/css/_temp_radius_${mode}.css`, 'utf-8')
          .replace(/\/\*\*[\s\S]*?\*\/\n\n/, '');
        cssOutput += radiusCss;
        tempFiles.push(`dist/css/_temp_radius_${mode}.css`);
      }
    }

    // Write final combined CSS file
    writeFileSync('dist/css/tokens.css', cssOutput, 'utf-8');

    // Clean up temporary files
    for (const tempFile of tempFiles) {
      try {
        unlinkSync(tempFile);
      } catch (e) {
        // Ignore cleanup errors
      }
    }

    console.log('\nBuild completed successfully');
    console.log('✔ dist/css/tokens.css');
    process.exit(0);
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

// Execute
buildTokens();
