import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
const source=(path:string)=>readFileSync(path,'utf8');
test('warehouse is the default and legacy dashboard redirects without deleting its implementation',()=>{
 for(const file of ['app/page.tsx','app/dashboard/page.tsx']) assert.match(source(file), /redirect\("\/lager"\)/);
 assert.match(source('app/login/page.tsx'), /return "\/lager"/);
 assert.match(source('app/login/LoginForm.tsx'), /nextPath = "\/lager"/);
 assert.match(source('lib/supabase/proxy.ts'), /url.pathname = "\/lager"/);
 assert.match(source('app/dashboard/LegacyDashboard.tsx'), /function DashboardContent/);
});
test('warehouse uses three operational sections rather than duplicate navigation cards',()=>{
 const page=source('app/lager/WarehouseOverview.tsx');
 for(const title of ['Trenger oppfølging','Pågående arbeid','Siste lageraktivitet']) assert.ok(page.includes(title));
 assert.match(page,/issues.data.slice\(0, 3\)/);
 assert.match(page,/Se alle \$\{issues.data.length\} funn/);
 assert.match(page,/Ingen registrerte funn/);
 assert.match(page,/Kunne ikke hente/);
 assert.doesNotMatch(page,/bg-snake-surface\b|bg-snake-workspace|SnakeIntelligencePanel|Snake Health/);
});
test('thin scrollbar stays scoped to both sidebar scroll areas',()=>{
 assert.equal((source('app/components/layout/SidebarShell.tsx').match(/snake-sidebar-scroll /g)||[]).length,2);
 const css=source('app/globals.css');
 assert.match(css,/\.snake-sidebar-scroll \{\s*scrollbar-width: thin;/);
 assert.match(css,/\.snake-sidebar-scroll::-webkit-scrollbar-thumb/);
 assert.match(css,/@supports selector\(::-webkit-scrollbar\)/);
});
