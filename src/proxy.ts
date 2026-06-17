import { NextRequest, NextResponse } from "next/server";
import { verifyJWT } from "@/lib/auth";

export const config = {
  matcher: ["/dashboard/:path*"],
};

export async function proxy(req: NextRequest) {
  const token = req.cookies.get("sirius-auth")?.value;

  if (!token) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const secret = process.env.JWT_SECRET ?? "";
  const payload = await verifyJWT(token, secret);

  if (!payload) {
    const res = NextResponse.redirect(new URL("/login", req.url));
    res.cookies.delete("sirius-auth");
    return res;
  }

  return NextResponse.next();
}
