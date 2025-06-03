async function syncSavedCart() {
    const loader = document.getElementById('cart-loader');
  
    // Avoid re-syncing if already synced in this session
    if (localStorage.getItem('cartSynced') === 'true') {
      return;
    }
  
    try {
      loader.style.display = 'flex';
  
      if (window.customerData && window.customerData.isLoggedIn) {
        const email = window.customerData.email;
        const response = await fetch(`https://express-application-7ye7.onrender.com/api/cart/email/${email}`);
  
        if (!response.ok) throw new Error(`Failed to fetch saved cart: ${response.status}`);
  
        const savedCart = await response.json();
  
        if (savedCart.lineItems && savedCart.lineItems.length > 0) {
          console.log("Merging saved cart into Shopify cart...");
  
          for (const item of savedCart.lineItems) {
            await fetch('/cart/add.js', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                id: item.variant_id,
                quantity: item.quantity,
                properties: item.properties || {}
              })
            });
          }
  
          // ✅ Mark as synced to avoid infinite loop
          localStorage.setItem('cartSynced', 'true');
  
          // ✅ Reload once to reflect changes
          location.reload();
        } else {
          console.log("No saved cart items found.");
        }
      }
    } catch (err) {
      console.error("Error syncing saved cart:", err);
    } finally {
      loader.style.display = 'none';
    }
  }
  
  document.addEventListener("DOMContentLoaded", syncSavedCart);
  