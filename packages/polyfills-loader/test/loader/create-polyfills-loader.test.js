/** @typedef {import('../../src/loader/create-polyfills-loader').CreatePolyfillsLoaderConfig} CreatePolyfillsLoaderConfig  */

const { expect } = require('chai');
const fs = require('fs');
const path = require('path');
const { createPolyfillsLoader } = require('../../index');
const { noModuleSupportTest, resourceTypes } = require('../../src/utils/constants');

const updateSnapshots = process.argv.includes('--update-snapshots');

/**
 *
 * @param {{ name: string, config: CreatePolyfillsLoaderConfig, expectedFiles?: string[] }} param0
 */
function testSnapshot({ name, config, expectedFiles = [] }) {
  const snapshotPath = path.join(
    __dirname,
    '..',
    'snapshots',
    'create-polyfills-loader',
    `${name}.js`,
  );
  const { code, generatedFiles } = createPolyfillsLoader(config);

  expect(generatedFiles.map(f => f.path)).to.eql(expectedFiles);

  if (updateSnapshots) {
    fs.writeFileSync(snapshotPath, code, 'utf-8');
  } else {
    const snapshot = fs.readFileSync(snapshotPath, 'utf-8');
    expect(code).to.equal(snapshot);
  }
}

describe('loader-script', () => {
  it('generates a loader script with one module resource', () => {
    testSnapshot({
      name: 'module-resource',
      config: {
        resources: [{ type: resourceTypes.JS_MODULE, path: 'app.js' }],
      },
    });
  });

  it('generates a loader script with one system resource', () => {
    testSnapshot({
      name: 'system-resource',
      config: {
        resources: [{ type: resourceTypes.JS_SYSTEMJS, path: 'app.js' }],
      },
      expectedFiles: ['polyfills/systemjs.js'],
    });
  });

  it('generates a loader script with one script resource', () => {
    testSnapshot({
      name: 'script-resource',
      config: {
        resources: [{ type: resourceTypes.JS_SCRIPT, path: 'app.js' }],
      },
      expectedFiles: [],
    });
  });

  it('generates a loader script with multiple resources', () => {
    testSnapshot({
      name: 'module-resources',
      config: {
        resources: [
          { type: resourceTypes.JS_MODULE, path: 'app.js' },
          { type: resourceTypes.JS_SCRIPT, path: 'shared.js' },
          { type: resourceTypes.JS_SYSTEMJS, path: 'other.js' },
        ],
      },
      expectedFiles: ['polyfills/systemjs.js'],
    });
  });

  it('generates a loader script with legacy resources', () => {
    testSnapshot({
      name: 'module-legacy-system',
      config: {
        resources: [{ type: resourceTypes.JS_MODULE, path: 'app.js' }],
        legacyResources: [
          {
            test: noModuleSupportTest,
            resources: [{ type: resourceTypes.JS_SYSTEMJS, path: 'legacy/app.js' }],
          },
        ],
      },
      expectedFiles: ['polyfills/systemjs.js'],
    });
  });

  it('generates a loader script with multiple legacy resources', () => {
    testSnapshot({
      name: 'module-legacy-system-multiple',
      config: {
        resources: [
          { type: resourceTypes.JS_MODULE, path: 'app-1.js' },
          { type: resourceTypes.JS_MODULE, path: 'app-2.js' },
        ],
        legacyResources: [
          {
            test: noModuleSupportTest,
            resources: [
              { type: resourceTypes.JS_SYSTEMJS, path: 'legacy/app-1.js' },
              { type: resourceTypes.JS_SYSTEMJS, path: 'legacy/app-2.js' },
            ],
          },
        ],
      },
      expectedFiles: ['polyfills/systemjs.js'],
    });
  });

  it('generates a loader script with multiple types of legacy resources', () => {
    testSnapshot({
      name: 'multiple-legacy',
      config: {
        resources: [
          { type: resourceTypes.JS_MODULE, path: 'app-1.js' },
          { type: resourceTypes.JS_SCRIPT, path: 'app-2.js' },
        ],
        legacyResources: [
          {
            test: noModuleSupportTest,
            resources: [
              { type: resourceTypes.JS_SYSTEMJS, path: 'legacy/app-1.js' },
              { type: resourceTypes.JS_SCRIPT, path: 'legacy/app-2.js' },
            ],
          },
          {
            test: "'foo' in bar",
            resources: [
              { type: resourceTypes.JS_SCRIPT, path: 'foobar/app-1.js' },
              { type: resourceTypes.JS_SYSTEMJS, path: 'foobar/app-2.js' },
            ],
          },
        ],
      },
      expectedFiles: ['polyfills/systemjs.js'],
    });
  });

  it('generates a loader script with polyfills', () => {
    testSnapshot({
      name: 'polyfills',
      config: {
        resources: [{ type: resourceTypes.JS_MODULE, path: 'app.js' }],
        polyfills: {
          coreJs: true,
          webcomponents: true,
          fetch: true,
        },
      },
      expectedFiles: [
        'polyfills/core-js.js',
        'polyfills/fetch.js',
        'polyfills/webcomponents.js',
        'polyfills/custom-elements-es5-adapter.js',
      ],
    });
  });

  it('generates a loader script with customized polyfills directory', () => {
    testSnapshot({
      name: 'custom-polyfills-dir',
      config: {
        resources: [{ type: resourceTypes.JS_MODULE, path: 'app.js' }],
        polyfillsDir: 'foo/bar',
        polyfills: {
          coreJs: true,
          webcomponents: true,
          fetch: true,
        },
      },
      expectedFiles: [
        'foo/bar/core-js.js',
        'foo/bar/fetch.js',
        'foo/bar/webcomponents.js',
        'foo/bar/custom-elements-es5-adapter.js',
      ],
    });
  });

  it('generates a loader script with legacy resources and polyfills', () => {
    testSnapshot({
      name: 'polyfills-legacy',
      config: {
        resources: [
          { type: resourceTypes.JS_MODULE, path: 'app.js' },
          { type: resourceTypes.JS_MODULE, path: 'shared.js' },
        ],
        legacyResources: [
          {
            test: noModuleSupportTest,
            resources: [
              { type: resourceTypes.JS_SYSTEMJS, path: 'legacy/app.js' },
              { type: resourceTypes.JS_SYSTEMJS, path: 'legacy/shared.js' },
            ],
          },
        ],
        polyfills: {
          coreJs: true,
          webcomponents: true,
          fetch: true,
        },
      },
      expectedFiles: [
        'polyfills/core-js.js',
        'polyfills/fetch.js',
        'polyfills/systemjs.js',
        'polyfills/webcomponents.js',
        'polyfills/custom-elements-es5-adapter.js',
      ],
    });
  });

  it('generates a loader script with a polyfill with an initializer', () => {
    testSnapshot({
      name: 'polyfills-initializer',
      config: {
        resources: [{ type: resourceTypes.JS_MODULE, path: 'app.js' }],
        polyfills: {
          coreJs: true,
          dynamicImport: true,
        },
      },
      expectedFiles: ['polyfills/core-js.js', 'polyfills/dynamic-import.js'],
    });
  });

  it('generates a loader script with a polyfill loaded as a module', () => {
    testSnapshot({
      name: 'polyfills-module',
      config: {
        resources: [{ type: resourceTypes.JS_MODULE, path: 'app.js' }],
        polyfills: {
          coreJs: true,
          esModuleShims: true,
        },
      },
      expectedFiles: ['polyfills/core-js.js', 'polyfills/es-module-shims.js'],
    });
  });

  it('generates a loader script with upwards file path', () => {
    testSnapshot({
      name: 'upwards-file-path',
      config: {
        resources: [{ type: resourceTypes.JS_MODULE, path: '../app.js' }],
      },
      expectedFiles: [],
    });
  });

  it('generates a loader script with an absolute file path', () => {
    testSnapshot({
      name: 'absolute-file-path',
      config: {
        resources: [{ type: resourceTypes.JS_MODULE, path: '/app.js' }],
      },
      expectedFiles: [],
    });
  });
});
