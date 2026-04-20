"use strict";

let authSession = null;

const elements = {
  adminToggle: document.querySelector("#admin-toggle"),
  adminLogout: document.querySelector("#admin-logout"),
  adminAccess: document.querySelector("#admin-access"),
  adminLoginForm: document.querySelector("#admin-login-form"),
  adminPanel: document.querySelector("#admin-panel"),
  adminForm: document.querySelector("#admin-form"),
  adminMessage: document.querySelector("#admin-message"),
  adminReset: document.querySelector("#admin-reset"),
  inventoryList: document.querySelector("#inventory-list")
};

// Check if user is already logged in (from localStorage)
function checkExistingSession() {
  const savedSession = localStorage.getItem("louisas_admin_session");
  if (savedSession) {
    try {
      authSession = JSON.parse(savedSession);
      showAdminPanel();
      loadInventory();
    } catch (e) {
      localStorage.removeItem("louisas_admin_session");
    }
  }
}

// Show/hide login form
elements.adminToggle.addEventListener("click", () => {
  if (!authSession) {
    elements.adminAccess.classList.toggle("hidden");
  }
});

// Handle login
elements.adminLoginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = document.querySelector("#admin-username").value;
  const password = document.querySelector("#admin-password").value;

  elements.adminToggle.disabled = true;
  elements.adminToggle.textContent = "Signing in...";

  try {
    // Use local endpoint for development, Supabase endpoint for production
    const endpoint = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
      ? "/api/admin/login"  // Local Node.js server
      : "/api/auth";        // Vercel serverless function

    const body = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
      ? { username: email, password }  // Local expects username/password
      : { action: "login", email, password };  // Supabase expects action/email/password

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    const data = await response.json();

    if (!response.ok) {
      showMessage("Login failed: " + (data.error || "Unknown error"), "error");
      return;
    }

    // For local dev: just store a simple auth flag
    // For Vercel: store the full session
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
      authSession = { authenticated: true };
    } else {
      authSession = data.session;
    }
    
    localStorage.setItem("louisas_admin_session", JSON.stringify(authSession));
    showMessage("Login successful!", "success");

    setTimeout(() => {
      elements.adminAccess.classList.add("hidden");
      showAdminPanel();
      loadInventory();
    }, 500);
  } catch (error) {
    showMessage("Error: " + error.message, "error");
  } finally {
    elements.adminToggle.disabled = false;
    elements.adminToggle.textContent = "Sign In Required";
  }
});

// Show admin panel after login
function showAdminPanel() {
  elements.adminPanel.classList.remove("hidden");
  elements.adminAccess.classList.add("hidden");
  elements.adminToggle.classList.add("hidden");
  elements.adminLogout.classList.remove("hidden");
}

// Handle logout
elements.adminLogout.addEventListener("click", () => {
  localStorage.removeItem("louisas_admin_session");
  authSession = null;
  elements.adminPanel.classList.add("hidden");
  elements.adminToggle.classList.remove("hidden");
  elements.adminLogout.classList.add("hidden");
  elements.adminAccess.classList.remove("hidden");
  elements.adminLoginForm.reset();
  elements.adminForm.reset();
  elements.inventoryList.innerHTML = "";
  showMessage("Logged out successfully", "success");
});

// Handle product form submission
elements.adminForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!authSession) {
    showMessage("Not authenticated", "error");
    return;
  }

  const formData = new FormData(elements.adminForm);
  const notes = formData
    .get("notes")
    .split(",")
    .map((n) => n.trim())
    .filter((n) => n);

  const imageFile = formData.get("image");

  // Validate image
  if (!imageFile || imageFile.size === 0) {
    showMessage("Please upload a perfume image", "error");
    return;
  }

  if (!imageFile.type.startsWith("image/")) {
    showMessage("File must be an image (JPG, PNG, or WebP)", "error");
    return;
  }

  if (imageFile.size > 3 * 1024 * 1024) {
    showMessage("Image must be 3MB or less", "error");
    return;
  }

  // Convert image to base64
  try {
    const imageData = await readFileAsBase64(imageFile);

    const product = {
      name: formData.get("name"),
      manufacturer: formData.get("manufacturer"),
      ml: parseInt(formData.get("ml")),
      price: parseInt(formData.get("price")),
      description: formData.get("description"),
      notes,
      inStock: formData.get("inStock") === "on",
      imageName: imageFile.name,
      imageType: imageFile.type,
      imageData: imageData
    };

    const submitBtn = elements.adminForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = "Uploading...";

    // Use local endpoint for development, Supabase endpoint for production
    const endpoint = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
      ? "/api/admin/products"  // Local Node.js server
      : "/api/admin-products"; // Vercel serverless function

    const headers = {
      "Content-Type": "application/json"
    };

    // Only add Authorization header for Supabase (deployed)
    if (!(window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")) {
      headers["Authorization"] = `Bearer ${authSession.access_token}`;
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(product)
    });

    const data = await response.json();

    if (!response.ok) {
      showMessage("Upload failed: " + (data.error || "Unknown error"), "error");
      return;
    }

    showMessage("Product uploaded successfully!", "success");
    elements.adminForm.reset();
    loadInventory();
  } catch (error) {
    showMessage("Error: " + error.message, "error");
  } finally {
    const submitBtn = elements.adminForm.querySelector('button[type="submit"]');
    submitBtn.disabled = false;
    submitBtn.textContent = "Save Perfume";
  }
});

// Reset form
elements.adminReset.addEventListener("click", () => {
  elements.adminForm.reset();
});

// Load and display inventory
async function loadInventory() {
  try {
    // Use local endpoint for development, Supabase endpoint for production
    const endpoint = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
      ? "/api/products"      // Local Node.js server
      : "/api/products-db";  // Vercel serverless function

    const response = await fetch(endpoint);
    const data = await response.json();
    const products = data.products || [];

    if (products.length === 0) {
      elements.inventoryList.innerHTML = "<p style='color: #666;'>No products uploaded yet.</p>";
      return;
    }

    elements.inventoryList.innerHTML = products
      .map(
        (product) => `
      <article style="border: 1px solid #ddd; padding: 15px; border-radius: 4px; margin-bottom: 10px;">
        <h4 style="margin: 0 0 5px 0;">${product.name}</h4>
        <p style="margin: 5px 0; font-size: 12px; color: #666;">
          ${product.manufacturer} • ${product.ml}ml • ₦${product.price.toLocaleString()}
        </p>
        <p style="margin: 5px 0; font-size: 12px;">
          ${product.in_stock ? '✓ <span style="color: green;">In Stock</span>' : '✗ <span style="color: red;">Out of Stock</span>'}
        </p>
      </article>
    `
      )
      .join("");
  } catch (error) {
    console.error("Error loading inventory:", error);
    elements.inventoryList.innerHTML = "<p style='color: red;'>Error loading products.</p>";
  }
}

// Helper to show messages
function showMessage(message, type = "info") {
  if (elements.adminMessage) {
    elements.adminMessage.textContent = message;
    elements.adminMessage.className = `admin-message ${type}`;
    elements.adminMessage.style.display = "block";
    
    if (type === "success") {
      setTimeout(() => {
        elements.adminMessage.style.display = "none";
      }, 3000);
    }
  }
}

// Initialize
checkExistingSession();

// Helper function to read file as base64
function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

checkExistingSession();
