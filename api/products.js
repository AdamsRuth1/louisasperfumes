const products = [
  {
    id: "1",
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
    id: "2",
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
    id: "3",
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
    id: "4",
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
    id: "5",
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
    id: "6",
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

export default function handler(req, res) {
  // Enable CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Handle OPTIONS request
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Handle GET request
  if (req.method === "GET") {
    return res.status(200).json({ products });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
