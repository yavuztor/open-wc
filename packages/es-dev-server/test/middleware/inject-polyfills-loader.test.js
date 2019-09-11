import { expect } from 'chai';
import fetch from 'node-fetch';
import path from 'path';
import fs from 'fs';
import { startServer, createConfig } from '../../src/es-dev-server.js';
import { compatibilityModes, virtualFilePrefix } from '../../src/constants.js';
import { userAgents } from '../user-agents.js';

const update = process.argv.includes('--update-snapshots');
const host = 'http://localhost:8080/';

const snapshotsDir = path.join(__dirname, '..', 'snapshots', 'inject-polyfills-loader');

describe('inject-polyfills-loader middleware', () => {
  Object.values(compatibilityModes).forEach(compatibility => {
    it(`injects polyfills into an index.html file with compatibility ${compatibility}`, async () => {
      let server;
      try {
        ({ server } = await startServer(
          createConfig({
            port: 8080,
            rootDir: path.resolve(__dirname, '..', 'fixtures', 'inline-module'),
            compatibility,
            nodeResolve: true,
          }),
        ));

        const response = await fetch(`${host}index.html`, {
          headers: {
            'user-agent': userAgents['Chrome 78'],
          },
        });
        expect(response.status).to.equal(200);
        const responseText = await response.text();
        const filePath = path.join(snapshotsDir, `${compatibility}.html`);

        if (update) {
          fs.writeFileSync(filePath, responseText);
        } else {
          if (!fs.existsSync(filePath)) {
            throw new Error(`No snapshot found for ${compatibility}`);
          }

          expect(fs.readFileSync(filePath, 'utf-8').replace(/\r\n/g, '\n')).to.equal(
            responseText.replace(/\r\n/g, '\n'),
          );
        }
      } finally {
        server.close();
      }
    });
  });

  it('serves polyfills', async () => {
    let server;
    try {
      ({ server } = await startServer(
        createConfig({
          port: 8080,
          rootDir: path.resolve(__dirname, '..', 'fixtures', 'inline-module'),
          compatibility: compatibilityModes.MIN,
        }),
      ));

      const indexResponse = await fetch(`${host}index.html`);
      expect(indexResponse.status).to.equal(200);
      const fetchPolyfillResponse = await fetch(`${host}polyfills/fetch.js`);
      expect(fetchPolyfillResponse.status).to.equal(200);
      expect(fetchPolyfillResponse.headers.get('content-type')).to.equal('text/javascript');
      expect(fetchPolyfillResponse.headers.get('cache-control')).to.equal(
        'public, max-age=31536000',
      );
      expect((await fetchPolyfillResponse.text()).length).to.not.equal(0);
    } finally {
      server.close();
    }
  });

  it('serves inline script 0', async () => {
    let server;
    try {
      ({ server } = await startServer(
        createConfig({
          port: 8080,
          rootDir: path.resolve(__dirname, '..', 'fixtures', 'inline-module'),
          compatibility: compatibilityModes.MIN,
        }),
      ));

      const indexResponse = await fetch(`${host}index.html`);
      expect(indexResponse.status).to.equal(200);

      const inlineModule0Response = await fetch(
        `${host}${virtualFilePrefix}inline-script-0.js?source=/index.html`,
      );
      expect(inlineModule0Response.status).to.equal(200);
      expect(inlineModule0Response.headers.get('content-type')).to.equal('text/javascript');
      expect(inlineModule0Response.headers.get('cache-control')).to.equal('no-cache');
      expect(await inlineModule0Response.text()).to.include("import './src/local-module.js';");
    } finally {
      server.close();
    }
  });

  it('serves inline script 1', async () => {
    let server;
    try {
      ({ server } = await startServer(
        createConfig({
          port: 8080,
          rootDir: path.resolve(__dirname, '..', 'fixtures', 'inline-module'),
          compatibility: compatibilityModes.MIN,
        }),
      ));

      const indexResponse = await fetch(`${host}index.html`);
      expect(indexResponse.status).to.equal(200);

      const inlineModule1Response = await fetch(
        `${host}${virtualFilePrefix}inline-script-1.js?source=/index.html`,
      );
      expect(inlineModule1Response.status).to.equal(200);
      expect(inlineModule1Response.headers.get('content-type')).to.equal('text/javascript');
      expect(inlineModule1Response.headers.get('cache-control')).to.equal('no-cache');
      expect(await inlineModule1Response.text()).to.include("console.log('hello world')");
    } finally {
      server.close();
    }
  });

  it('handles pages without modules', async () => {
    let server;
    try {
      ({ server } = await startServer(
        createConfig({
          port: 8080,
          rootDir: path.resolve(__dirname, '..', 'fixtures', 'simple'),
          compatibility: compatibilityModes.NONE,
        }),
      ));

      const indexResponse = await fetch(`${host}no-modules.html`);
      expect(indexResponse.status).to.equal(200);
      expect(await indexResponse.text()).to.include('<title>My app</title>');
    } finally {
      server.close();
    }
  });
});
