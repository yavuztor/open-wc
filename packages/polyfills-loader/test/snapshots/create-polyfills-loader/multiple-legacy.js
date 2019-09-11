
(function() {
  function loadScript(src, type) {
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
  }

  var polyfills = [];
  if (!('noModule' in HTMLScriptElement.prototype)) { polyfills.push(loadScript('./polyfills/systemjs.js')) }

  function loadResources() {
    if (!('noModule' in HTMLScriptElement.prototype)) {
        [function() { System.import('./legacy/app-1.js') },function() { loadScript('./legacy/app-2.js') }].reduce(function (a, c) {
    return a.then(c);
  }, Promise.resolve())
    } else if ('foo' in bar) {
        [function() { loadScript('./foobar/app-1.js') },function() { System.import('./foobar/app-2.js') }].reduce(function (a, c) {
    return a.then(c);
  }, Promise.resolve())
    } else {
        [function() { loadScript('./app-1.js', 'module') },function() { loadScript('./app-2.js') }].reduce(function (a, c) {
    return a.then(c);
  }, Promise.resolve())
    }
  }

  polyfills.length ? Promise.all(polyfills).then(loadResources) : loadResources();
})();
