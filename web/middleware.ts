import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') ?? '';

  // explorer.pinaivu.com → rewrite to /explorer routes
  if (hostname.startsWith('explorer.')) {
    const path = request.nextUrl.pathname;

    // Root of explorer domain → /explorer page
    if (path === '/') {
      return NextResponse.rewrite(new URL('/explorer', request.url));
    }

    // /r/:id on explorer domain works as-is (detail pages)
    if (path.startsWith('/r/')) {
      return NextResponse.next();
    }

    // Everything else on explorer domain → /explorer
    if (!path.startsWith('/explorer') && !path.startsWith('/api/') && !path.startsWith('/_next/')) {
      return NextResponse.rewrite(new URL('/explorer', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|Pinaivu_logo.jpg).*)'],
};
