import { readBlockConfig } from '../../scripts/aem.js';

const SCENE7_VIEWER_URL = 'https://s7g10.scene7.com/s7viewers/html5/js/InteractiveImage.js';
const SCENE7_SERVER_URL = 'https://s7g10.scene7.com/is/image/';
const SCENE7_CONTENT_URL = 'https://s7g10.scene7.com/is/content/';

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

export default async function decorate(block) {
  const config = readBlockConfig(block) || {};
  const asset = config.asset || block.querySelector(':scope > div:first-child')?.textContent?.trim();

  if (!asset) return;

  block.innerHTML = '';

  const viewerId = `shoppable-banner-${Math.random().toString(36).slice(2, 9)}`;
  const container = document.createElement('div');
  container.id = viewerId;
  container.classList.add('shoppable_banner');
  block.appendChild(container);

  await loadScript(SCENE7_VIEWER_URL);

  const viewer = new s7viewers.InteractiveImage({
    containerId: viewerId,
    params: {
      serverurl: SCENE7_SERVER_URL,
      contenturl: SCENE7_CONTENT_URL,
      asset,
    },
  });
  viewer.init();
}
