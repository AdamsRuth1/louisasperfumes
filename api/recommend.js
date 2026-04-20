export default async function handler(req, res) {
  // Enable CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { userInput, products } = req.body;

  if (!userInput || !Array.isArray(products)) {
    return res.status(400).json({ error: "Missing userInput or products" });
  }

  if (products.length === 0) {
    return res.status(200).json({
      intro: "No products are currently in stock. Please check back soon!",
      products: []
    });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    // Fallback to keyword matching if Gemini not configured
    return handleKeywordMatching(userInput, products, res);
  }

  try {
    const productsList = products
      .map((p, i) => `${i + 1}. ${p.name} by ${p.manufacturer} (${p.ml}ml, ₦${p.price}): ${p.description}`)
      .join("\n");

    const prompt = `You are a friendly perfume recommendation expert. Based on the user's request and available products, recommend 1-3 perfumes.

USER REQUEST: "${userInput}"

AVAILABLE PRODUCTS:
${productsList}

Respond with ONLY a short friendly intro sentence (1-2 sentences max) followed by the product numbers you recommend.
Format your response as:
[Your intro sentence]
Products: 1, 3
(or similar)

Keep it natural and concise.`;

    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 300
        }
      }),
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Gemini API error:", errorData);
      // Fallback to keyword matching
      return handleKeywordMatching(userInput, products, res);
    }

    const data = await response.json();
    const recommendation = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Parse the response to extract product numbers
    const lines = recommendation.split("\n");
    const introLine = lines[0] || "Based on your preference, here are my recommendations:";
    const productsLine = lines.find(line => line.includes("Products:")) || "";
    
    let selectedProducts = [];
    if (productsLine) {
      const numbers = productsLine.match(/\d+/g) || [];
      selectedProducts = numbers
        .map(num => parseInt(num) - 1)
        .filter(idx => idx >= 0 && idx < products.length)
        .map(idx => products[idx]);
    }

    // If no products extracted, do keyword matching
    if (selectedProducts.length === 0) {
      return handleKeywordMatching(userInput, products, res);
    }

    return res.status(200).json({
      intro: introLine,
      products: selectedProducts
    });
  } catch (error) {
    console.error("Chatbot error:", error);
    // Fallback to keyword matching
    return handleKeywordMatching(userInput, products, res);
  }
}

function handleKeywordMatching(userInput, products, res) {
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
    return res.status(200).json({
      intro: "I couldn't find a perfect match in the current collection. Try describing your vibe with words like fresh, sweet, floral, soft, woody, vanilla, citrus, or oud.",
      products: []
    });
  }

  return res.status(200).json({
    intro: "Based on your preference, here are my recommendations:",
    products: recommendations.slice(0, 3)
  });
}
}
