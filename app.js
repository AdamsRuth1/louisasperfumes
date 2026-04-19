"use strict";

const CONFIG = {
  brandName: "Louisa's Perfumes",
  themeKey: "louisas-perfumes-theme",
  whatsappNumber: "2349067736899",
  welcomeMessage: "I am your personal assistant. I can recommend the perfect perfume that suits your lifestyle."
};

const state = {
  products: [],
  searchTerm: "",
  noteFilter: "all",
  chatbotOpen: false
};

const elements = {
  body: document.body,
  productGrid: document.querySelector("#product-grid"),
  productTemplate: document.querySelector("#product-card-template"),
  searchInput: document.querySelector("#search-input"),
  searchButton: document.querySelector("#search-button"),
  resultsSummary: document.querySelector("#results-summary"),
  themeToggle: document.querySelector("#theme-toggle"),
  pills: document.querySelectorAll(".pill"),
  whatsappLink: document.querySelector("#whatsapp-link"),
  statusBanner: document.querySelector("#status-banner"),
  heroChatTrigger: document.querySelector("#hero-chat-trigger"),
  botLauncher: document.querySelector("#chatbot-launcher"),
  botPanel: document.querySelector("#chatbot-panel"),
  botClose: document.querySelector("#chatbot-close"),
  botLog: document.querySelector("#chatbot-log"),
  botForm: document.querySelector("#chatbot-form"),
  botInput: document.querySelector("#chatbot-input")
};

init().catch((error) => {
  displayStatus("The website could not load products right now. Please refresh and try again.");
  console.error(error);
});

async function init() {
  applyTheme(loadTheme());
  bindEvents();
  await loadProducts();
  renderProducts();
  setWhatsappLink();
  seedChat();
  window.setTimeout(() => {
    openChatbot();
  }, 700);
}

function bindEvents() {
  elements.searchInput.addEventListener("input", (event) => {
    state.searchTerm = sanitizeText(event.target.value);
    renderProducts();
  });

  elements.searchButton.addEventListener("click", () => {
    state.searchTerm = sanitizeText(elements.searchInput.value);
    renderProducts();
  });

  elements.themeToggle.addEventListener("click", () => {
    const nextTheme = elements.body.dataset.theme === "light" ? "dark" : "light";
    applyTheme(nextTheme);
    localStorage.setItem(CONFIG.themeKey, nextTheme);
  });

  elements.pills.forEach((pill) => {
    pill.addEventListener("click", () => {
      state.noteFilter = pill.dataset.filter || "all";
      elements.pills.forEach((item) => item.classList.remove("is-active"));
      pill.classList.add("is-active");
      renderProducts();
    });
  });

  elements.heroChatTrigger.addEventListener("click", () => {
    openChatbot();
    elements.botInput.focus();
  });

  elements.botLauncher.addEventListener("click", () => {
    if (state.chatbotOpen) {
      closeChatbot();
      return;
    }

    openChatbot();
  });

  elements.botClose.addEventListener("click", () => {
    closeChatbot();
  });

  elements.botForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const userMessage = sanitizeText(elements.botInput.value);
    if (!userMessage) {
      return;
    }

    appendTextMessage("user", "You", userMessage);
    const recommendation = generateRecommendation(userMessage);
    appendRecommendationMessage(recommendation);
    elements.botForm.reset();
    openChatbot();
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

function renderProducts() {
  elements.productGrid.replaceChildren();
  const matches = getFilteredProducts();

  if (matches.length === 0) {
    const emptyState = document.createElement("p");
    emptyState.className = "search-hint";
    emptyState.textContent = "No perfumes matched your search. Try another name, brand, or note.";
    elements.productGrid.append(emptyState);
    elements.resultsSummary.textContent = "No perfumes matched your search.";
    return;
  }

  const fragment = document.createDocumentFragment();

  matches.forEach((product) => {
    fragment.append(createProductCard(product));
  });

  elements.productGrid.append(fragment);
  elements.resultsSummary.textContent = `Showing ${matches.length} perfume${matches.length === 1 ? "" : "s"}.`;
}

function createProductCard(product) {
  const card = elements.productTemplate.content.firstElementChild.cloneNode(true);
  const img = card.querySelector(".product-image");
  const badge = card.querySelector(".stock-badge");
  const orderLink = card.querySelector(".order-link");

  img.src = safeImage(product.image);
  img.alt = `${product.name} perfume bottle`;
  badge.textContent = product.inStock ? "In Stock" : "Out of Stock";
  badge.style.color = product.inStock ? "#0f2b17" : "#401616";
  badge.style.background = product.inStock ? "rgba(147, 222, 168, 0.92)" : "rgba(255, 186, 186, 0.92)";

  card.querySelector(".manufacturer").textContent = product.manufacturer;
  card.querySelector(".ml").textContent = `${product.ml}ML`;
  card.querySelector(".product-name").textContent = product.name;
  card.querySelector(".product-description").textContent = product.description;
  card.querySelector(".product-notes").textContent = `Notes: ${product.notes.join(", ")}`;
  card.querySelector(".price").textContent = formatPrice(product.price);

  if (product.inStock) {
    orderLink.href = buildWhatsappLink(product.name);
    orderLink.setAttribute("aria-label", `Order ${product.name} on WhatsApp`);
    orderLink.classList.remove("button-secondary");
    orderLink.textContent = "Order Now";
  } else {
    orderLink.removeAttribute("href");
    orderLink.setAttribute("aria-disabled", "true");
    orderLink.classList.add("button-secondary");
    orderLink.textContent = "Sold Out";
  }

  return card;
}

function getFilteredProducts() {
  const normalizedSearch = state.searchTerm.toLowerCase().trim();

  return state.products.filter((product) => {
    const searchable = [product.name, product.manufacturer, product.description, ...product.notes]
      .join(" ")
      .toLowerCase();

    const matchesSearch = !normalizedSearch || searchable.includes(normalizedSearch);
    const matchesFilter =
      state.noteFilter === "all" ||
      product.notes.some((note) => note.toLowerCase().includes(state.noteFilter));

    return matchesSearch && matchesFilter;
  });
}

function generateRecommendation(input) {
  const message = input.toLowerCase();
  const budget = extractBudget(message);
  const activeProducts = state.products.filter((product) => product.inStock);
  const vibeKeywords = ["fresh", "sweet", "woody", "floral", "clean", "sexy", "soft", "bold", "vanilla", "rose", "oud", "musky", "fruity", "powdery", "spicy"];
  const desiredNotes = vibeKeywords.filter((keyword) => message.includes(keyword));

  if (activeProducts.length === 0) {
    return {
      intro: "Everything is currently marked out of stock, so I cannot recommend a perfume right now.",
      products: []
    };
  }

  let candidates = activeProducts;

  if (budget) {
    candidates = candidates.filter((product) => product.price <= budget);
  }

  if (desiredNotes.length > 0) {
    candidates = candidates
      .map((product) => ({
        product,
        score: desiredNotes.reduce((total, keyword) => {
          const corpus = `${product.description} ${product.notes.join(" ")} ${product.name} ${product.manufacturer}`.toLowerCase();
          return total + (corpus.includes(keyword) ? 1 : 0);
        }, 0)
      }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score || a.product.price - b.product.price)
      .map((entry) => entry.product);
  } else {
    candidates = [...candidates].sort((a, b) => a.price - b.price);
  }

  if (candidates.length === 0) {
    return {
      intro: budget
        ? `I could not find an in-stock perfume under ${formatPrice(budget)} with that scent profile. Try a slightly higher budget or a different scent mood.`
        : "I could not find a strong match in the current collection. Try describing your vibe with words like fresh, sweet, floral, soft, woody, or sexy.",
      products: []
    };
  }

  const picks = candidates.slice(0, 3);
  const intro = budget
    ? `Based on your budget and scent preference, these are my best matches under ${formatPrice(budget)}.`
    : "These are my best matches from the perfumes currently available.";

  return { intro, products: picks };
}

function extractBudget(message) {
  const budgetMatch = message.match(/(?:under|below|budget|within|less than)?\s*(?:ngn|\u20A6)?\s*([\d,]{4,})/i);
  if (!budgetMatch) {
    return null;
  }

  const amount = Number.parseInt(budgetMatch[1].replaceAll(",", ""), 10);
  return Number.isFinite(amount) ? amount : null;
}

function appendTextMessage(role, title, text) {
  const message = document.createElement("article");
  message.className = `chat-message ${role}`;

  const heading = document.createElement("strong");
  heading.textContent = title;

  const content = document.createElement("p");
  content.textContent = text;

  message.append(heading, content);
  elements.botLog.append(message);
  elements.botLog.scrollTop = elements.botLog.scrollHeight;
}

function appendRecommendationMessage(result) {
  const message = document.createElement("article");
  message.className = "chat-message assistant";

  const heading = document.createElement("strong");
  heading.textContent = "Louisa's Assistant";

  const intro = document.createElement("p");
  intro.textContent = result.intro;
  message.append(heading, intro);

  if (result.products.length > 0) {
    const list = document.createElement("div");
    list.className = "chat-recommendations";

    result.products.forEach((product) => {
      const card = document.createElement("article");
      card.className = "chat-product";

      const image = document.createElement("img");
      image.className = "chat-product-image";
      image.src = safeImage(product.image);
      image.alt = `${product.name} perfume`;

      const content = document.createElement("div");
      content.className = "chat-product-content";

      const title = document.createElement("h4");
      title.textContent = product.name;
      const meta = document.createElement("p");
      meta.textContent = `${product.manufacturer} - ${product.ml}ML - ${formatPrice(product.price)}`;
      const description = document.createElement("p");
      description.textContent = product.description;
      const notes = document.createElement("p");
      notes.textContent = `Notes: ${product.notes.join(", ")}`;
      const action = document.createElement("a");
      action.className = "button button-primary";
      action.href = buildWhatsappLink(product.name);
      action.target = "_blank";
      action.rel = "noopener noreferrer";
      action.textContent = product.inStock ? "Order on WhatsApp" : "Out of Stock";
      if (!product.inStock) {
        action.classList.add("button-secondary");
        action.removeAttribute("href");
        action.setAttribute("aria-disabled", "true");
      }

      content.append(title, meta, description, notes, action);
      card.append(image, content);
      list.append(card);
    });

    message.append(list);
  }

  elements.botLog.append(message);
  elements.botLog.scrollTop = elements.botLog.scrollHeight;
}

function openChatbot() {
  state.chatbotOpen = true;
  elements.botPanel.classList.remove("hidden");
  elements.botPanel.setAttribute("aria-hidden", "false");
  elements.botLauncher.setAttribute("aria-expanded", "true");
}

function closeChatbot() {
  state.chatbotOpen = false;
  elements.botPanel.classList.add("hidden");
  elements.botPanel.setAttribute("aria-hidden", "true");
  elements.botLauncher.setAttribute("aria-expanded", "false");
}

function seedChat() {
  appendTextMessage("assistant", "Louisa's Assistant", CONFIG.welcomeMessage);
  appendTextMessage("assistant", "Louisa's Assistant", "Tell me your budget and how you want to smell, and I will recommend the best perfumes from this collection with full details.");
}

function displayStatus(message) {
  if (!elements.statusBanner) {
    return;
  }

  elements.statusBanner.textContent = message;
  elements.statusBanner.classList.remove("hidden");
}

function setWhatsappLink() {
  elements.whatsappLink.href = buildWhatsappLink("a perfume");
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

function loadTheme() {
  const savedTheme = localStorage.getItem(CONFIG.themeKey);
  return savedTheme === "light" ? "light" : "dark";
}

function applyTheme(theme) {
  elements.body.dataset.theme = theme;
  elements.themeToggle.setAttribute("aria-pressed", String(theme === "light"));
}

function buildWhatsappLink(productName) {
  const message = `Hello Louisa's Perfumes, I want to place an order for ${productName}.`;
  return `https://wa.me/${CONFIG.whatsappNumber}?text=${encodeURIComponent(message)}`;
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

function safeImage(url) {
  const sanitized = sanitizeUrl(url);
  return sanitized || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 400'%3E%3Crect width='400' height='400' fill='%2315120f'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23ffffff' font-family='Arial' font-size='24'%3ELouisa's Perfumes%3C/text%3E%3C/svg%3E";
}
