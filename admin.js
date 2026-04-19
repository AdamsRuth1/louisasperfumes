"use strict";

const state = {
  products: [],
  adminOpen: false,
  adminAuthenticated: false
};

const elements = {
  inventoryList: document.querySelector("#inventory-list"),
  adminToggle: document.querySelector("#admin-toggle"),
  adminAccess: document.querySelector("#admin-access"),
  adminLoginForm: document.querySelector("#admin-login-form"),
  adminUsername: document.querySelector("#admin-username"),
  adminPassword: document.querySelector("#admin-password"),
  adminLogout: document.querySelector("#admin-logout"),
  adminPanel: document.querySelector("#admin-panel"),
  adminForm: document.querySelector("#admin-form"),
  adminReset: document.querySelector("#admin-reset"),
  adminMessage: document.querySelector("#admin-message")
};

init().catch((error) => {
  elements.adminMessage.textContent = "Could not load admin data.";
  console.error(error);
});

async function init() {
  bindEvents();
  await Promise.all([loadProducts(), loadAdminSession()]);
  renderInventory();
}

function bindEvents() {
  elements.adminToggle.addEventListener("click", () => {
    if (!state.adminAuthenticated) {
      elements.adminMessage.textContent = "Sign in as admin to open the dashboard.";
      return;
    }

    state.adminOpen = !state.adminOpen;
    syncAdminUi();
  });

  elements.adminLoginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await loginAdmin();
  });

  elements.adminLogout.addEventListener("click", async () => {
    await logoutAdmin();
  });

  elements.adminReset.addEventListener("click", () => {
    elements.adminForm.reset();
    elements.adminMessage.textContent = "Form reset.";
  });

  elements.adminForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await createProductFromForm();
  });
}

async function loadProducts() {
  const response = await fetch("/api/products", {
    headers: {
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error("Failed to load products");
  }

  const payload = await response.json();
  state.products = Array.isArray(payload.products) ? payload.products.map(normalizeProduct) : [];
}

async function loadAdminSession() {
  const response = await fetch("/api/admin/session", {
    headers: {
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    syncAdminUi();
    return;
  }

  const payload = await response.json();
  state.adminAuthenticated = payload.authenticated === true;
  state.adminOpen = state.adminAuthenticated;
  syncAdminUi();
}

async function loginAdmin() {
  const username = sanitizeText(elements.adminUsername.value);
  const password = elements.adminPassword.value;

  if (!username || !password) {
    elements.adminMessage.textContent = "Enter your admin username and password.";
    return;
  }

  elements.adminMessage.textContent = "Signing in...";

  const response = await fetch("/api/admin/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({ username, password })
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    elements.adminMessage.textContent = payload.error || "Admin login failed.";
    return;
  }

  state.adminAuthenticated = true;
  state.adminOpen = true;
  syncAdminUi();
  elements.adminLoginForm.reset();
  elements.adminMessage.textContent = "Admin login successful.";
}

async function logoutAdmin() {
  await fetch("/api/admin/logout", {
    method: "POST",
    headers: {
      Accept: "application/json"
    }
  });

  state.adminAuthenticated = false;
  state.adminOpen = false;
  syncAdminUi();
  elements.adminMessage.textContent = "Admin signed out.";
}

async function createProductFromForm() {
  if (!state.adminAuthenticated) {
    elements.adminMessage.textContent = "Please sign in before adding perfumes.";
    return;
  }

  const formData = new FormData(elements.adminForm);
  const product = await buildProductPayload(formData);
  if (!product) {
    return;
  }

  elements.adminMessage.textContent = "Saving perfume...";

  const response = await fetch("/api/admin/products", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify(product)
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    elements.adminMessage.textContent = payload.error || "Could not save perfume.";
    if (response.status === 401) {
      state.adminAuthenticated = false;
      state.adminOpen = false;
      syncAdminUi();
    }
    return;
  }

  state.products = Array.isArray(payload.products) ? payload.products.map(normalizeProduct) : state.products;
  renderInventory();
  elements.adminForm.reset();
  elements.adminMessage.textContent = `${payload.product?.name || "Perfume"} added successfully.`;
}

async function toggleProductStock(productId) {
  if (!state.adminAuthenticated) {
    elements.adminMessage.textContent = "Please sign in before editing stock.";
    return;
  }

  const response = await fetch(`/api/admin/products/${encodeURIComponent(productId)}/stock`, {
    method: "PATCH",
    headers: {
      Accept: "application/json"
    }
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    elements.adminMessage.textContent = payload.error || "Could not update stock status.";
    return;
  }

  state.products = Array.isArray(payload.products) ? payload.products.map(normalizeProduct) : state.products;
  renderInventory();
  elements.adminMessage.textContent = "Stock status updated.";
}

async function buildProductPayload(formData) {
  const name = sanitizeText(formData.get("name"));
  const manufacturer = sanitizeText(formData.get("manufacturer"));
  const notesInput = sanitizeText(formData.get("notes"));
  const description = sanitizeText(formData.get("description"));
  const ml = Number.parseInt(formData.get("ml"), 10);
  const price = Number.parseInt(formData.get("price"), 10);
  const inStock = formData.get("inStock") === "on";
  const file = formData.get("image");

  if (!name || !manufacturer || !description || !notesInput) {
    elements.adminMessage.textContent = "Please fill all required fields correctly.";
    return null;
  }

  if (!Number.isFinite(ml) || ml <= 0 || !Number.isFinite(price) || price <= 0) {
    elements.adminMessage.textContent = "ML and price must be valid positive numbers.";
    return null;
  }

  if (!(file instanceof File) || file.size === 0) {
    elements.adminMessage.textContent = "Please upload a perfume image.";
    return null;
  }

  if (!file.type.startsWith("image/")) {
    elements.adminMessage.textContent = "Uploaded file must be an image.";
    return null;
  }

  if (file.size > 3 * 1024 * 1024) {
    elements.adminMessage.textContent = "Image must be 3MB or less.";
    return null;
  }

  const imageData = await readFileAsDataUrl(file);

  return {
    name,
    manufacturer,
    ml,
    price,
    description,
    inStock,
    notes: notesInput.split(",").map((note) => sanitizeText(note)).filter(Boolean),
    imageName: sanitizeText(file.name) || "perfume-image",
    imageType: file.type,
    imageData
  };
}

function renderInventory() {
  elements.inventoryList.replaceChildren();

  if (state.products.length === 0) {
    const message = document.createElement("p");
    message.className = "search-hint";
    message.textContent = "No perfumes in inventory yet.";
    elements.inventoryList.append(message);
    return;
  }

  const fragment = document.createDocumentFragment();

  state.products.forEach((product) => {
    const item = document.createElement("article");
    item.className = "inventory-item";

    const left = document.createElement("div");
    left.className = "inventory-meta";

    const title = document.createElement("h4");
    title.textContent = product.name;
    const details = document.createElement("p");
    details.textContent = `${product.manufacturer} - ${product.ml}ML - ${formatPrice(product.price)}`;
    const stock = document.createElement("p");
    stock.textContent = product.inStock ? "Available" : "Out of stock";

    left.append(title, details, stock);

    const actions = document.createElement("div");
    actions.className = "inventory-actions";

    const stockButton = document.createElement("button");
    stockButton.type = "button";
    stockButton.className = "button button-secondary";
    stockButton.textContent = product.inStock ? "Mark Out of Stock" : "Mark In Stock";
    stockButton.disabled = !state.adminAuthenticated;
    stockButton.addEventListener("click", () => {
      void toggleProductStock(product.id);
    });

    actions.append(stockButton);
    item.append(left, actions);
    fragment.append(item);
  });

  elements.inventoryList.append(fragment);
}

function syncAdminUi() {
  elements.adminAccess.classList.toggle("hidden", state.adminAuthenticated);
  elements.adminPanel.classList.toggle("hidden", !state.adminAuthenticated || !state.adminOpen);
  elements.adminLogout.classList.toggle("hidden", !state.adminAuthenticated);
  elements.adminToggle.textContent = state.adminAuthenticated
    ? (state.adminOpen ? "Hide Dashboard" : "Open Dashboard")
    : "Sign In Required";
  elements.adminToggle.setAttribute("aria-expanded", String(state.adminAuthenticated && state.adminOpen));
}

function normalizeProduct(product) {
  return {
    id: sanitizeText(product.id),
    name: sanitizeText(product.name),
    manufacturer: sanitizeText(product.manufacturer),
    ml: Number.parseInt(product.ml, 10) || 50,
    price: Number.parseInt(product.price, 10) || 0,
    notes: Array.isArray(product.notes) ? product.notes.map((note) => sanitizeText(note)).filter(Boolean) : [],
    description: sanitizeText(product.description),
    image: sanitizeUrl(product.image) || "",
    inStock: Boolean(product.inStock)
  };
}

function formatPrice(amount) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0
  }).format(amount);
}

function sanitizeText(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value.replace(/[<>]/g, "").trim();
}

function sanitizeUrl(value) {
  if (typeof value !== "string") {
    return "";
  }

  try {
    const url = new URL(value.trim(), window.location.origin);
    return ["https:", "http:"].includes(url.protocol) ? url.toString() : "";
  } catch {
    return "";
  }
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(new Error("Could not read image file"));
    reader.readAsDataURL(file);
  });
}
