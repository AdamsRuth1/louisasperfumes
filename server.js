"use strict";

const http = require("node:http");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const { URL } = require("node:url");

const PORT = Number.parseInt(process.env.PORT || "3000", 10);
const HOST = process.env.HOST || "127.0.0.1";
const PUBLIC_DIR = __dirname;
const DATA_DIR = path.join(__dirname, "data");
const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
const PRODUCTS_FILE = path.join(DATA_DIR, "products.json");
const SESSION_TTL_MS = 1000 * 60 * 60 * 12;
const MAX_JSON_SIZE = 4 * 1024 * 1024;
const SESSION_COOKIE = "velvet_aura_session";
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "ChangeThisAdminPassword123!";
const SESSION_SECRET = process.env.SESSION_SECRET || "change-this-session-secret-now";

const sessions = new Map();
const seedProducts = [
  {
    id: crypto.randomUUID(),
    name: "Noir Ember",
    manufacturer: "Lattafa",
    ml: 100,
    price: 42000,
    notes: ["amber", "oud", "warm spice", "smoky"],
    description: "A deep evening scent with dark woods, amber warmth, and a magnetic finish.",
    image: "https://images.unsplash.com/photo-1594035910387-fea47794261f?auto=format&fit=crop&w=900&q=80",
    inStock: true
  },
  {
    id: crypto.randomUUID(),
    name: "Rose Satin",
    manufacturer: "Maison Alhambra",
    ml: 100,
    price: 35000,
    notes: ["rose", "vanilla", "musk", "powdery"],
    description: "Soft, feminine, and elegant with velvety rose and a creamy musky dry-down.",
    image: "https://images.unsplash.com/photo-1541643600914-78b084683601?auto=format&fit=crop&w=900&q=80",
    inStock: true
  },
  {
    id: crypto.randomUUID(),
    name: "Citrus Veil",
    manufacturer: "Fragrance World",
    ml: 80,
    price: 28000,
    notes: ["bergamot", "fresh", "green", "clean"],
    description: "Bright citrus sparkle blended with airy greens for a crisp all-day signature.",
    image: "https://images.unsplash.com/photo-1523293182086-7651a899d37f?auto=format&fit=crop&w=900&q=80",
    inStock: true
  },
  {
    id: crypto.randomUUID(),
    name: "Velvet Sugar",
    manufacturer: "Armaf",
    ml: 100,
    price: 32000,
    notes: ["caramel", "vanilla", "sweet", "fruity"],
    description: "A playful gourmand trail with sugary warmth and a juicy sweet opening.",
    image: "https://images.unsplash.com/photo-1619994403073-2cec99c8c6d1?auto=format&fit=crop&w=900&q=80",
    inStock: true
  },
  {
    id: crypto.randomUUID(),
    name: "Sandal Bloom",
    manufacturer: "Ajmal",
    ml: 90,
    price: 39000,
    notes: ["sandalwood", "floral", "cream", "soft"],
    description: "Smooth sandalwood wrapped in elegant florals for a polished, calm presence.",
    image: "https://images.unsplash.com/photo-1528747045269-390fe33c19d9?auto=format&fit=crop&w=900&q=80",
    inStock: true
  },
  {
    id: crypto.randomUUID(),
    name: "Ocean Whisper",
    manufacturer: "Rasasi",
    ml: 100,
    price: 30000,
    notes: ["aquatic", "fresh", "citrus", "woody"],
    description: "Cool and clean with watery freshness, zesty citrus, and a refined woody base.",
    image: "https://images.unsplash.com/photo-1515377905703-c4788e51af15?auto=format&fit=crop&w=900&q=80",
    inStock: false
  }
];

const server = http.createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url, `http://${request.headers.host || `${HOST}:${PORT}`}`);
    cleanupExpiredSessions();

    if (request.method === "GET" && requestUrl.pathname === "/api/products") {
      const products = await readProducts();
      return sendJson(response, 200, { products });
    }

    if (request.method === "GET" && requestUrl.pathname === "/api/admin/session") {
      return sendJson(response, 200, { authenticated: isAuthenticated(request) });
    }

    if (request.method === "POST" && requestUrl.pathname === "/api/admin/login") {
      const body = await readJsonBody(request);
      const username = sanitizeText(body.username);
      const password = typeof body.password === "string" ? body.password : "";
      if (!safeEqual(username, ADMIN_USERNAME) || !safeEqual(password, ADMIN_PASSWORD)) {
        await delay(250);
        return sendJson(response, 401, { error: "Invalid admin username or password." });
      }

      const token = createSessionToken();
      sessions.set(token, Date.now() + SESSION_TTL_MS);
      return sendJson(response, 200, { ok: true }, {
        "Set-Cookie": buildSessionCookie(token)
      });
    }

    if (request.method === "POST" && requestUrl.pathname === "/api/admin/logout") {
      const token = getSessionToken(request);
      if (token) {
        sessions.delete(token);
      }

      return sendJson(response, 200, { ok: true }, {
        "Set-Cookie": `${SESSION_COOKIE}=deleted; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`
      });
    }

    if (request.method === "POST" && requestUrl.pathname === "/api/admin/products") {
      if (!isAuthenticated(request)) {
        return sendJson(response, 401, { error: "Admin authentication required." });
      }

      const body = await readJsonBody(request);
      const incomingProduct = await validateIncomingProduct(body);
      const products = await readProducts();
      const product = {
        id: crypto.randomUUID(),
        ...incomingProduct
      };
      products.unshift(product);
      await writeProducts(products);
      return sendJson(response, 201, { product, products });
    }

    if (request.method === "PATCH" && requestUrl.pathname.startsWith("/api/admin/products/") && requestUrl.pathname.endsWith("/stock")) {
      if (!isAuthenticated(request)) {
        return sendJson(response, 401, { error: "Admin authentication required." });
      }

      const id = decodeURIComponent(requestUrl.pathname.split("/")[4] || "");
      const products = await readProducts();
      const product = products.find((entry) => entry.id === id);
      if (!product) {
        return sendJson(response, 404, { error: "Product not found." });
      }

      product.inStock = !product.inStock;
      await writeProducts(products);
      return sendJson(response, 200, { product, products });
    }

    if (request.method === "POST" && requestUrl.pathname === "/api/admin/recommend") {
      const body = await readJsonBody(request);
      const { userInput, products } = body;

      if (!userInput || !Array.isArray(products)) {
        return sendJson(response, 400, { error: "Missing userInput or products" });
      }

      // If no products available, return helpful message
      if (products.length === 0) {
        return sendJson(response, 200, {
          intro: "No products are currently in stock. Please check back soon!",
          products: []
        });
      }

      // Simple local recommendation (no AI, just keyword matching)
      const keywords = ["fresh", "sweet", "woody", "floral", "clean", "vanilla", "rose", "oud", "citrus", "musky", "powdery", "fruity"];
      const userKeywords = keywords.filter(k => userInput.toLowerCase().includes(k));
      
      let recommendations = products;
      if (userKeywords.length > 0) {
        recommendations = products.filter(p => 
          userKeywords.some(k => 
            (p.notes && Array.isArray(p.notes) && p.notes.join(" ").toLowerCase().includes(k)) ||
            (p.name && p.name.toLowerCase().includes(k)) ||
            (p.description && p.description.toLowerCase().includes(k))
          )
        );
      }

      if (recommendations.length === 0) {
        return sendJson(response, 200, {
          intro: "I couldn't find a perfect match in the current collection. Try describing your vibe with words like fresh, sweet, floral, soft, woody, vanilla, citrus, or oud.",
          products: []
        });
      }

      const picks = recommendations.slice(0, 3);
      
      return sendJson(response, 200, {
        intro: "Based on your preference, here are my recommendations:",
        products: picks
      });
    }

    return serveStatic(requestUrl.pathname, response);
  } catch (error) {
    console.error(error);
    const statusCode = Number.isInteger(error.statusCode) ? error.statusCode : 500;
    const message = statusCode >= 500 ? "Internal server error." : error.message;
    return sendJson(response, statusCode, { error: message });
  }
});

bootstrap()
  .then(() => {
    server.listen(PORT, HOST, () => {
      console.log(`Velvet Aura server running at http://${HOST}:${PORT}`);
    });
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });

async function bootstrap() {
  await fsp.mkdir(DATA_DIR, { recursive: true });
  await fsp.mkdir(UPLOAD_DIR, { recursive: true });
  try {
    await fsp.access(PRODUCTS_FILE, fs.constants.F_OK);
  } catch {
    await writeProducts(seedProducts);
  }
}

async function serveStatic(urlPathname, response) {
  let filePath = path.join(PUBLIC_DIR, urlPathname === "/" ? "index.html" : urlPathname.slice(1));
  filePath = path.normalize(filePath);

  if (!filePath.startsWith(PUBLIC_DIR) && !filePath.startsWith(DATA_DIR)) {
    return sendText(response, 403, "Forbidden");
  }

  try {
    const stat = await fsp.stat(filePath);
    if (stat.isDirectory()) {
      filePath = path.join(filePath, "index.html");
    }

    const content = await fsp.readFile(filePath);
    sendBuffer(response, 200, content, getMimeType(filePath));
  } catch {
    sendText(response, 404, "Not found");
  }
}

async function readProducts() {
  const content = await fsp.readFile(PRODUCTS_FILE, "utf8");
  const parsed = JSON.parse(content);
  return Array.isArray(parsed) ? parsed.map(normalizeProduct).filter(Boolean) : [];
}

async function writeProducts(products) {
  await fsp.writeFile(PRODUCTS_FILE, JSON.stringify(products, null, 2));
}

async function validateIncomingProduct(payload) {
  const name = sanitizeText(payload.name);
  const manufacturer = sanitizeText(payload.manufacturer);
  const description = sanitizeText(payload.description);
  const ml = Number.parseInt(payload.ml, 10);
  const price = Number.parseInt(payload.price, 10);
  const notes = Array.isArray(payload.notes) ? payload.notes.map((note) => sanitizeText(note)).filter(Boolean) : [];
  const inStock = Boolean(payload.inStock);
  const imageName = sanitizeFileName(payload.imageName);
  const imageType = typeof payload.imageType === "string" ? payload.imageType.trim().toLowerCase() : "";
  const imageData = typeof payload.imageData === "string" ? payload.imageData : "";

  if (!name || !manufacturer || !description || notes.length === 0) {
    throw httpError(400, "Please provide valid product details.");
  }

  if (!Number.isFinite(ml) || ml < 1 || ml > 500 || !Number.isFinite(price) || price < 1) {
    throw httpError(400, "ML and price must be valid numbers.");
  }

  if (!["image/jpeg", "image/png", "image/webp"].includes(imageType)) {
    throw httpError(400, "Only JPG, PNG, or WEBP images are allowed.");
  }

  const image = await persistBase64Image(imageData, imageName, imageType);

  return { name, manufacturer, description, ml, price, notes, inStock, image };
}

async function persistBase64Image(imageData, imageName, imageType) {
  const match = imageData.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) {
    throw httpError(400, "Uploaded image is invalid.");
  }

  if (match[1] !== imageType) {
    throw httpError(400, "Image type does not match uploaded file.");
  }

  const buffer = Buffer.from(match[2], "base64");
  if (buffer.length === 0 || buffer.length > 3 * 1024 * 1024) {
    throw httpError(400, "Image must be between 1 byte and 3MB.");
  }

  const extension = imageType === "image/jpeg" ? ".jpg" : imageType === "image/png" ? ".png" : ".webp";
  const filename = `${Date.now()}-${crypto.randomUUID()}-${imageName}${extension}`;
  const destination = path.join(UPLOAD_DIR, filename);
  await fsp.writeFile(destination, buffer, { flag: "wx" });
  return `/data/uploads/${filename}`;
}

function normalizeProduct(product) {
  if (!product || typeof product !== "object") {
    return null;
  }

  const image = typeof product.image === "string" && (product.image.startsWith("https://") || product.image.startsWith("http://") || product.image.startsWith("/data/uploads/"))
    ? product.image
    : "";

  if (!image) {
    return null;
  }

  return {
    id: sanitizeText(product.id) || crypto.randomUUID(),
    name: sanitizeText(product.name),
    manufacturer: sanitizeText(product.manufacturer),
    ml: Number.parseInt(product.ml, 10) || 50,
    price: Number.parseInt(product.price, 10) || 0,
    notes: Array.isArray(product.notes) ? product.notes.map((note) => sanitizeText(note)).filter(Boolean) : [],
    description: sanitizeText(product.description),
    image,
    inStock: Boolean(product.inStock)
  };
}

function isAuthenticated(request) {
  const token = getSessionToken(request);
  if (!token) {
    return false;
  }

  const expiresAt = sessions.get(token);
  if (!expiresAt || expiresAt <= Date.now()) {
    sessions.delete(token);
    return false;
  }

  sessions.set(token, Date.now() + SESSION_TTL_MS);
  return true;
}

function getSessionToken(request) {
  const cookies = parseCookies(request.headers.cookie || "");
  const signedValue = cookies[SESSION_COOKIE];
  if (!signedValue) {
    return null;
  }

  const [token, signature] = signedValue.split(".");
  if (!token || !signature) {
    return null;
  }

  const expected = signToken(token);
  return safeEqual(signature, expected) ? token : null;
}

function buildSessionCookie(token) {
  const signedValue = `${token}.${signToken(token)}`;
  return `${SESSION_COOKIE}=${signedValue}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`;
}

function createSessionToken() {
  return crypto.randomBytes(32).toString("hex");
}

function signToken(token) {
  return crypto.createHmac("sha256", SESSION_SECRET).update(token).digest("hex");
}

function parseCookies(cookieHeader) {
  return cookieHeader
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((cookies, part) => {
      const separatorIndex = part.indexOf("=");
      if (separatorIndex === -1) {
        return cookies;
      }

      const name = part.slice(0, separatorIndex).trim();
      const value = part.slice(separatorIndex + 1).trim();
      cookies[name] = value;
      return cookies;
    }, {});
}

async function readJsonBody(request) {
  const chunks = [];
  let total = 0;

  for await (const chunk of request) {
    total += chunk.length;
    if (total > MAX_JSON_SIZE) {
      throw httpError(413, "Request body too large.");
    }

    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw httpError(400, "Invalid JSON body.");
  }
}

function sendJson(response, statusCode, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload);
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    ...extraHeaders
  });
  response.end(body);
}

function sendText(response, statusCode, text) {
  response.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8",
    "Content-Length": Buffer.byteLength(text),
    "X-Content-Type-Options": "nosniff"
  });
  response.end(text);
}

function sendBuffer(response, statusCode, buffer, contentType) {
  response.writeHead(statusCode, {
    "Content-Type": contentType,
    "Content-Length": buffer.length,
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": contentType.startsWith("image/") ? "public, max-age=31536000, immutable" : "no-cache"
  });
  response.end(buffer);
}

function getMimeType(filePath) {
  switch (path.extname(filePath).toLowerCase()) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".js":
      return "application/javascript; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    case ".svg":
      return "image/svg+xml";
    default:
      return "application/octet-stream";
  }
}

function sanitizeText(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value.replace(/[<>]/g, "").trim();
}

function sanitizeFileName(value) {
  const sanitized = sanitizeText(value).replace(/[^a-zA-Z0-9-_]/g, "-").replace(/-+/g, "-");
  return sanitized.slice(0, 64) || "perfume";
}

function cleanupExpiredSessions() {
  const now = Date.now();
  for (const [token, expiresAt] of sessions.entries()) {
    if (expiresAt <= now) {
      sessions.delete(token);
    }
  }
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) {
    return false;
  }

  return crypto.timingSafeEqual(left, right);
}

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

process.on("uncaughtException", (error) => {
  console.error(error);
});

process.on("unhandledRejection", (error) => {
  console.error(error);
});
