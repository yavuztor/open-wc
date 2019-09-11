/* eslint-disable no-param-reassign */
/** @typedef {import('../../src/loader/create-polyfills-loader').CreatePolyfillsLoaderConfig} CreatePolyfillsLoaderConfig  */

const path = require('path');
const { expect } = require('chai');
const { createPolyfillsData } = require('../../src/loader/create-polyfills-data');
const { noModuleSupportTest, resourceTypes } = require('../../src/utils/constants');

describe('polyfills', () => {
  it('returns the correct polyfills data', () => {
    /** @type {CreatePolyfillsLoaderConfig} */
    const config = {
      resources: [{ type: resourceTypes.JS_MODULE, path: './foo.js' }],
      polyfills: {
        hash: true,
        coreJs: true,
        webcomponents: true,
        fetch: true,
        intersectionObserver: true,
        dynamicImport: true,
        esModuleShims: true,
      },
    };

    const polyfills = createPolyfillsData(config);

    // remove code, hash and undefined entries
    polyfills.forEach(p => {
      expect(p.code).to.be.a('string');
      expect(p.hash).to.be.a('string');

      delete p.code;
      delete p.hash;

      Object.entries(p).forEach(([key, value]) => {
        if (value === undefined) {
          delete p[key];
        }
      });
    });

    expect(polyfills).to.eql([
      {
        name: 'core-js',
        test: "!('noModule' in HTMLScriptElement.prototype)",
      },
      {
        name: 'fetch',
        test: "!('fetch' in window)",
      },
      {
        initializer:
          "window.dynamicImportPolyfill.initialize({ importFunctionName: 'importShim' });",
        name: 'dynamic-import',
        test:
          "'noModule' in HTMLScriptElement.prototype && (function () { try { Function('window.importShim = s => import(s);').call(); return true; } catch (_) { return false } })()",
      },
      {
        module: true,
        name: 'es-module-shims',
        test: "'noModule' in HTMLScriptElement.prototype",
      },
      {
        name: 'intersection-observer',
        test:
          "!('IntersectionObserver' in window && 'IntersectionObserverEntry' in window && 'intersectionRatio' in window.IntersectionObserverEntry.prototype)",
      },
      {
        name: 'webcomponents',
        test: "!('attachShadow' in Element.prototype) || !('getRootNode' in Element.prototype)",
      },
      {
        name: 'custom-elements-es5-adapter',
        test: "!('noModule' in HTMLScriptElement.prototype) && 'getRootNode' in Element.prototype",
      },
    ]);
  });

  it('handles systemjs legacy resources', () => {
    const config = {
      resources: [{ type: resourceTypes.JS_MODULE, path: './foo.js' }],
      legacyResources: [
        {
          test: noModuleSupportTest,
          resources: [{ type: resourceTypes.JS_SYSTEMJS, path: './foo.js' }],
        },
      ],
    };

    const polyfills = createPolyfillsData(config);

    // remove code, hash and undefined entries
    polyfills.forEach(p => {
      expect(p.code).to.be.a('string');

      delete p.code;
      delete p.hash;

      Object.entries(p).forEach(([key, value]) => {
        if (value === undefined) {
          delete p[key];
        }
      });
    });

    expect(polyfills).to.eql([
      {
        name: 'systemjs',
        test: "!('noModule' in HTMLScriptElement.prototype)",
      },
    ]);
  });

  it('handles systemjs modern', () => {
    const config = {
      resources: [{ type: resourceTypes.JS_SYSTEMJS, path: './foo.js' }],
    };

    const polyfills = createPolyfillsData(config);

    // remove code, hash and undefined entries
    polyfills.forEach(p => {
      expect(p.code).to.be.a('string');

      delete p.code;
      delete p.hash;

      Object.entries(p).forEach(([key, value]) => {
        if (value === undefined) {
          delete p[key];
        }
      });
    });

    expect(polyfills).to.eql([
      {
        name: 'systemjs',
        test: null,
      },
    ]);
  });

  it('can load custom polyfills', () => {
    const custom = [
      {
        name: 'polyfill-a',
        test: "'foo' in window",
        path: path.resolve(__dirname, 'custom-polyfills/polyfill-a.js'),
      },
      {
        name: 'polyfill-b',
        nomodule: true,
        path: path.resolve(__dirname, 'custom-polyfills/polyfill-b.js'),
      },
    ];
    const config = {
      resources: [{ type: resourceTypes.JS_MODULE, path: './foo.js' }],
      polyfills: {
        hash: true,
        coreJs: true,
        webcomponents: false,
        fetch: false,
        intersectionObserver: false,
        custom,
      },
    };

    const polyfills = createPolyfillsData(config);

    // remove code, hash and undefined entries
    polyfills.forEach(p => {
      expect(p.code).to.be.a('string');
      expect(p.hash).to.be.a('string');

      delete p.code;
      delete p.hash;

      Object.entries(p).forEach(([key, value]) => {
        if (value === undefined) {
          delete p[key];
        }
      });
    });

    expect(polyfills).to.eql([
      {
        name: 'polyfill-a',
        test: "'foo' in window",
      },
      {
        name: 'polyfill-b',
      },
      {
        name: 'core-js',
        test: "!('noModule' in HTMLScriptElement.prototype)",
      },
    ]);
  });
});
