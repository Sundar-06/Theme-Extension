let retryCount = 0;
const MAX_RETRIES = 3;

// Wrap native fetch to detect cart activity
const originalFetch = window.fetch;
window.fetch = async (...args) => {
  const response = await originalFetch(...args);

  const url = args[0];
  if (typeof url === 'string' && (
    url.includes('/cart/add') ||
    url.includes('/cart/change') ||
    url.includes('/cart/update')
  )) {
    setTimeout(syncCartDataToServer, 500); // debounce for consistency
  }

  return response;
};

// You could also wrap XMLHttpRequest if needed


async function syncCartDataToServer() {
  try {
    const res = await fetch('/cart.js');
    const cart = await res.json();

    const payload = {
      customerId: window.customerData?.id || '',
      email: window.customerData?.email || '',
      lineItems: cart.items
    };

    const response = await fetch('https://express-application-7ye7.onrender.com/api/cart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Failed to save cart: ${response.status}`);
    }

    const data = await response.json(); // Parse the JSON response

    localStorage.setItem('LastSyncDate', data?.cart?.addedDate);
    retryCount = 0
  } catch (error) {
    console.error("Cart sync failed:", error);
    console.warn("Cart sync failed, retrying in 2 seconds...")

    if (retryCount < MAX_RETRIES) {
      retryCount++;
      setTimeout(syncCartDataToServer, 2000);
    }
  } 
}


async function syncSavedCart() {

  try {
    if (window.customerData && window.customerData.isLoggedIn) {
      const LastSyncDate = localStorage.getItem('LastSyncDate');
      const email = window.customerData.email;

      const response = await fetch(`https://express-application-7ye7.onrender.com/api/cart/email/${email}`);
      if (!response.ok) throw new Error(`Failed to fetch saved cart: ${response.status}`);
      const savedCart = await response.json();

      const cart = savedCart.cart;

      if (cart.lineItems && cart.lineItems.length > 0 && cart.addedDate !== LastSyncDate) {
        loader(true);

        // 🔸 Clear the existing Shopify cart
        const clearRes = await fetch('/cart/clear.js', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });

        if (!clearRes.ok) throw new Error("Failed to clear cart");

        const payload = {
          items: cart.lineItems.map(item => ({
            id: item.variant_id,
            quantity: item.quantity,
            properties: { ...item.properties } || {}
          }))
        };

        await fetch('/cart/add.js', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        // Mark as synced to avoid infinite loop
        localStorage.setItem('LastSyncDate', cart.addedDate);
        // Reload once to reflect changes
        location.reload();
      } 
    }
  } catch (err) {
    console.error("Error syncing saved cart:", err);
  } finally {
    loader(false);
  }
}
document.addEventListener("DOMContentLoaded", syncSavedCart);


function loader(isStatus) {
  const loader = document.getElementById('cart-loader');
  loader.style.display = isStatus ? 'flex' : 'none';
}


