import 'page-c/page-c.js';
import 'page-c2/page-c2.js';

class DemoApp extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.shadowRoot.innerHTML = `
      <page-c></page-c>
      <page-c2></page-c2>
    `;
  }
}

customElements.define('demo-app', DemoApp);
