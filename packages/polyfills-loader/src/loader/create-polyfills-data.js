const path = require('path');
const fs = require('fs');
const Terser = require('terser');
const { createContentHash, hasResourceOfType } = require('../utils/utils');

const noModuleTest = "!('noModule' in HTMLScriptElement.prototype)";

/** @typedef {import('./create-polyfills-loader').CreatePolyfillsLoaderConfig} CreatePolyfillsLoaderConfig  */
/** @typedef {import('./create-polyfills-loader').PolyfillConfig} PolyfillConfig  */
/** @typedef {import('./create-polyfills-loader').PolyfillsData} PolyfillsData  */

/**
 * @param {CreatePolyfillsLoaderConfig} config
 * @returns {PolyfillsData[]}
 */
function createPolyfillsData(config) {
  const { polyfills = {} } = config;

  /** @type {PolyfillConfig[]} */
  const polyfillConfigs = [...(polyfills.custom || [])];

  /**
   * @param {PolyfillConfig} polyfillConfig
   * @param {string} [pkg]
   */
  function addPolyfillConfig(polyfillConfig, pkg) {
    try {
      polyfillConfigs.push(polyfillConfig);
    } catch (error) {
      if (error.code === 'MODULE_NOT_FOUND') {
        throw new Error(
          `configured to polyfill ${polyfillConfig.name},` +
            ` but no polyfills found. Install with "npm i -D ${pkg || polyfillConfig.name}"`,
        );
      }

      throw error;
    }
  }

  if (polyfills.coreJs) {
    addPolyfillConfig(
      {
        name: 'core-js',
        path: require.resolve('core-js-bundle/minified.js'),
        test: noModuleTest,
      },
      'core-js-bundle',
    );
  }

  if (polyfills.regeneratorRuntime) {
    addPolyfillConfig({
      name: 'regenerator-runtime',
      test: polyfills.regeneratorRuntime !== 'always' ? noModuleTest : null,
      path: require.resolve('regenerator-runtime/runtime'),
    });
  }

  if (polyfills.fetch) {
    addPolyfillConfig(
      {
        name: 'fetch',
        test: "!('fetch' in window)",
        path: require.resolve('whatwg-fetch/dist/fetch.umd.js'),
      },
      'whatwg-fetch',
    );
  }

  // load systemjs, an es module polyfill, if one of the entries needs it
  if (hasResourceOfType(config, 'systemjs')) {
    const name = 'systemjs';
    // if only legacy is systemjs, use a nomodule test to load it
    const test = config.resources.some(r => r.type === 'systemjs') ? null : noModuleTest;

    if (polyfills.systemJsExtended) {
      // full systemjs, including import maps polyfill
      addPolyfillConfig({
        name,
        test,
        path: require.resolve('systemjs/dist/system.min.js'),
      });
    } else {
      // plain systemjs as es module polyfill
      addPolyfillConfig({
        name,
        test,
        path: require.resolve('systemjs/dist/s.min.js'),
      });
    }
  }

  if (polyfills.dynamicImport) {
    addPolyfillConfig({
      name: 'dynamic-import',
      /**
       * dynamic import is syntax, not an actual function so we cannot feature detect it without using an import statement.
       * using a dynamic import on a browser which doesn't support it throws a syntax error and prevents the entire script
       * from being run, so we need to dynamically create and execute a function and catch the error.
       *
       * CSP can block the dynamic function, in which case the polyfill will always be loaded which is ok. The polyfill itself
       * uses Blob, which might be blocked by CSP as well. In that case users should use systemjs instead.
       */
      test:
        "'noModule' in HTMLScriptElement.prototype && " +
        "(function () { try { Function('window.importShim = s => import(s);').call(); return true; } catch (_) { return false } })()",
      path: require.resolve('dynamic-import-polyfill/dist/dynamic-import-polyfill.umd.js'),
      initializer: "window.dynamicImportPolyfill.initialize({ importFunctionName: 'importShim' });",
    });
  }

  if (polyfills.esModuleShims) {
    addPolyfillConfig({
      name: 'es-module-shims',
      test: "'noModule' in HTMLScriptElement.prototype",
      path: require.resolve('es-module-shims/dist/es-module-shims.min.js'),
      module: true,
    });
  }

  if (polyfills.intersectionObserver) {
    addPolyfillConfig({
      name: 'intersection-observer',
      test:
        "!('IntersectionObserver' in window && 'IntersectionObserverEntry' in window && 'intersectionRatio' in window.IntersectionObserverEntry.prototype)",
      path: require.resolve('intersection-observer/intersection-observer.js'),
      minify: true,
    });
  }

  if (polyfills.webcomponents) {
    addPolyfillConfig(
      {
        name: 'webcomponents',
        test: "!('attachShadow' in Element.prototype) || !('getRootNode' in Element.prototype)",
        path: require.resolve('@webcomponents/webcomponentsjs/webcomponents-bundle.js'),
      },
      '@webcomponents/webcomponentsjs',
    );

    // If a browser does not support nomodule attribute, but does support custom elements, we need
    // to load the custom elements es5 adapter. This is the case for Safari 10.1
    addPolyfillConfig(
      {
        name: 'custom-elements-es5-adapter',
        test: "!('noModule' in HTMLScriptElement.prototype) && 'getRootNode' in Element.prototype",
        path: require.resolve('@webcomponents/webcomponentsjs/custom-elements-es5-adapter.js'),
      },
      '@webcomponents/webcomponentsjs',
    );
  }

  return polyfillConfigs.map(polyfillConfig => {
    if (!polyfillConfig.name || !polyfillConfig.path) {
      throw new Error(`A polyfill should have a name and a path property.`);
    }

    const codePath = path.resolve(polyfillConfig.path);
    if (!codePath || !fs.existsSync(codePath) || !fs.statSync(codePath).isFile()) {
      throw new Error(`Could not find a file at ${polyfillConfig.path}`);
    }

    let code = fs.readFileSync(codePath, 'utf-8');
    /** @type {string} */
    if (polyfillConfig.minify) {
      const minifyResult = Terser.minify(code, { sourceMap: false });
      // @ts-ignore
      ({ code } = minifyResult);
    }

    return {
      name: polyfillConfig.name,
      code,
      test: polyfillConfig.test,
      hash: polyfills.hash ? createContentHash(code) : null,
      module: polyfillConfig.module,
      initializer: polyfillConfig.initializer,
    };
  });
}

module.exports = {
  createPolyfillsData,
};
