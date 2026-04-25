import { NextRequest, NextResponse } from "next/server";

const USERNAME = "snake";
const PASSWORD = "snake123";

export function middleware(request: NextRequest) {
  const authHeader = request.headers.get("authorization");

  if (authHeader) {
    const basicAuth = authHeader.split(" ")[1];
    const [user, password] = atob(basicAuth).split(":");

    if (user === USERNAME && password === PASSWORD) {
      return NextResponse.next();
    }
  }

  return new Response("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="SNAKE VKLS"',
    },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt).*)"],
};