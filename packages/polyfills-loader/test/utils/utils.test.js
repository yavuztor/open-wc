const { expect } = require('chai');
const { parse } = require('parse5');
const { getAttribute, getTextContent } = require('@open-wc/building-utils/dom5-fork');
const {
  findJsScripts,
  findImportMapScripts,
  sortScripts,
  createScript,
} = require('../../src/utils/utils');

const htmlString = `
  <html>
    <head>
      <script type="module" src="module-a.js"></script>
      <script src="script-a.js"></script>
      <script type="importmap">{ "imports": {} }</script>
      <script type="importmap" src="./importmap.json"></script>
    </head>
    <body>
      <script type="module" src="module-b.js"></script>
      <script src="script-b.js"></script>
      <script type="module">console.log('hello module');</script>
      <script>console.log('hello script');</script>
      <script type="module" src="module-c.js"></script>
      <script src="script-c.js"></script>
    </body>
  </html>
`;

describe('findJsScripts', () => {
  it('returns all external scripts', () => {
    const scripts = findJsScripts(parse(htmlString), { jsScripts: true });
    const result = scripts.map(scr => getAttribute(scr, 'src') || getTextContent(scr));

    expect(result).to.eql(['script-a.js', 'script-b.js', 'script-c.js']);
  });

  it('returns all inline scripts', () => {
    const scripts = findJsScripts(parse(htmlString), { inlineJsScripts: true });
    const result = scripts.map(scr => getAttribute(scr, 'src') || getTextContent(scr));

    expect(result).to.eql(["console.log('hello script');"]);
  });

  it('returns all external modules', () => {
    const scripts = findJsScripts(parse(htmlString), { jsModules: true });
    const result = scripts.map(scr => getAttribute(scr, 'src') || getTextContent(scr));

    expect(result).to.eql(['module-a.js', 'module-b.js', 'module-c.js']);
  });

  it('returns all inline modules', () => {
    const scripts = findJsScripts(parse(htmlString), { inlineJsModules: true });
    const result = scripts.map(scr => getAttribute(scr, 'src') || getTextContent(scr));

    expect(result).to.eql(["console.log('hello module');"]);
  });

  it('returns all scripts', () => {
    const scripts = findJsScripts(parse(htmlString), {
      jsScripts: true,
      jsModules: true,
      inlineJsScripts: true,
      inlineJsModules: true,
    });
    const result = scripts.map(scr => getAttribute(scr, 'src') || getTextContent(scr));

    expect(result).to.eql([
      'module-a.js',
      'script-a.js',
      'module-b.js',
      'script-b.js',
      "console.log('hello module');",
      "console.log('hello script');",
      'module-c.js',
      'script-c.js',
    ]);
  });

  it('does not return scripts which reference a URL', () => {
    const html = parse(`
      <script src="http://my.cdn.com/foo"></script>
      <script src="http://localhost:5000/bar"></script>
      <script src="app.js"></script>
    `);
    const scripts = findJsScripts(html, { jsScripts: true });
    const result = scripts.map(scr => getAttribute(scr, 'src') || getTextContent(scr));
    expect(result).to.eql(['app.js']);
  });
});

describe('findImportMapScripts', () => {
  it('returns import maps in the document', () => {
    const result = findImportMapScripts(parse(htmlString));
    const external = result.external.map(scr => getAttribute(scr, 'src'));
    const inline = result.inline.map(scr => getTextContent(scr));

    expect(external).to.eql(['./importmap.json']);
    expect(inline).to.eql(['{ "imports": {} }']);
  });
});

describe('sortScripts', () => {
  [
    {
      name: 'modules in the order they appear',
      scripts: [
        { type: 'module', order: 0 },
        { type: 'module', order: 1 },
        { type: 'module', order: 2 },
      ],
    },
    {
      name: 'scripts in the order they appear',
      scripts: [{ order: 0 }, { order: 1 }, { order: 2 }],
    },
    {
      name: 'deferred scripts in the order they appear',
      scripts: [
        { defer: '', order: 0 },
        { defer: '', order: 1 },
        { defer: '', order: 2 },
      ],
    },
    {
      name: 'scripts before modules',
      scripts: [{ order: 0 }, { type: 'module', order: 2 }, { order: 1 }],
    },
    {
      name: 'deferred scripts with modules',
      scripts: [
        { order: 0 },
        { defer: '', order: 2 },
        { type: 'module', order: 3 },
        { order: 1 },
        { type: 'module', order: 4 },
        { defer: '', order: 5 },
      ],
    },
    {
      name: 'async scripts as they appear',
      scripts: [
        { order: 0 },
        { async: '', order: 1 },
        { defer: '', order: 5 },
        { async: '', order: 2 },
        { type: 'module', order: 6 },
        { order: 3 },
        { type: 'module', order: 7 },
        { defer: '', order: 8 },
        { async: '', order: 4 },
      ],
    },
  ].forEach(testCase => {
    it(`sorts ${testCase.name}`, () => {
      // @ts-ignore
      const scripts = testCase.scripts.map(attrs => createScript(attrs));
      const sortedScripts = sortScripts(scripts);
      const order = sortedScripts.map(script => getAttribute(script, 'order'));
      expect(order).to.eql([...Array(scripts.length).keys()]);
    });
  });
});
