import { readBlockConfig } from "../../scripts/aem.js";
import { isAuthorEnvironment } from "../../scripts/scripts.js";

const PRODUCT_BY_PATH_ENDPOINT = "https://publish-p131074-e1277685.adobeaemcloud.com/graphql/execute.json/ref-demo-eds/GetProductByPath";
const PRODUCTS_FROM_FOLDER_ENDPOINT = "https://publish-p131074-e1277685.adobeaemcloud.com/graphql/execute.json/ref-demo-eds/GetProductsFromFolder";

/**
 * Fetch a single product's fresh data by its content fragment path.
 * @param {string} path - Content fragment path
 * @returns {Promise<Object|null>} - Product data
 */
async function fetchProductByPath(path) {
  try {
    if (!path) return null;
    const url = `${PRODUCT_BY_PATH_ENDPOINT};path=${path};timestamp=${Date.now()}`;
    const resp = await fetch(url, {
      method: "GET",
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
      },
    });
    if (!resp.ok) throw new Error(`HTTP error! status: ${resp.status}`);
    const json = await resp.json();
    return json?.data?.productModelByPath?.item || null;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("Product Detail: fetch product error", e);
    return null;
  }
}

/**
 * Fetch all products from a folder
 * @param {string} folderPath - Content fragment folder path
 * @returns {Promise<Array>} - Array of products
 */
async function fetchProductsFromFolder(folderPath) {
  try {
    if (!folderPath) return [];
    // Cache-bust: the AEM publish CDN caches this response without varying by Origin,
    // so a stale cached hit can be missing the Access-Control-Allow-Origin header.
    const url = `${PRODUCTS_FROM_FOLDER_ENDPOINT};path=${folderPath};timestamp=${Date.now()}`;
    const resp = await fetch(url, {
      method: "GET",
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
      },
    });
    if (!resp.ok) throw new Error(`HTTP error! status: ${resp.status}`);
    const json = await resp.json();
    return json?.data?.productModelList?.items || [];
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("Product Detail: fetch products from folder error", e);
    return [];
  }
}

/**
 * Get query parameter from URL
 * @param {string} param - Parameter name
 * @returns {string|null} - Parameter value
 */
function getQueryParam(param) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(param);
}

/**
 * Update the page title with the selected product name
 * @param {Object} product - Product data
 */
function updatePageTitle(product) {
  const productTitle = (product?.name || "").trim();
  if (productTitle) {
    document.title = productTitle;
  }
}

/**
 * Build a recommendation card
 * @param {Object} item - Product data
 * @param {boolean} isAuthor - Is author environment
 * @returns {HTMLElement} - Product card
 */
function buildRecommendationCard(item, isAuthor, recommendedPath) {
  const { sku, name, highlight } = item || {};

  const card = document.createElement("article");
  card.className = "pd-rec-card";

  // Make card clickable and redirect to product page
  if (sku) {
    card.style.cursor = "pointer";
    card.addEventListener("click", () => {
      const currentPath = window.location.pathname;

      // Smart path construction: ensure we navigate to the correct product page
      let basePath = currentPath.substring(0, currentPath.lastIndexOf("/"));

      // If the current page doesn't have a language segment, try to add it
      const langPattern = /\/(en|fr|de|es|it|ja|zh|pt|nl|sv|da|no|fi)$/;
      if (!langPattern.test(basePath) && !basePath.includes("/en/")) {
        const pathMatch = currentPath.match(
          /\/(en|fr|de|es|it|ja|zh|pt|nl|sv|da|no|fi)\//
        );
        if (pathMatch) {
          const langCode = pathMatch[1];
          const langIndex = currentPath.indexOf(`/${langCode}/`);
          basePath = currentPath.substring(0, langIndex + langCode.length + 1);
        } else {
          basePath = `${basePath}/en`;
        }
      }

      // On author add .html extension, on publish don't
      const productPath = isAuthor
        ? `${basePath}${recommendedPath}.html`
        : `${basePath}${recommendedPath}`;
      window.location.href = `${productPath}?productId=${encodeURIComponent(sku)}`;
    });
  }

  const meta = document.createElement("div");
  meta.className = "pd-rec-card-meta";
  const title = document.createElement("h3");
  title.className = "pd-rec-card-title";
  title.textContent = name || "";
  meta.append(title);
  if (highlight) {
    const highlightEl = document.createElement("p");
    highlightEl.className = "pd-rec-card-highlight";
    highlightEl.textContent = highlight;
    meta.append(highlightEl);
  }

  card.append(meta);
  return card;
}

/**
 * Build product detail view
 * @param {Object} product - Product data
 * @returns {HTMLElement} - Product detail container
 */
function buildProductDetail(product, eventConfig = {}) {
  const { name, highlight, description = {}, sku } = product;

  const container = document.createElement("div");
  container.className = "pd-container";

  // Content section
  const contentSection = document.createElement("div");
  contentSection.className = "pd-content";

  // Name
  const nameEl = document.createElement("h1");
  nameEl.className = "pd-name";
  nameEl.textContent = name || "";
  contentSection.appendChild(nameEl);

  // Highlight
  if (highlight) {
    const highlightEl = document.createElement("p");
    highlightEl.className = "pd-highlight";
    highlightEl.textContent = highlight;
    contentSection.appendChild(highlightEl);
  }

  const isHallibyTheme = document.body.classList.contains("halliby-theme");

  // Rating stars (Halliby theme only)
  if (isHallibyTheme) {
    const ratingEl = document.createElement("div");
    ratingEl.className = "pd-rating";
    ratingEl.innerHTML = `
      <span class="star filled">★</span>
      <span class="star filled">★</span>
      <span class="star filled">★</span>
      <span class="star filled">★</span>
      <span class="star empty">★</span>
    `;
    contentSection.appendChild(ratingEl);
  }

  // Description (using HTML format)
  if (description?.html) {
    const descEl = document.createElement("div");
    descEl.className = "pd-description";
    descEl.innerHTML = description.html;
    contentSection.appendChild(descEl);
  }

  // Hardcoded Extras and Quantity (Halliby theme only)
  if (eventConfig.showExtras) {
    // Extras
    const extrasEl = document.createElement("div");
    extrasEl.className = "pd-extras";
    const extrasTitle = document.createElement("h3");
    extrasTitle.className = "pd-extras-title";
    extrasTitle.textContent = "Pick Extras";
    extrasEl.appendChild(extrasTitle);

    const extrasList = document.createElement("div");
    extrasList.className = "pd-extras-list";

    const extras = (eventConfig.extraOptions || []).map((option) => ({
      id: option.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_]+/g, '-'),
      label: option,
    }));

    extras.forEach(extra => {
      const label = document.createElement("label");
      label.className = "pd-extra-item";

      const input = document.createElement("input");
      input.type = "checkbox";
      input.className = "pd-extra-checkbox";
      input.name = "extras";
      input.value = extra.id;

      const text = document.createElement("span");
      text.className = "pd-extra-label";
      text.textContent = extra.label;

      label.appendChild(input);
      label.appendChild(text);
      extrasList.appendChild(label);
    });

    extrasEl.appendChild(extrasList);
    contentSection.appendChild(extrasEl);
  }

  if (eventConfig.showQuantity) {

    // Quantity
    const qtyEl = document.createElement("div");
    qtyEl.className = "pd-quantity";
    const qtyTitle = document.createElement("h3");
    qtyTitle.className = "pd-quantity-title";
    qtyTitle.textContent = "Quantity";
    qtyEl.appendChild(qtyTitle);

    const selectWrap = document.createElement("div");
    selectWrap.className = "pd-quantity-select-wrapper";

    const select = document.createElement("select");
    select.className = "pd-quantity-select";

    const placeholderOpt = document.createElement("option");
    placeholderOpt.value = "";
    placeholderOpt.textContent = "Select...";
    select.appendChild(placeholderOpt);

    for (let i = 1; i <= eventConfig.maxQuantity; i++) {
      const opt = document.createElement("option");
      opt.value = i;
      opt.textContent = i;
      select.appendChild(opt);
    }

    selectWrap.appendChild(select);
    qtyEl.appendChild(selectWrap);
    contentSection.appendChild(qtyEl);
  }


  // Action buttons

  const actionsEl = document.createElement("div");
  actionsEl.className = "pd-actions";

  // Add to Cart button (conditionally rendered)
  if (eventConfig.showAddToCartButton !== false) {
    const addToCartBtn = document.createElement("button");
    addToCartBtn.className = "pd-btn pd-btn-primary";
    addToCartBtn.textContent = "Add to Cart";
    addToCartBtn.setAttribute("aria-label", `Add ${name} to cart`);
    addToCartBtn.addEventListener("click", () => {
      if (typeof window.addToCart === "function") {
        window.addToCart({
          id: sku || "",
          name: name || "",
          description: description?.html || "",
          quantity: 1,
        });
      }

      // Show visual feedback
      addToCartBtn.textContent = "Added to Cart ✓";
      setTimeout(() => {
        addToCartBtn.textContent = "Add to Cart";
      }, 2000);
    });
    actionsEl.append(addToCartBtn);
  }

  if (eventConfig.showAddToWishlistButton) {
    const addToWishlistBtn = document.createElement("button");
    addToWishlistBtn.className = "pd-btn pd-btn-secondary";
    addToWishlistBtn.textContent = "Add to Wishlist";
    addToWishlistBtn.setAttribute("aria-label", `Add ${name} to wishlist`);
    actionsEl.append(addToWishlistBtn);
  }

  contentSection.appendChild(actionsEl);

  container.append(contentSection);
  return container;
}

/**
 * Build "You May Also Like" recommendations section showing every other product in the folder.
 * @param {Object} currentProduct - Current product data
 * @param {Array} allProducts - All products from the folder
 * @param {boolean} isAuthor - Is author environment
 * @returns {HTMLElement|null} - Recommendations section or null
 */
function buildRecommendations(currentProduct, allProducts, isAuthor, recommendedPath, relatedProductsTitle) {
  const { sku: currentSku } = currentProduct;

  const recommendations = allProducts.filter((product) => product.sku !== currentSku);

  if (recommendations.length === 0) {
    return null;
  }

  // Build recommendations section
  const section = document.createElement("div");
  section.className = "pd-recommendations";

  const title = document.createElement("h2");
  title.className = "pd-rec-title";
  title.textContent = relatedProductsTitle || "YOU MAY ALSO LIKE";

  const grid = document.createElement("div");
  grid.className = "pd-rec-grid";

  recommendations.forEach((product) => {
    const card = buildRecommendationCard(product, isAuthor, recommendedPath);
    grid.append(card);
  });

  section.append(title, grid);

  return section;
}

/**
 * Decorate the product detail block
 * @param {HTMLElement} block - The block element
 */
export default async function decorate(block) {
  const isTruthy = (value) => value === true || String(value || '').trim().toLowerCase() === 'true';
  const isAuthor = isAuthorEnvironment();

  // Read block config for authorable folder path and toggles
  const config = readBlockConfig(block);
  const eventConfig = {
    showAddToCartButton: (config.showaddtocartbutton === undefined && config['show-add-to-cart-button'] === undefined)
      ? true
      : isTruthy(config.showaddtocartbutton ?? config['show-add-to-cart-button']),
    showAddToWishlistButton: (config.showaddtowishlistbutton === undefined && config['show-add-to-wishlist-button'] === undefined)
      ? true
      : isTruthy(config.showaddtowishlistbutton ?? config['show-add-to-wishlist-button']),
    showYouMayAlsoLikeSection: (config.showyoumayalsolikesection === undefined && config['show-you-may-also-like-section'] === undefined)
      ? true
      : isTruthy(config.showyoumayalsolikesection ?? config['show-you-may-also-like-section']),
    showExtras: isTruthy(config.showextras),
    extraOptions: config.extraoptions ? config.extraoptions?.split(',') : [],
    showQuantity: isTruthy(config.showquantity),
    maxQuantity: Number(config.maxquantity) || 1
  };

  // Extract folder path from block config
  let folderHref = "";
  const link = block.querySelector("a[href]");
  if (link) {
    folderHref = link.getAttribute("href");
  } else {
    folderHref = config.folder || "";
  }

  // Strip .html extension if present
  if (folderHref && folderHref.endsWith(".html")) {
    folderHref = folderHref.replace(/\.html$/, "");
  }

  // Get SKU from URL query parameter
  const sku = getQueryParam("productId");

  // Clear block content
  block.textContent = "";

  if (!folderHref) {
    const errorMsg = document.createElement("p");
    errorMsg.className = "pd-error";
    errorMsg.textContent =
      "Please configure the product folder path in the properties panel.";
    block.appendChild(errorMsg);
    return;
  }

  if (!sku) {
    const errorMsg = document.createElement("p");
    errorMsg.className = "pd-error";
    errorMsg.textContent = "Product not found. Missing product ID in URL.";
    block.appendChild(errorMsg);
    return;
  }

  // Show loading state
  const loader = document.createElement("p");
  loader.className = "pd-loading";
  loader.textContent = "Loading product details...";
  block.appendChild(loader);

  // Fetch every product in the folder (used to resolve the current SKU's path and to build recommendations)
  const allProducts = await fetchProductsFromFolder(folderHref);
  const matchedProduct = allProducts.find((item) => String(item.sku) === String(sku));

  block.textContent = "";

  if (!matchedProduct) {
    const errorMsg = document.createElement("p");
    errorMsg.className = "pd-error";
    errorMsg.textContent = "Product not found or failed to load.";
    block.appendChild(errorMsg);
    return;
  }

  // Fetch a fresh copy of the matched product by its resolved path
  const product = (await fetchProductByPath(matchedProduct._path)) || matchedProduct;

  updatePageTitle(product);

  const recommendedPath = config['pd-recommended-path'] || '/product';
  const relatedProductsTitle = config['relatedproductstitle'] || 'YOU MAY ALSO LIKE';

  // Display product detail
  const productDetail = buildProductDetail(product, eventConfig);
  block.appendChild(productDetail);

  // Display recommendations (all other products in the folder, unfiltered)
  if (eventConfig.showYouMayAlsoLikeSection) {
    const recommendations = buildRecommendations(product, allProducts, isAuthor, recommendedPath, relatedProductsTitle);
    if (recommendations) {
      block.appendChild(recommendations);
    }
  }
}
