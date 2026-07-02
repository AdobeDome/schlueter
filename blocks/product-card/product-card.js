import { readBlockConfig } from '../../scripts/aem.js';

const PRODUCT_BY_PATH_ENDPOINT = 'https://publish-p131074-e1277685.adobeaemcloud.com/graphql/execute.json/ref-demo-eds/GetProductByPath';
const PRODUCTS_FROM_FOLDER_ENDPOINT = 'https://publish-p131074-e1277685.adobeaemcloud.com/graphql/execute.json/ref-demo-eds/GetProductsFromFolder';

function revealProductCardWrapper(block) {
  const wrapperElement = block.closest('.product-card-wrapper');
  if (wrapperElement) wrapperElement.classList.add('show');
}

function normalizeContentFragmentPath(rawPath) {
  if (!rawPath) return '';
  let path = String(rawPath).trim();
  try {
    const parsed = new URL(path);
    path = parsed.pathname;
  } catch (error) {
    // ignore invalid URLs, treat value as relative path
  }
  const match = path.match(/(\/?content\/dam\/.+?)(?:\.html)?(?:$|\?)/);
  if (match) path = match[1];
  return path;
}

function mapRawProduct(rawProduct) {
  if (!rawProduct) return null;
  return {
    id: rawProduct.sku,
    name: rawProduct.name,
    description: rawProduct.highlight || rawProduct.description?.html || '',
    sku: rawProduct.sku,
  };
}

async function fetchProductByPath(path) {
  const url = `${PRODUCT_BY_PATH_ENDPOINT};path=${path};timestamp=${Date.now()}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`API request failed with status ${response.status}`);
  const payload = await response.json();
  return payload?.data?.productModelByPath?.item || null;
}

async function fetchFirstProductFromFolder(folderPath) {
  // Cache-bust: the AEM publish CDN caches this response without varying by Origin,
  // so a stale cached hit can be missing the Access-Control-Allow-Origin header.
  const url = `${PRODUCTS_FROM_FOLDER_ENDPOINT};path=${folderPath};timestamp=${Date.now()}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`API request failed with status ${response.status}`);
  const payload = await response.json();
  const items = payload?.data?.productModelList?.items || [];
  return items[0] || null;
}

async function fetchProductData(contentFragmentPath) {
  if (!contentFragmentPath) return null;
  try {
    // The configured path may point directly at a product fragment...
    const rawProduct = await fetchProductByPath(contentFragmentPath);
    if (rawProduct) return mapRawProduct(rawProduct);
  } catch (error) {
    /* eslint-disable-next-line no-console */
    console.warn('Product card: path is not a content fragment, trying as a folder', error);
  }
  try {
    // ...or at a folder containing product fragments, in which case show the first one.
    const rawProduct = await fetchFirstProductFromFolder(contentFragmentPath);
    return mapRawProduct(rawProduct);
  } catch (error) {
    /* eslint-disable-next-line no-console */
    console.error('Product card API fetch failed', error);
    return null;
  }
}

function appendProductIdToButton(buttonConfig, product) {
  if (!buttonConfig?.node || !product?.sku) return buttonConfig;
  const anchor = buttonConfig.node.querySelector('a');
  if (!anchor) return buttonConfig;
  const productId = String(product.sku || product.id || '').trim();
  if (!productId) return buttonConfig;
  try {
    const url = new URL(anchor.href || window.location.href);
    url.searchParams.set('productId', productId);
    anchor.href = url.href;
  } catch (error) {
    const encodedId = encodeURIComponent(productId);
    const href = anchor.href || '';
    const separator = href.includes('?') ? '&' : '?';
    anchor.href = `${href}${separator}productId=${encodedId}`;
  }
  return buttonConfig;
}

function buildDatalayerProductPayload(product) {
  if (!product) return null;
  return {
    id: product.id || '',
    name: product.name || '',
    description: product.description || '',
    sku: product.sku || '',
  };
}

function publishProductToDataLayer(productPayload) {
  if (!productPayload || typeof window.updateDataLayer !== 'function') return;
  const productId = String(productPayload.sku || productPayload.id || '').trim();
  window.updateDataLayer(
    {
      product: { ...productPayload },
      productId,
    },
    true
  );
}

function attachProductDataLayerHandler(buttonConfig, productPayload) {
  if (!buttonConfig?.node || !productPayload) return;
  const anchor = buttonConfig.node.querySelector('a');
  if (!anchor) return;
  anchor.addEventListener('click', () => publishProductToDataLayer(productPayload));
}

function makeCardClickable(card, buttonConfig, productPayload) {
  const anchor = buttonConfig?.node?.querySelector('a[href]');
  if (!card || !anchor) return;

  card.classList.add('product-card-clickable');
  card.tabIndex = 0;
  card.setAttribute('role', 'link');
  if (anchor.target === '_blank') {
    card.setAttribute('aria-label', `${anchor.textContent || 'Open product'} (opens in a new tab)`);
  }

  const triggerAnchor = () => {
    publishProductToDataLayer(productPayload);
    anchor.click();
  };

  card.addEventListener('click', (event) => {
    if (event.target.closest('a, button, input, select, textarea, summary, label')) return;
    triggerAnchor();
  });

  card.addEventListener('keydown', (event) => {
    if (event.target !== card) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    triggerAnchor();
  });
}

function createCard(product, buttonConfig) {
  const body = document.createElement('div');
  body.className = 'product-card-body';

  const name = document.createElement('h3');
  name.textContent = product.name || 'Product';

  const description = document.createElement('div');
  description.className = 'product-card-description';
  if (product.description) description.innerHTML = product.description;

  body.append(name, description);

  const li = document.createElement('li');
  li.append(body);
  if (buttonConfig?.node) body.appendChild(buttonConfig.node);
  return li;
}

function isTruthy(value) {
  return value === true || String(value).trim().toLowerCase() === 'true';
}

function createButtonFromConfig(config) {
  if (!config || (!config.text && !config.link)) return null;
  const container = document.createElement('p');
  container.className = 'button-container';
  const styleMap = {
    button: 'cta-button',
    'button-secondary': 'cta-button-secondary',
    'button-dark': 'cta-button-dark',
    link: 'cta-link',
    default: 'cta-default',
  };
  const mappedStyle = styleMap[config.style] || config.style;
  if (mappedStyle) container.classList.add(mappedStyle);
  const anchor = document.createElement('a');
  anchor.classList.add('button');
  anchor.textContent = config.text || 'Learn more';
  if (config.link) anchor.href = config.link;
  if (config.eventType) anchor.dataset.buttonEventType = config.eventType;
  container.appendChild(anchor);
  return { node: container };
}

export default async function decorate(block) {
  block.classList.add('product-card-block');
  [...block.children].forEach((row) => { row.style.display = 'none'; });
  try {
    const config = readBlockConfig(block) || {};
    const rawContentFragmentPath =
      config['content-fragment-folder'] || config.contentfragmentfolder || config.contentFragmentFolder || '';
    const contentFragmentPath = normalizeContentFragmentPath(rawContentFragmentPath);
    if (contentFragmentPath) {
      block.dataset.contentFragmentPath = contentFragmentPath;
    }
    const layout = ['side-by-side', 'stacked', 'compact-stacked-card'].includes((config.layout || '').toLowerCase())
      ? config.layout.toLowerCase()
      : 'stacked';
    const hideDescription = isTruthy(config.hidedescription ?? config.hideDescription);
    const addBorder = isTruthy(config.addborder ?? config.addBorder);
    const buttonConfig = createButtonFromConfig({
      text: config.buttontext,
      link: config.link,
      eventType: config.buttoneventtype,
      style: config.ctastyle ?? 'default',
    });
    [...block.children].forEach((row) => row.remove());
    block.innerHTML = '';

    const product = await fetchProductData(contentFragmentPath);
    if (!product) {
      const errorMsg = document.createElement('p');
      errorMsg.className = 'product-card-error';
      errorMsg.textContent = 'Product not found.';
      block.append(errorMsg);
      return;
    }
    const productPayload = buildDatalayerProductPayload(product);

    const wrapper = document.createElement('div');
    wrapper.className = 'cards product-card-block';
    wrapper.classList.add(`product-card-layout-${layout}`);
    if (hideDescription) wrapper.classList.add('product-card-hide-description');
    if (addBorder) wrapper.classList.add('product-card-add-border');
    const list = document.createElement('ul');
    const productButtonConfig = appendProductIdToButton(buttonConfig, product);
    attachProductDataLayerHandler(productButtonConfig, productPayload);
    const card = createCard(product, productButtonConfig);
    makeCardClickable(card, productButtonConfig, productPayload);
    list.append(card);
    wrapper.append(list);
    block.append(wrapper);
  } finally {
    revealProductCardWrapper(block);
  }
}
