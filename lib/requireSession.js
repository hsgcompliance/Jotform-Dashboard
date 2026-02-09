// lib/requireSession.js
import { getServerSession } from "next-auth/next";
import authOptions from "../pages/api/auth/[...nextauth]"; // see note below

export async function requireSession(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) {
    res.status(401).json({ error: "Not authenticated" });
    return null;
  }
  return session;
}
