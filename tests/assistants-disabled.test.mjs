import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";

// Execute actual module bodies with external dependencies replaced by tripwires.
// No credentials, database or model network is used.
function load(path, resolve) {
  const source = readFileSync(new URL("../" + path, import.meta.url), "utf8");
  const js = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  const module = {exports:{}};
  new Function("require","module","exports",js)(resolve,module,module.exports);
  return module.exports;
}
const gate = load("lib/intelligence/assistant-availability.ts", () => { throw Error("unexpected import"); });
function harness() {
  let calls=0;
  const tripwire=()=>{calls++;throw Error("external dependency called");};
  const resolve=id=>{
    if(id.includes("assistant-availability")) return gate;
    if(id==="server-only") return {};
    if(id==="next/navigation") return {redirect:path=>{throw Error("redirect:"+path);},permanentRedirect:tripwire};
    return new Proxy(tripwire,{get:()=>tripwire});
  };
  return {resolve, calls:()=>calls};
}
test("product switch is disabled and client rejects before constructing transport",()=>{
  assert.equal(gate.AI_ASSISTANTS_ENABLED,false);
  const h=harness(), client=load("lib/intelligence/shared/chat-server.ts",h.resolve);
  assert.throws(()=>client.getChatOpenAIClient(),/deaktivert/);
  assert.equal(h.calls(),0);
});
test("all assistant API methods reject even malformed input before auth, RPC or model",async()=>{
  for(const path of ["borre/ask","roy/ask","arne/ask","roy/review"]){
    const h=harness(), route=load("app/api/"+path+"/route.ts",h.resolve);
    for(const method of ["GET","POST"].filter(m=>route[m])){
      const response=await route[method](new Request("http://localhost/api/"+path,{method}));
      assert.equal(response.status,403);
      assert.equal((await response.json()).code,"AI_ASSISTANTS_DISABLED");
    }
    assert.equal(h.calls(),0,path);
  }
});
test("runtime blocks all employee/role combinations before data and model transport",async()=>{
  const h=harness(), runtime=load("lib/intelligence/workforce/runtime.ts",h.resolve);
  for(const employeeId of ["borre","roy","arne"])
    for(const userRole of ["admin","user","warehouse","unknown"])
      await assert.rejects(()=>runtime.runReadOnlyEmployeeRequest({employeeId,userRole}),/deaktivert/);
  assert.equal(h.calls(),0);
});
test("legacy and current pages redirect before auth or data reads",async()=>{
  for(const path of ["borre","arne","borre/pro","shopify"]){
    const h=harness(),page=load("app/"+path+"/page.tsx",h.resolve);
    await assert.rejects(async()=>page.default(),/redirect:\/lager/);
    assert.equal(h.calls(),0);
  }
});
test("floating/legacy chat wrapper cannot mount for either variant",()=>{
  const h=harness(),ui=load("app/components/AskBorre.tsx",h.resolve);
  for(const variant of ["borre","arne"])
    for(const mode of ["floating","page"])assert.equal(ui.default({variant,mode}),null);
  assert.equal(h.calls(),0);
});
test("root, legacy navigation and Labs retain code behind the common switch",()=>{
  const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
  assert.match(read("app/layout.tsx"),/AI_ASSISTANTS_ENABLED && <AskBorre/);
  assert.match(read("app/components/SnakeNav.tsx"),/AI_ASSISTANTS_ENABLED && <Link\s+href="\/borre"/);
  assert.match(read("app/labs/page.tsx"),/AI_ASSISTANTS_ENABLED \|\| module.href !== "\/arne"/);
});
