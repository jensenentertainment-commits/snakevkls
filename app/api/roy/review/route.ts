import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/require-role';
import { royPhase2bEnabled } from '@/lib/intelligence/roy/phase2b-gate';
import { parseReview, reviewError } from '@/lib/intelligence/roy/review';

export async function GET(request: Request) {
  const auth = await requireRole(['admin','user']);
  if (!auth.ok) return auth.response;
  if (!royPhase2bEnabled()) return NextResponse.json({error:'Rapporten er ikke aktivert.'},{status:404});
  const url = new URL(request.url);
  const offset = Number(url.searchParams.get('offset') ?? 0);
  const run = url.searchParams.get('run');
  if (!Number.isSafeInteger(offset) || offset<0 || offset>100000 || (run && !/^[0-9a-f-]{36}$/i.test(run))) return NextResponse.json({error:'Ugyldig rapportforespørsel.'},{status:400});
  const {data,error} = await auth.authClient.rpc('get_roy_review_v1',{requested_offset:offset,requested_run:run});
  if (error) return NextResponse.json({error:reviewError(error.code)},{status:error.code==='40001'?409:503});
  try { return NextResponse.json(parseReview(data),{headers:{'Cache-Control':'no-store'}}); }
  catch { return NextResponse.json({error:'Rapporten kunne ikke leses.'},{status:503}); }
}
export async function POST(request: Request) {
  const auth = await requireRole(['admin']);
  if (!auth.ok) return auth.response;
  if (!royPhase2bEnabled()) return NextResponse.json({error:'Kontrollen er ikke aktivert.'},{status:404});
  if (request.headers.get('origin')!==new URL(request.url).origin) return NextResponse.json({error:'Ugyldig opprinnelse.'},{status:403});
  let body: unknown;
  try { body=await request.json(); } catch { return NextResponse.json({error:'Ugyldig forespørsel.'},{status:400}); }
  const id = body && typeof body==='object' && 'requestId' in body ? body.requestId : null;
  if (typeof id!=='string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) return NextResponse.json({error:'Ugyldig kontroll-ID.'},{status:400});
  const {data,error}=await auth.authClient.rpc('run_roy_review_v1',{request_id:id});
  if (error) return NextResponse.json({error:reviewError(error.code)},{status:['55P03','55000'].includes(error.code)?409:503});
  return NextResponse.json({runId:data},{headers:{'Cache-Control':'no-store'}});
}
