/* eslint-disable prefer-template */
const path = require('path');
const { resourceTypes, generatedFileTypes } = require('../utils/constants');
const { cleanImportPath, hasResourceOfType } = require('../utils/utils');
const { createPolyfillsData } = require('./create-polyfills-data');

/**
 * @typedef {object} PolyfillsData
 * @property {string} name
 * @property {string} [test]
 * @property {string} code
 * @property {string} hash
 * @property {boolean} [module]
 * @property {string} [initializer]
 */

/**
 * @typedef {object} PolyfillConfig
 * @property {string} name name of the polyfill
 * @property {string} path polyfill path
 * @property {string} [test] expression which should evaluate to true to load the polyfill
 * @property {boolean} [module] wether to load the polyfill with type module
 * @property {boolean} [minify] whether to minify the polyfill
 * @property {string} [initializer] code used to initialze the module
 */

/**
 * @typedef {object} PolyfillsConfig
 * @property {PolyfillConfig[]} [custom] custom polyfills specified by the user
 * @property {boolean} [hash]
 * @property {boolean} [coreJs] whether to polyfill core-js polyfills
 * @property {boolean | string} [regeneratorRuntime] whether to add regenerator runtime
 * @property {boolean} [webcomponents] whether to polyfill webcomponents
 * @property {boolean} [fetch] whether to polyfill fetch
 * @property {boolean} [intersectionObserver] whether to polyfill intersection observer
 * @property {boolean} [dynamicImport] whether to polyfill dynamic import
 * @property {boolean} [systemJsExtended] whether to polyfill systemjs, extended version with import maps
 * @property {boolean} [esModuleShims] whether to polyfill es modules using es module shims
 */

/**
 * @typedef {object} Resource
 * @property {string} type
 * @property {string} path
 */

/**
 * @typedef {object} LegacyResources
 * @property {string} test
 * @property {Resource[]} resources
 */

/**
 * @typedef {object} CreatePolyfillsLoaderConfig
 * @property {Resource[]} resources
 * @property {string} [polyfillsDir]
 * @property {LegacyResources[]} [legacyResources]
 * @property {PolyfillsConfig} [polyfills]
 */

/**
 * @typedef {object} GeneratedFile
 * @property {string} type
 * @property {string} path
 * @property {string} content
 */

/**
 * @typedef {object} PolyfillsLoader
 * @property {string} code
 * @property {GeneratedFile[]} generatedFiles
 */

const DEFAULT_POLYFILLS_DIR = 'polyfills';

/**
 * Function which loads a script dynamically, returning a thenable (object with then function)
 * because Promise might not be loaded yet
 */
const loadScriptFunction = `  function loadScript(src, type) {
    var loaded = false, thenCb, s = document.createElement('script');
    function resolve() {
      document.head.removeChild(s);
      thenCb ? thenCb() : loaded = true;
    }
    s.src = src;
    s.onload = resolve;
    s.onerror = function () {
      console.error('[polyfills-loader] failed to load: ' + src + ' check the network tab for HTTP status.');
      resolve();
    }
    if (type) s.type = type;
    document.head.appendChild(s);
    return { then: function (cb) { loaded ? cb() : thenCb = cb; } };
  }\n\n`;

/**
 * Returns the loadScriptFunction if a script will be loaded for this config.
 * @param {CreatePolyfillsLoaderConfig} cfg
 * @param {PolyfillsData[]} polyfills
 * @returns {string}
 */
function createLoadScriptCode(cfg, polyfills) {
  const { JS_SCRIPT, JS_MODULE, JS_MODULE_SHIM } = resourceTypes;
  if (
    (polyfills && polyfills.length > 0) ||
    [JS_SCRIPT, JS_MODULE, JS_MODULE_SHIM].some(type => hasResourceOfType(cfg, type))
  ) {
    return loadScriptFunction;
  }

  return '';
}

/**
 * Returns a js statement which loads the given resource in the browser.
 * @param {Resource} resource
 */
function createLoadResource(resource) {
  const resourePath = cleanImportPath(resource.path);

  switch (resource.type) {
    case resourceTypes.JS_SCRIPT:
      return `loadScript('${resourePath}')`;
    case resourceTypes.JS_MODULE:
      return `loadScript('${resourePath}', 'module')`;
    case resourceTypes.JS_MODULE_SHIM:
      return `loadScript('${resourePath}', 'module-shim')`;
    case resourceTypes.JS_SYSTEMJS:
      return `System.import('${resourePath}')`;
    default:
      throw new Error(`Unknown resource type: ${resource.type}`);
  }
}

/**
 * Creates a statement which loads the given resources in the browser sequentually.
 * @param {Resource[]} resources
 */
function createLoadResources(resources) {
  if (resources.length === 1) {
    return createLoadResource(resources[0]);
  }

  return `  [${resources.map(
    r => `function() { return ${createLoadResource(r)} }`,
  )}].reduce(function (a, c) {
    return a.then(c);
  }, Promise.resolve())`;
}

/**
 * Creates js code which loads the correct resources, uses runtime feature detection
 * of legacy resources are configured to load the appropriate resources.
 * @param {CreatePolyfillsLoaderConfig} cfg
 */
function createLoadResourcesFunction(cfg) {
  const loadResources = createLoadResources(cfg.resources);
  if (!cfg.legacyResources || cfg.legacyResources.length === 0) {
    return loadResources;
  }

  // needs to be separate otherwise typescript complains about reduce types
  function reduceFn(all, current, i) {
    return `${all}${i !== 0 ? ' else ' : ''}if (${current.test}) {
      ${createLoadResources(current.resources)}
    }`;
  }
  const loadLegacyResources = cfg.legacyResources.reduce(reduceFn, '');

  return `${loadLegacyResources} else {
      ${loadResources}
    }`;
}

/**
 * Creates js code which waits for polyfills if applicable, and executes
 * the code which loads resources.
 * @param {CreatePolyfillsLoaderConfig} cfg
 * @param {PolyfillsData[]} polyfills
 * @returns {string}
 */
function createLoadResourcesCode(cfg, polyfills) {
  const loadResourcesFunction = createLoadResourcesFunction(cfg);

  // create a separate loadResources to be run after polyfills
  if (polyfills && polyfills.length > 0) {
    return `
  function loadResources() {
    ${loadResourcesFunction}
  }

  polyfills.length ? Promise.all(polyfills).then(loadResources) : loadResources();\n`;
  }

  // there are no polyfills, load entries straight away
  return `${loadResourcesFunction}\n`;
}

/**
 * Creates code which loads the configured polyfills
 * @param {CreatePolyfillsLoaderConfig} cfg
 * @param {PolyfillsData[]} polyfills
 * @returns {{ loadPolyfillsCode: string, generatedFiles: GeneratedFile[] }}
 */
function createPolyfillsLoaderCode(cfg, polyfills) {
  if (!polyfills || polyfills.length === 0) {
    return { loadPolyfillsCode: '', generatedFiles: [] };
  }
  const polyfillsDir = cfg.polyfillsDir || DEFAULT_POLYFILLS_DIR;
  /** @type {GeneratedFile[]} */
  const generatedFiles = [];
  let loadPolyfillsCode = '  var polyfills = [];\n';

  polyfills.forEach(polyfill => {
    const name = `${polyfill.name}${polyfill.hash ? `.${polyfill.hash}` : ''}.js`;
    const filePath = path.posix.join(polyfillsDir, name);
    let loadScript = `loadScript('./${filePath}'${polyfill.module ? ", 'module'" : ''})`;
    if (polyfill.initializer) {
      loadScript += `.then(function () { ${polyfill.initializer} })`;
    }
    const loadPolyfillCode = `polyfills.push(${loadScript})`;

    if (polyfill.test) {
      loadPolyfillsCode += `  if (${polyfill.test}) { ${loadPolyfillCode} }\n`;
    } else {
      loadPolyfillsCode += `  ${loadPolyfillCode}\n`;
    }

    generatedFiles.push({
      type: generatedFileTypes.JS_SCRIPT,
      path: filePath,
      content: polyfill.code,
    });
  });

  return { loadPolyfillsCode, generatedFiles };
}

/**
 * Creates a loader script that executes immediately, loading the configured
 * polyfills and resources (app entrypoints, scripts etc.).
 *
 * @param {CreatePolyfillsLoaderConfig} cfg
 * @returns {PolyfillsLoader}
 */
function createPolyfillsLoader(cfg) {
  const polyfills = createPolyfillsData(cfg);
  const { loadPolyfillsCode, generatedFiles } = createPolyfillsLoaderCode(cfg, polyfills);

  const code =
    '\n(function() {\n' +
    createLoadScriptCode(cfg, polyfills) +
    loadPolyfillsCode +
    createLoadResourcesCode(cfg, polyfills) +
    '})();\n';

  return { code, generatedFiles };
}

module.exports = {
  createPolyfillsLoader,
  DEFAULT_POLYFILLS_DIR,
};
