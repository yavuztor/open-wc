/** @typedef {import('../../src/html/inject-polyfills-loader').InjectPolyfillsConfig} InjectPolyfillsConfig */
/** @typedef {import('../../src/html/inject-polyfills-loader').GeneratedFile} GeneratedFile */

const { expect } = require('chai');
const path = require('path');
const fs = require('fs');
const { injectPolyfillsLoader } = require('../../src/html/inject-polyfills-loader');
const { noModuleSupportTest, resourceTypes } = require('../../src/utils/constants');

const updateSnapshots = process.argv.includes('--update-snapshots');

/**
 * @param {GeneratedFile[]} files
 */
function stripContent(files) {
  return files.map(file => {
    const newFile = { ...file };
    delete newFile.content;
    return newFile;
  });
}

const defaultConfig = {
  jsScripts: true,
  jsModules: true,
  inlineJsScripts: true,
  inlineJsModules: true,
};

/**
 *
 * @param {string} name
 * @param {string} htmlString
 * @param {InjectPolyfillsConfig} config
 */
function testSnapshot(name, htmlString, config, expectedGeneratedFiles = []) {
  const snapshotPath = path.join(
    __dirname,
    '..',
    'snapshots',
    'inject-polyfills-loader',
    `${name}.html`,
  );
  const result = injectPolyfillsLoader(htmlString, config);

  expect(stripContent([...result.inlineScripts, ...result.polyfills])).to.eql(
    expectedGeneratedFiles,
  );

  if (updateSnapshots) {
    fs.writeFileSync(snapshotPath, result.htmlString, 'utf-8');
  } else {
    const snapshot = fs.readFileSync(snapshotPath, 'utf-8');
    expect(result.htmlString).to.equal(snapshot);
  }
}

describe('inject-polyfills-loader', () => {
  it('does not do anything when there are no polyfills or legacy loaders', () => {
    const html = `
      <div>before</div>
      <script type="module" src="./app.js"></script>
      <div>after</div>
    `;

    testSnapshot('no-polyfills-no-loaders', html, defaultConfig);
  });

  it('injects a loader with module and polyfills', () => {
    const html = `
      <div>before</div>
      <script type="module" src="./app.js"></script>
      <div>after</div>
    `;

    testSnapshot(
      'module-and-polyfills',
      html,
      {
        ...defaultConfig,
        polyfills: {
          fetch: true,
        },
      },
      [
        {
          path: 'polyfills/fetch.js',
          type: 'js-script',
        },
      ],
    );
  });

  it('injects a loader with module and legacy', () => {
    const html = `
      <div>before</div>
      <script type="module" src="./app.js"></script>
      <div>after</div>
    `;

    testSnapshot(
      'module-and-legacy',
      html,
      {
        ...defaultConfig,
        polyfills: {
          intersectionObserver: true,
        },
        legacy: [
          {
            test: noModuleSupportTest,
            moduleType: resourceTypes.JS_SYSTEMJS,
          },
        ],
      },
      [
        {
          path: 'polyfills/systemjs.js',
          type: 'js-script',
        },
        {
          path: 'polyfills/intersection-observer.js',
          type: 'js-script',
        },
      ],
    );
  });

  it('injects a loader with module, legacy and polyfills', () => {
    const html = `
      <div>before</div>
      <script type="module" src="./app.js"></script>
      <div>after</div>
    `;

    testSnapshot(
      'module-and-legacy-polyfills',
      html,
      {
        ...defaultConfig,
        legacy: [
          {
            test: noModuleSupportTest,
            moduleType: resourceTypes.JS_SYSTEMJS,
          },
        ],
      },
      [
        {
          path: 'polyfills/systemjs.js',
          type: 'js-script',
        },
      ],
    );
  });

  it('preserves module order', () => {
    const html = `
      <div>before</div>
      <script type="module" src="./a.js"></script>
      <script type="module" src="./b.js"></script>
      <div>after</div>
    `;

    testSnapshot(
      'module-order',
      html,
      {
        ...defaultConfig,
        polyfills: {
          intersectionObserver: true,
        },
      },
      [
        {
          path: 'polyfills/intersection-observer.js',
          type: 'js-script',
        },
      ],
    );
  });

  it('loads scripts before modules', () => {
    const html = `
      <div>before</div>
      <script src="script-a.js"></script>
      <script type="module" src="./module-a.js"></script>
      <script src="script-b.js"></script>
      <script type="module" src="./module-b.js"></script>
      <div>after</div>
    `;

    testSnapshot(
      'module-and-scripts',
      html,
      {
        ...defaultConfig,
        polyfills: {
          intersectionObserver: true,
        },
      },
      [
        {
          path: 'polyfills/intersection-observer.js',
          type: 'js-script',
        },
      ],
    );
  });

  it('loads deferred scripts with modules', () => {
    const html = `
      <div>before</div>
      <script type="module" src="./module-a.js"></script>
      <script defer src="script-a.js"></script>
      <script src="script-b.js"></script>
      <script type="module" src="./module-b.js"></script>
      <div>after</div>
    `;

    testSnapshot(
      'module-and-defer-scripts',
      html,
      {
        ...defaultConfig,
        polyfills: {
          intersectionObserver: true,
        },
      },
      [
        {
          path: 'polyfills/intersection-observer.js',
          type: 'js-script',
        },
      ],
    );
  });

  it('can include scripts with a legacy loader', () => {
    const html = `
      <div>before</div>
      <script src="script-a.js"></script>
      <script type="module" src="./module-a.js"></script>
      <script src="script-b.js"></script>
      <script type="module" src="./module-b.js"></script>
      <div>after</div>
    `;

    testSnapshot(
      'module-and-scripts-legacy',
      html,
      {
        ...defaultConfig,
        legacy: [
          {
            test: noModuleSupportTest,
            moduleType: resourceTypes.JS_SYSTEMJS,
          },
        ],
      },
      [
        {
          path: 'polyfills/systemjs.js',
          type: 'js-script',
        },
      ],
    );
  });

  it('does not polyfill import maps', () => {
    const html = `
      <head>
        <script type="importmap">{ "imports": { "foo": "bar" } }</script>
      </head>
      <div>before</div>
      <script type="module" src="./module-a.js"></script>
      <div>after</div>
    `;

    testSnapshot('no-importmap', html, defaultConfig);
  });

  it('polyfills importmaps when main module type is systemjs', () => {
    const html = `
      <head>
        <script type="importmap">{ "imports": { "foo": "bar" } }</script>
      </head>
      <div>before</div>
      <script type="module" src="./module-a.js"></script>
      <div>after</div>
    `;

    testSnapshot(
      'importmap-main',
      html,
      {
        ...defaultConfig,
        moduleType: resourceTypes.JS_SYSTEMJS,
      },
      [
        {
          path: 'polyfills/systemjs.js',
          type: 'js-script',
        },
      ],
    );
  });

  it('polyfills importmaps when legacy is systemjs', () => {
    const html = `
      <head>
        <script type="importmap">{ "imports": { "foo": "bar" } }</script>
      </head>
      <div>before</div>
      <script type="module" src="./module-a.js"></script>
      <div>after</div>
    `;

    testSnapshot(
      'importmap-legacy',
      html,
      {
        ...defaultConfig,
        legacy: [
          {
            test: noModuleSupportTest,
            moduleType: resourceTypes.JS_SYSTEMJS,
          },
        ],
      },
      [
        {
          path: 'polyfills/systemjs.js',
          type: 'js-script',
        },
      ],
    );
  });

  it('can exclude scripts', () => {
    const html = `
      <div>before</div>
      <script src="foo"></script>
      <script>
        // inline script
      </script>
      <script type="module" src="./module-a.js"></script>
      <div>after</div>
    `;

    testSnapshot(
      'ignore-inline-scripts',
      html,
      {
        ...defaultConfig,
        jsScripts: false,
        inlineJsScripts: false,
        legacy: [
          {
            test: noModuleSupportTest,
            moduleType: resourceTypes.JS_SYSTEMJS,
          },
        ],
      },
      [
        {
          path: 'polyfills/systemjs.js',
          type: 'js-script',
        },
      ],
    );
  });

  it('can inject extra resources', () => {
    const html = `
      <div>before</div>
      <script type="module" src="./module-a.js"></script>
      <div>after</div>
    `;

    testSnapshot(
      'extra-resources',
      html,
      {
        ...defaultConfig,
        moduleType: resourceTypes.JS_SYSTEMJS,
        extraResources: [
          { path: '/exta/module.js', type: resourceTypes.JS_SYSTEMJS },
          { path: '/exta/script.js', type: resourceTypes.JS_SYSTEMJS },
        ],
      },
      [
        {
          path: 'polyfills/systemjs.js',
          type: 'js-script',
        },
      ],
    );
  });

  it('can inject extra legacy resources', () => {
    const html = `
      <div>before</div>
      <script type="module" src="./module-a.js"></script>
      <div>after</div>
    `;

    testSnapshot(
      'extra-resources-legacy',
      html,
      {
        ...defaultConfig,
        legacy: [
          {
            test: noModuleSupportTest,
            moduleType: resourceTypes.JS_SYSTEMJS,
            extraResources: [
              { path: '/exta/module.js', type: resourceTypes.JS_SYSTEMJS },
              { path: '/exta/script.js', type: resourceTypes.JS_SYSTEMJS },
            ],
          },
        ],
      },
      [
        {
          path: 'polyfills/systemjs.js',
          type: 'js-script',
        },
      ],
    );
  });
});
