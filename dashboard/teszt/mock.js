// Teszt-mock a kampánypulthoz (window.claude: db + Gmail). Valódi címet nem tartalmaz; a címeket a teszt adja át window.__C-ben.
// window.__GM = {replies:[...], bounces:[...], sent:[...], fail:true}: a search_threads válaszai. A send_message csak naplóz (window.__calls).
(()=>{const W=window.__writes=[],CALLS=window.__calls=[];
const store=window.__store={contacts:{...window.__C},sendqueue:{...window.__Q},"settings":{sender:window.__S||{},...(window.__SET||{})}};
const subs=[];
const snap=(col)=>({docs:Object.entries(store[col]||{}).map(([id,d])=>({id,data:()=>d}))});
const notify=()=>subs.forEach(f=>f());
const docr=(col,id)=>({
  onSnapshot(cb){const f=()=>{const d=(store[col]||{})[id];cb({exists:!!d,data:()=>d||{}})};subs.push(f);setTimeout(f,20);return()=>{}},
  async set(d){W.push(["set",col+"/"+id]);(store[col]=store[col]||{})[id]=d;setTimeout(notify,10)},
  async update(d){W.push(["update",col+"/"+id]);(store[col]=store[col]||{})[id]={...(store[col][id]||{}),...d};setTimeout(notify,10)},
  async delete(){W.push(["delete",col+"/"+id]);delete (store[col]||{})[id];setTimeout(notify,10)},
  async get(){const d=(store[col]||{})[id];return {exists:!!d,data:()=>d||{}}}});
const coll=(col)=>{const c={onSnapshot(cb){const f=()=>cb(snap(col));subs.push(f);setTimeout(f,40);return()=>{}},where(){return c},orderBy(){return c},limit(){return c},doc(id){return docr(col,id)},async add(d){const id="x"+Math.random().toString(36).slice(2);await docr(col,id).set(d);return {id}}};return c};
const db={collection:coll,doc:(p)=>{const [c,i]=p.split("/");return docr(c,i)}};
const mcp={async callTool(s,t,a){CALLS.push([s,t,a]);const G=window.__GM||{};
  if(t!=="search_threads")return {payload:{}};
  if(G.fail)throw Object.assign(new Error("Gmail hiba"),{code:"upstream_error"});
  const q=String(a.query||"").toLowerCase(),th=[];let i=0;
  const has=e=>q.includes(e)||q.includes("from:"+e.split("@")[1]);
  if(/mailer-daemon/.test(q)){for(const e of (G.bounces||[]))if(q.includes('"'+e+'"')||!/"/.test(q))th.push({id:"b"+(i++),messages:[{id:"m",sender:"mailer-daemon@googlemail.com",subject:"Delivery Status Notification (Failure)",snippet:"Address not found Your message wasn't delivered to "+e+" because the address couldn't be found"}]})}
  else if(/in:sent/.test(q)){for(const e of (G.sent||[]))if(q.includes("to:"+e))th.push({id:"s"+(i++),messages:[{id:"m",sender:"levente3d.szeged@gmail.com",toRecipients:[e]}]})}
  else for(const e of (G.replies||[]))if(has(e))th.push({id:"r"+(i++),messages:[{id:"m",sender:"Valaki <"+e+">",toRecipients:["levente3d.szeged@gmail.com"]}]});
  return {payload:th.length?{threads:th}:{}}}};
window.claude={use:async(n)=>{if(n==="db")return db;if(n==="mcp")return mcp;throw Object.assign(new Error("no"),{code:"not_in_manifest"})}};})();
