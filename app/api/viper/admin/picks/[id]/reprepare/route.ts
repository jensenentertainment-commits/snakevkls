import { requireViperAdminApiActor } from '@/lib/viper/auth/access';
import { handleViperCommand } from '@/lib/viper/picks/command-handler';
export async function POST(request: Request, {params}: {params: Promise<{id:string}>}) {
 const auth=await requireViperAdminApiActor();
 if(!auth.ok) return auth.response;
 return handleViperCommand(request,(await params).id,'reprepare',auth.actor);
}
