import type { RequestHandler } from "@builder.io/qwik-city";
import { db } from "~/lib/db";

export const onDelete: RequestHandler = async ({ params, json }) => {
  const keyId = params.keyId;
  
  if (!keyId) {
    throw json(400, { error: "API key ID is required" });
  }
  
  // Find the API key
  const apiKey = await db.apiKey.findUnique({
    where: { id: keyId }
  });
  
  if (!apiKey) {
    throw json(404, { error: "API key not found" });
  }
  
  // Soft delete by setting isActive to false
  await db.apiKey.update({
    where: { id: keyId },
    data: { isActive: false }
  });
  
  throw json(200, { message: "API key deleted successfully" });
};
