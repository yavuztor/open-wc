const resourceTypes = {
  JS_SYSTEMJS: 'systemjs',
  JS_MODULE: 'js-module',
  JS_MODULE_SHIM: 'js-module-shim',
  JS_SCRIPT: 'js-script',
};

const generatedFileTypes = {
  JS_SCRIPT: 'js-script',
  JS_MODULE: 'js-module',
};

const noModuleSupportTest = "!('noModule' in HTMLScriptElement.prototype)";

module.exports = {
  resourceTypes,
  generatedFileTypes,
  noModuleSupportTest,
};
