// -------------------- 🔧 Configuration --------------------
const CONFIG = {
  SYNC_CART_API: 'https://express-application-7ye7.onrender.com/api/cart',
  FETCH_SAVED_CART_API: email => `https://express-application-7ye7.onrender.com/api/cart/email/${email}`,
  MAX_RETRIES: 3,
  SYNC_DELAY: 500,
  RETRY_DELAY: 2000
};

let retryCount = 0;

// -------------------- 🛒 Fetch Wrapper --------------------
const originalFetch = window.fetch;
window.fetch = async (...args) => {
  const response = await originalFetch(...args);

  const url = args[0];
  if (typeof url === 'string' && (
    url.includes('/cart/add') ||
    url.includes('/cart/change') ||
    url.includes('/cart/update')
  )) {
    // Debounced sync to backend
    setTimeout(syncCartDataToServer, CONFIG.SYNC_DELAY);
  }

  return response;
};

// -------------------- 🔄 Sync Cart to Server --------------------
async function syncCartDataToServer() {
  try {
    const cartResponse = await fetch('/cart.js');
    const cart = await cartResponse.json();

    const payload = {
      customerId: window.customerData?.id || '',
      email: window.customerData?.email || '',
      lineItems: cart.items
    };

    const response = await fetch(CONFIG.SYNC_CART_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) throw new Error(`Failed to save cart: ${response.status}`);

    const data = await response.json();
    localStorage.setItem('LastSyncDate', data?.cart?.addedDate || new Date().toISOString());

    retryCount = 0; // Reset on success
  } catch (error) {
    console.error('Cart sync failed:', error);
    if (retryCount < CONFIG.MAX_RETRIES) {
      retryCount++;
      console.warn(`Retrying cart sync (${retryCount}/${CONFIG.MAX_RETRIES})...`);
      setTimeout(syncCartDataToServer, CONFIG.RETRY_DELAY);
    }
  }
}

// -------------------- 🧹 Clear Shopify Cart --------------------
async function clearShopifyCart() {
  loader(true);
  const res = await fetch('/cart/clear.js', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });

  if (!res.ok) throw new Error('Failed to clear existing Shopify cart');
}

// -------------------- 📦 Prepare Cart Payload --------------------
function buildCartPayload(lineItems = []) {
  return {
    items: lineItems.map(item => ({
      id: item.variant_id,
      quantity: item.quantity,
      properties: { ...item.properties } || {}
    }))
  };
}

// -------------------- 🧹 Fetch Shopify Cart --------------------
async function fetchShopifyCart() {
  const res = await fetch('/cart.js');

  if (!res.ok) throw new Error('Failed to fetch Shopify cart');

  return await res.json();
}

// -------------------- ⬇️ Sync Saved Cart from Server --------------------
async function syncSavedCart() {
  const user = window.customerData;
  if (!user?.isLoggedIn) {
    localStorage.removeItem('LastSyncDate');
    return;
  }

  const lastSyncDate = localStorage.getItem('LastSyncDate') || '';
  const email = user.email;

  try {
    const currentCart = await fetchShopifyCart();

    const response = await fetch(CONFIG.FETCH_SAVED_CART_API(email));
    if (!response.ok) throw new Error(`Failed to fetch saved cart: ${response.status}`);

    const savedCart = await response.json();
    const cart = savedCart?.cart;

    if (!cart) return;

    if (currentCart.items?.length && !cart.lineItems?.length) {
      await clearShopifyCart();
      location.reload();
    }

    if (cart.lineItems?.length && cart.addedDate !== lastSyncDate) {
      await clearShopifyCart();

      const payload = buildCartPayload(cart.lineItems);;

      await fetch('/cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      localStorage.setItem('LastSyncDate', cart.addedDate);
      location.reload();
    }
  } catch (err) {
    console.error('Error syncing saved cart:', err);
  } finally {
    loader(false);
  }
}

// -------------------- 🌀 Loader Helper --------------------
function loader(isVisible) {
  const loaderEl = document.getElementById('cartsync-loader');
  if (loaderEl) {
    loaderEl.style.display = isVisible ? 'flex' : 'none';
  }
}

// -------------------- 🚀 Init Sync on Load --------------------
document.addEventListener('DOMContentLoaded', syncSavedCart);
