import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error("Missing Supabase credentials");
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Verify admin token
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid authorization" });
  }

  const token = authHeader.substring(7);

  try {
    // Verify the token with Supabase
    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: "Invalid token" });
    }

    // Parse product data
    const { name, manufacturer, ml, price, description, notes, image_url, in_stock } = req.body;

    // Validate required fields
    if (!name || !manufacturer || !ml || !price || !description) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Insert product into Supabase
    const { data, error } = await supabase
      .from("products")
      .insert([
        {
          name,
          manufacturer,
          ml: parseInt(ml),
          price: parseInt(price),
          description,
          notes: Array.isArray(notes) ? notes : [],
          image_url: image_url || null,
          in_stock: in_stock === true,
          created_at: new Date().toISOString()
        }
      ])
      .select();

    if (error) {
      console.error("Supabase insert error:", error);
      return res.status(500).json({ error: "Failed to create product" });
    }

    return res.status(201).json({ product: data[0] });
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
