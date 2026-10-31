// Ad-hoc verification of money & data behaviour against a running API.
const B = "http://localhost:8000";
const out = (label, value) => console.log(label.padEnd(46), JSON.stringify(value));

async function req(method, path, token, body, headers = {}) {
  const res = await fetch(`${B}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, body: json };
}

const login = async (email) => (await req("POST", "/api/auth/login", null, { email, password: "phoenix123" })).body.access_token;

const alice = await login("alice@phoenix.dev");
const bob = await login("bob@phoenix.dev");

// fresh workspace owned by alice, 3 welcome credits
const ws = (await req("POST", "/api/workspaces", alice, { name: "Money Lab" })).body;
out("new workspace", ws);
out("welcome balance", (await req("GET", `/api/workspaces/${ws.id}/credits`, alice)).body);

const project = (await req("POST", `/api/workspaces/${ws.id}/projects`, alice, { name: "Cash" })).body;
out("new project", project.name);
out("project list after create (cache invalidated)", (await req("GET", `/api/workspaces/${ws.id}/projects`, alice)).body.length);

// idempotency
const k = `key-${Date.now()}`;
const a = await req("POST", `/api/projects/${project.id}/tasks`, alice, { title: "Once" }, { "Idempotency-Key": k });
const b = await req("POST", `/api/projects/${project.id}/tasks`, alice, { title: "Once" }, { "Idempotency-Key": k });
out("idempotent first status / second status", [a.status, b.status]);
out("same task id", a.body.id === b.body.id);
out("balance after two identical requests", (await req("GET", `/api/workspaces/${ws.id}/credits`, alice)).body.balance);

// concurrent double-click without a key: 2 credits left -> both may pass, but only 2 should succeed
const project2 = (await req("POST", `/api/workspaces/${ws.id}/projects`, alice, { name: "Race" })).body;
const balance0 = (await req("GET", `/api/workspaces/${ws.id}/credits`, alice)).body.balance;
const results = await Promise.all(
  Array.from({ length: 6 }, (_, i) => req("POST", `/api/projects/${project2.id}/tasks`, alice, { title: `race ${i}` }))
);
const created = results.filter((r) => r.status === 201).length;
const rejected = results.filter((r) => r.status === 402).length;
const balance1 = (await req("GET", `/api/workspaces/${ws.id}/credits`, alice)).body.balance;
out("concurrent: balance before / created / 402 / balance after", [balance0, created, rejected, balance1]);
out("credits never negative and ledger matches", balance1 === balance0 - created && balance1 >= 0);

// out of credits now
out("create when empty", (await req("POST", `/api/projects/${project2.id}/tasks`, alice, { title: "nope" })).status);

// assignee not a member
await req("POST", `/api/workspaces/${ws.id}/credits/topup`, alice, { amount: 1 });
const carol = await login("carol@phoenix.dev");
const carolId = (await req("GET", "/api/auth/me", carol)).body.id;
const assignee = await req("POST", `/api/projects/${project2.id}/tasks`, alice, { title: "bad assignee", assignee_id: carolId });
out("assignee outside workspace", [assignee.status, assignee.body.detail]);
out("balance unchanged after rejected assignee", (await req("GET", `/api/workspaces/${ws.id}/credits`, alice)).body.balance);

// validation
out("empty title", (await req("POST", `/api/projects/${project2.id}/tasks`, alice, { title: "" })).status);
out("invalid status on create", (await req("POST", `/api/projects/${project2.id}/tasks`, alice, { title: "x", status: "doing" })).status);

// registration + login
const email = `new-${Date.now()}@phoenix.dev`;
const reg = await req("POST", "/api/auth/register", null, { email, full_name: "New Person", password: "secret123" });
out("register", [reg.status, reg.body.user?.email]);
out("login with registered user", (await req("POST", "/api/auth/login", null, { email, password: "secret123" })).status);
out("duplicate register", (await req("POST", "/api/auth/register", null, { email, full_name: "New Person", password: "secret123" })).status);
out("me", (await req("GET", "/api/auth/me", reg.body.access_token)).body);

// members
out("owner adds carol", (await req("POST", `/api/workspaces/${ws.id}/members`, alice, { email: "carol@phoenix.dev", role: "admin" })).status);
out("duplicate member", (await req("POST", `/api/workspaces/${ws.id}/members`, alice, { email: "carol@phoenix.dev", role: "member" })).status);
out("add owner role rejected", (await req("POST", `/api/workspaces/${ws.id}/members`, alice, { email: "bob@phoenix.dev", role: "owner" })).status);
out("members list", (await req("GET", `/api/workspaces/${ws.id}/members`, alice)).body.map((m) => `${m.email}:${m.role}`));

// tenancy
out("carol (now admin) reads workspace", (await req("GET", `/api/workspaces/${ws.id}`, carol)).status);
out("bob cannot see Money Lab before invite", (await req("GET", "/api/workspaces", bob)).body.map((w) => w.name));

// cors
const pre = await fetch(`${B}/api/health`, { headers: { Origin: "http://localhost:3000" } });
out("cors allow-origin localhost:3000", pre.headers.get("access-control-allow-origin"));
const pre2 = await fetch(`${B}/api/health`, { headers: { Origin: "http://127.0.0.1:3000" } });
out("cors allow-origin 127.0.0.1:3000", pre2.headers.get("access-control-allow-origin"));
