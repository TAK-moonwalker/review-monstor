const DEFAULT_OPTIONS = {
  cardCount: 6,
  apiEndpoint: 'https://us-central1-review-monster-80750.cloudfunctions.net/publicReviews',
  ownerUid: '',
  fullWidth: false,
  useProductHandle: false,
  imageWidth: 1080,
  imageHeight: 1080,
  textSource: 'shortQuoteEn',
  imageSource: 'postcardImageUrl',
  sectionTitle: 'Customer Reviews',
  brandLabel: 'Review Monster',
  layout: 'grid',
  theme: 'minimal',
  showReviewerName: true,
  showRating: true,
  showProductTitle: false,
  onlyPermissionGranted: true,
  onlyReadyPublished: true,
};

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeJson(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003C')
    .replace(/>/g, '\\u003E')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

export function generateShopifyReviewHtml(_reviews, options) {
  const opts = { ...DEFAULT_OPTIONS, ...(options || {}) };

  const sectionTitle = escapeHtml(opts.sectionTitle || 'Customer Reviews');
  const brandLabel = escapeHtml(opts.brandLabel || 'Review Monster');
  const layout = opts.layout === 'horizontal' ? 'horizontal' : 'grid';
  const theme = ['minimal', 'warm', 'editorial'].includes(opts.theme) ? opts.theme : 'minimal';
  const fullWidth = !!opts.fullWidth;

  const runtimeOptions = {
    cardCount: Math.max(1, Number(opts.cardCount) || 6),
    apiEndpoint: String(opts.apiEndpoint || '').trim(),
    ownerUid: String(opts.ownerUid || '').trim(),
    fullWidth,
    useProductHandle: !!opts.useProductHandle,
    imageWidth: Math.max(1, Number(opts.imageWidth) || 1080),
    imageHeight: Math.max(1, Number(opts.imageHeight) || 1080),
    textSource: opts.textSource,
    imageSource: opts.imageSource,
    layout,
    theme,
    showReviewerName: !!opts.showReviewerName,
    showRating: !!opts.showRating,
    showProductTitle: !!opts.showProductTitle,
  };

  return `<section class="myshop-review-section" data-layout="${layout}" data-theme="${theme}" data-full-width="${fullWidth ? 'true' : 'false'}">
  <div class="myshop-review-header">
    <p class="myshop-review-brand">${brandLabel}</p>
    <h2 class="myshop-review-title">${sectionTitle}</h2>
  </div>

  <div class="myshop-review-list" role="list"></div>

  <div class="myshop-review-modal-overlay" aria-hidden="true">
    <div class="myshop-review-modal" role="dialog" aria-modal="true" aria-label="Review details">
      <button type="button" class="myshop-review-modal-close" aria-label="Close">&times;</button>
      <img class="myshop-review-modal-image" alt="Review image" width="${Math.max(1, Number(opts.imageWidth) || 1080)}" height="${Math.max(1, Number(opts.imageHeight) || 1080)}" />
      <div class="myshop-review-modal-content">
        <p class="myshop-review-modal-text"></p>
        <div class="myshop-review-modal-meta"></div>
      </div>
    </div>
  </div>

  <script type="application/json" class="myshop-review-options">${safeJson(runtimeOptions)}</script>
</section>

<style>
  .myshop-review-section {
    --myshop-bg: #ffffff;
    --myshop-text: #1d1d1f;
    --myshop-muted: #666666;
    --myshop-accent: #222222;
    --myshop-border: #e8e8e8;
    --myshop-card-bg: #ffffff;
    --myshop-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
    max-width: 1200px;
    margin: 0 auto;
    padding: 24px 16px;
    background: var(--myshop-bg);
    color: var(--myshop-text);
    box-sizing: border-box;
    font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
  }

  .myshop-review-section[data-full-width="true"] {
    width: 100%;
    max-width: none;
    margin: 0;
    padding: 24px clamp(16px, 4vw, 40px) 32px;
  }

  .myshop-review-section[data-theme="warm"] {
    --myshop-bg: #fbf8f2;
    --myshop-text: #2f271f;
    --myshop-muted: #6c5e4e;
    --myshop-accent: #8b5a2b;
    --myshop-border: #e7dac9;
    --myshop-card-bg: #fffdf9;
    --myshop-shadow: 0 10px 28px rgba(108, 94, 78, 0.16);
  }

  .myshop-review-section[data-theme="editorial"] {
    --myshop-bg: #f5f5f4;
    --myshop-text: #181818;
    --myshop-muted: #5a5a5a;
    --myshop-accent: #222222;
    --myshop-border: #d9d9d9;
    --myshop-card-bg: #ffffff;
    --myshop-shadow: 0 14px 32px rgba(0, 0, 0, 0.12);
  }

  .myshop-review-header {
    margin-bottom: 16px;
  }

  .myshop-review-brand {
    margin: 0 0 4px;
    font-size: 11px;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: var(--myshop-muted);
  }

  .myshop-review-title {
    margin: 0;
    font-size: 28px;
    line-height: 1.2;
    color: var(--myshop-text);
  }

  .myshop-review-list {
    display: grid;
    gap: 16px;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  }

  .myshop-review-section[data-layout="horizontal"] .myshop-review-list {
    display: flex;
    gap: 14px;
    overflow-x: auto;
    overflow-y: hidden;
    padding-bottom: 8px;
    scroll-snap-type: x mandatory;
    -webkit-overflow-scrolling: touch;
  }

  .myshop-review-card {
    border: 1px solid var(--myshop-border);
    background: var(--myshop-card-bg);
    box-shadow: var(--myshop-shadow);
    border-radius: 14px;
    cursor: pointer;
    overflow: hidden;
    padding: 0;
    width: 100%;
    text-align: left;
    color: inherit;
    transition: transform 0.22s ease, box-shadow 0.22s ease;
  }

  .myshop-review-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 14px 30px rgba(0, 0, 0, 0.14);
  }

  .myshop-review-card:focus-visible {
    outline: 2px solid var(--myshop-accent);
    outline-offset: 2px;
  }

  .myshop-review-section[data-layout="horizontal"] .myshop-review-card {
    min-width: min(84vw, 300px);
    scroll-snap-align: start;
  }

  .myshop-review-card-image {
    display: block;
    width: 100%;
    height: auto;
    max-height: 420px;
    object-fit: contain;
    object-position: center;
    background: #efefef;
  }

  .myshop-review-card-body {
    position: relative;
    padding: 12px 12px 14px;
  }

  .myshop-review-card-body::before {
    content: "\\201C";
    position: absolute;
    top: 8px;
    left: 10px;
    font-size: 22px;
    line-height: 1;
    color: rgba(0, 0, 0, 0.16);
    pointer-events: none;
  }

  .myshop-review-card-text {
    margin: 0;
    padding-left: 14px;
    color: var(--myshop-text);
    font-size: 14px;
    line-height: 1.45;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .myshop-review-card-meta {
    display: grid;
    margin-top: 8px;
    gap: 4px;
    color: var(--myshop-muted);
    font-size: 12px;
  }

  .myshop-review-empty {
    margin: 0;
    color: var(--myshop-muted);
    font-size: 14px;
  }

  .myshop-review-stars {
    color: var(--myshop-accent);
    font-size: 13px;
    letter-spacing: 1px;
  }

  .myshop-review-modal-overlay {
    display: none;
    position: fixed;
    inset: 0;
    z-index: 9999;
    background: rgba(0, 0, 0, 0.72);
    padding: 16px;
    box-sizing: border-box;
    align-items: center;
    justify-content: center;
  }

  .myshop-review-modal-overlay.myshop-review-is-open {
    display: flex;
  }

  .myshop-review-modal {
    position: relative;
    width: min(760px, 96vw);
    max-height: 92vh;
    background: #ffffff;
    border-radius: 14px;
    overflow: auto;
  }

  .myshop-review-modal-close {
    position: absolute;
    top: 8px;
    right: 8px;
    width: 36px;
    height: 36px;
    border: 0;
    border-radius: 999px;
    cursor: pointer;
    background: rgba(0, 0, 0, 0.6);
    color: #ffffff;
    font-size: 24px;
    line-height: 1;
  }

  .myshop-review-modal-image {
    display: block;
    width: 100%;
    max-height: min(70vh, 780px);
    height: auto;
    object-fit: contain;
    object-position: center;
    background: #efefef;
  }

  .myshop-review-modal-content {
    padding: 16px;
  }

  .myshop-review-modal-text {
    margin: 0 0 12px;
    color: #222222;
    font-size: 16px;
    line-height: 1.6;
    white-space: pre-wrap;
  }

  .myshop-review-modal-meta {
    display: grid;
    gap: 6px;
    color: #666666;
    font-size: 14px;
  }

  @media (max-width: 768px) {
    .myshop-review-title {
      font-size: 24px;
    }

    .myshop-review-list {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
    }

    .myshop-review-card-text {
      font-size: 13px;
    }
  }

  @media (max-width: 560px) {
    .myshop-review-list {
      grid-template-columns: 1fr;
    }

    .myshop-review-modal-overlay {
      padding: 0;
    }

    .myshop-review-modal {
      width: 100vw;
      max-height: 100vh;
      height: 100vh;
      border-radius: 0;
    }
  }
</style>

<script>
(function () {
  function parseJsonFrom(section, className, fallback) {
    var el = section.querySelector(className);
    if (!el) return fallback;
    try {
      return JSON.parse(el.textContent || 'null') || fallback;
    } catch (e) {
      return fallback;
    }
  }

  function toRating(value) {
    var n = Number(value) || 0;
    return Math.max(0, Math.min(5, Math.round(n)));
  }

  function toStringSafe(value) {
    return typeof value === 'string' ? value.trim() : '';
  }

  function resolveProductHandle() {
    try {
      if (
        window.ShopifyAnalytics &&
        window.ShopifyAnalytics.meta &&
        window.ShopifyAnalytics.meta.product &&
        window.ShopifyAnalytics.meta.product.handle
      ) {
        return String(window.ShopifyAnalytics.meta.product.handle || '').trim();
      }
    } catch (e) {
      // Ignore and continue to URL fallback.
    }

    var path = String(window.location.pathname || '');
    var productPathIndex = path.indexOf('/products/');
    if (productPathIndex === -1) return '';

    var slug = path.slice(productPathIndex + '/products/'.length);
    slug = slug.split('/')[0].split('?')[0].split('#')[0];
    return slug ? decodeURIComponent(slug).trim() : '';
  }

  function toApiUrl(options) {
    var endpoint = toStringSafe(options.apiEndpoint);
    var ownerUid = toStringSafe(options.ownerUid);
    if (!endpoint) return '';
    if (!ownerUid) return '';

    var count = Math.max(1, Number(options.cardCount) || 6);
    var poolLimit = Math.max(count, Math.min(60, count * 4));
    var shouldUseProductHandle = options.useProductHandle === true;
    var productHandle = shouldUseProductHandle ? resolveProductHandle() : '';

    try {
      var url = new URL(endpoint, window.location.href);
      url.searchParams.set('limit', String(count));
      url.searchParams.set('poolLimit', String(poolLimit));
      url.searchParams.set('uid', ownerUid);
      if (productHandle) {
        url.searchParams.set('productHandle', productHandle);
      }
      return url.toString();
    } catch (e) {
      return '';
    }
  }

  function normalizeReview(raw, options) {
    if (!raw || typeof raw !== 'object') return null;

    var image = '';
    if (options.imageSource === 'firstPictureUrl') {
      image = toStringSafe(raw.firstPictureUrl);
    }
    if (!image) {
      image = toStringSafe(raw.postcardImageUrl);
    }

    var textKey = toStringSafe(options.textSource) || 'shortQuoteEn';
    var text = toStringSafe(raw[textKey]);
    if (!text) {
      text = toStringSafe(raw.shortQuoteEn) ||
        toStringSafe(raw.shortQuoteJa) ||
        toStringSafe(raw.shortQuote) ||
        toStringSafe(raw.translationEn) ||
        toStringSafe(raw.cleanedTextJa) ||
        toStringSafe(raw.body);
    }

    if (!image || !text) return null;

    return {
      id: toStringSafe(raw.id),
      reviewerName: toStringSafe(raw.reviewerName),
      rating: toRating(raw.rating),
      productTitle: toStringSafe(raw.productTitle),
      imageUrl: image,
      text: text,
    };
  }

  function stars(rating) {
    var n = Number(rating) || 0;
    n = Math.max(0, Math.min(5, Math.round(n)));
    return '★★★★★'.slice(0, n) + '☆☆☆☆☆'.slice(0, 5 - n);
  }

  function renderSection(section) {
    if (section.getAttribute('data-myshop-mounted') === 'true') return;
    section.setAttribute('data-myshop-mounted', 'true');

    var options = parseJsonFrom(section, '.myshop-review-options', {});
    var list = section.querySelector('.myshop-review-list');
    var overlay = section.querySelector('.myshop-review-modal-overlay');
    var modal = section.querySelector('.myshop-review-modal');
    var modalImage = section.querySelector('.myshop-review-modal-image');
    var modalText = section.querySelector('.myshop-review-modal-text');
    var modalMeta = section.querySelector('.myshop-review-modal-meta');
    var closeButton = section.querySelector('.myshop-review-modal-close');

    if (!list) return;

    var count = Math.max(1, Number(options.cardCount) || 6);

    function renderEmpty(text) {
      list.innerHTML = '';
      var empty = document.createElement('p');
      empty.className = 'myshop-review-empty';
      empty.textContent = text || 'No reviews available right now.';
      list.appendChild(empty);
    }

    function openModal(item) {
      if (!overlay || !modalImage || !modalText || !modalMeta) return;
      modalImage.src = item.imageUrl || '';
      modalImage.alt = item.productTitle ? item.productTitle : 'Review image';
      modalText.textContent = item.text || '';
      modalMeta.textContent = '';

      if (options.showRating && item.rating > 0) {
        var ratingEl = document.createElement('div');
        ratingEl.className = 'myshop-review-stars';
        ratingEl.textContent = stars(item.rating);
        modalMeta.appendChild(ratingEl);
      }

      if (options.showReviewerName && item.reviewerName) {
        var reviewerEl = document.createElement('div');
        reviewerEl.textContent = item.reviewerName;
        modalMeta.appendChild(reviewerEl);
      }

      if (options.showProductTitle && item.productTitle) {
        var productEl = document.createElement('div');
        productEl.textContent = item.productTitle;
        modalMeta.appendChild(productEl);
      }

      overlay.classList.add('myshop-review-is-open');
      overlay.setAttribute('aria-hidden', 'false');
      if (closeButton) closeButton.focus();
    }

    function closeModal() {
      if (!overlay) return;
      overlay.classList.remove('myshop-review-is-open');
      overlay.setAttribute('aria-hidden', 'true');
      if (modalImage) modalImage.src = '';
    }

    function renderCards(display) {
      list.innerHTML = '';
      if (!Array.isArray(display) || display.length === 0) {
        renderEmpty('No reviews available right now.');
        return;
      }

      display.forEach(function (item) {
      var card = document.createElement('button');
      card.type = 'button';
      card.className = 'myshop-review-card';
      card.setAttribute('aria-label', 'Open review');

      var image = document.createElement('img');
      image.className = 'myshop-review-card-image';
      image.src = item.imageUrl || '';
      image.alt = item.productTitle ? item.productTitle : 'Review image';
      image.setAttribute('width', String(Math.max(1, Number(options.imageWidth) || 1080)));
      image.setAttribute('height', String(Math.max(1, Number(options.imageHeight) || 1080)));

      var body = document.createElement('div');
      body.className = 'myshop-review-card-body';

      var text = document.createElement('p');
      text.className = 'myshop-review-card-text';
      text.textContent = item.text || '';

      var meta = document.createElement('div');
      meta.className = 'myshop-review-card-meta';

      if (options.showRating && item.rating > 0) {
        var ratingEl = document.createElement('div');
        ratingEl.className = 'myshop-review-stars';
        ratingEl.textContent = stars(item.rating);
        meta.appendChild(ratingEl);
      }

      if (options.showReviewerName && item.reviewerName) {
        var reviewer = document.createElement('div');
        reviewer.textContent = item.reviewerName;
        meta.appendChild(reviewer);
      }

      if (options.showProductTitle && item.productTitle) {
        var product = document.createElement('div');
        product.textContent = item.productTitle;
        meta.appendChild(product);
      }

      body.appendChild(text);
      if (meta.childElementCount > 0) {
        body.appendChild(meta);
      }

      card.appendChild(image);
      card.appendChild(body);
      card.addEventListener('click', function () {
        openModal(item);
      });
      list.appendChild(card);
      });
    }

    var endpointUrl = toApiUrl(options);
    if (!endpointUrl) {
      renderEmpty('Set a valid API endpoint to load reviews.');
      return;
    }

    fetch(endpointUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    })
      .then(function (response) {
        if (!response.ok) {
          throw new Error('Request failed');
        }
        return response.json();
      })
      .then(function (payload) {
        var reviews = Array.isArray(payload && payload.reviews) ? payload.reviews : [];
        var normalized = reviews
          .map(function (item) {
            return normalizeReview(item, options);
          })
          .filter(function (item) {
            return !!item;
          })
          .slice(0, count);

        renderCards(normalized);
      })
      .catch(function () {
        renderEmpty('Could not load reviews. Please try again later.');
      });

    if (closeButton) {
      closeButton.addEventListener('click', closeModal);
    }

    if (overlay) {
      overlay.addEventListener('click', function (event) {
        if (event.target === overlay) {
          closeModal();
        }
      });
    }

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && overlay && overlay.classList.contains('myshop-review-is-open')) {
        closeModal();
      }
    });

    if (modal) {
      modal.addEventListener('click', function (event) {
        event.stopPropagation();
      });
    }
  }

  var sections = document.querySelectorAll('.myshop-review-section');
  for (var i = 0; i < sections.length; i += 1) {
    renderSection(sections[i]);
  }
})();
</script>`;
}
