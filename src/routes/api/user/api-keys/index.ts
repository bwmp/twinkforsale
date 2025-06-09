import type { RequestHandler } from "@builder.io/qwik-city";
import { db } from "~/lib/db";

export const onPost: RequestHandler = async ({ request, json }) => {
  // In a real app, you'd get this from the session
  // For now, we'll accept it in the request body for testing
  const body = await request.json();
  const { userId, name } = body;
  
  if (!userId || !name) {
    throw json(400, { error: "userId and name are required" });
  }
    // Check if user exists
  const user = await db.user.findUnique({
    where: { id: userId }
  });
  
  if (!user) {
    throw json(404, { error: "User not found" });
  }
  
  // Check if user is approved
  if (!user.isApproved) {
    throw json(403, { error: "Account pending approval. Please wait for admin approval before creating API keys." });
  }
  
  // Create new API key
  const apiKey = await db.apiKey.create({
    data: {
      name,
      userId
    }
  });
  
  throw json(201, {
    id: apiKey.id,
    key: apiKey.key,
    name: apiKey.name,
    createdAt: apiKey.createdAt
  });
};

export const onGet: RequestHandler = async ({ url, json }) => {
  const userId = url.searchParams.get("userId");
  
  if (!userId) {
    throw json(400, { error: "userId parameter required" });
  }
  
  // Get user's API keys
  const apiKeys = await db.apiKey.findMany({
    where: { userId, isActive: true },
    select: {
      id: true,
      name: true,
      createdAt: true,
      lastUsed: true,
      key: true // Include key for now, in production you might want to hide this
    },
    orderBy: { createdAt: "desc" }
  });
  
  throw json(200, { apiKeys });
};
