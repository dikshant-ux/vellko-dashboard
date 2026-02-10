import { GET as AuthGET, POST as AuthPOST } from "@/auth";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
    console.log("DEBUG: GET /api/auth/[...nextauth] called", req.url);
    return AuthGET(req);
}

export async function POST(req: NextRequest) {
    console.log("DEBUG: POST /api/auth/[...nextauth] called", req.url);
    return AuthPOST(req);
}
