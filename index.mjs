#!/usr/bin/env node

import {
  intro,
  outro,
  select,
  text,
  spinner,
  confirm,
  multiselect,
  isCancel,
  cancel,
} from "@clack/prompts";
import chalk from "chalk";
import gradient from "gradient-string";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const CONFIG_PATH = join(homedir(), ".cloudflare-kv-deleter.json");
const CF_API = "https://api.cloudflare.com/client/v4";

const AUTHOR = "Nijoo";
const GITHUB = "https://github.com/rockz5555";

// ─── Color palette ───────────────────────────────────────────
const C = {
  orange: "#f38020",
  orLt: "#faa53b",
  orDk: "#d1640a",
  gold: "#ffd700",
  red: "#ff3344",
  cyan: "#00ddff",
  blue: "#2979ff",
  magenta: "#ff44ff",
  green: "#00ff88",
  dim: "#555555",
};

// ─── Gradients ───────────────────────────────────────────────
const gSunset = gradient([
  C.orDk,
  C.orange,
  C.orLt,
  C.gold,
  C.orLt,
  C.orange,
  C.orDk,
]);
const gFire = gradient([C.red, C.orange, C.gold, C.orange, C.red]);
const gAurora = gradient([C.cyan, C.magenta, C.cyan]);
const gOcean = gradient([C.cyan, C.blue, C.cyan]);
const gNeon = gradient([C.green, C.gold, C.green]);
const gProgress = gradient([C.orDk, C.orange, C.orLt, C.gold, C.green]);

const bold = chalk.bold;
const dim = chalk.dim;
const hx = (c) => chalk.hex(c);

// ─────────────────────────────────────────────────────────────
//  BANNER
// ─────────────────────────────────────────────────────────────

async function animateIntro() {
  console.clear();
  const w = Math.min((process.stdout.columns || 80) - 2, 66);

  // Solid gradient top bar — ▄ characters colored from dark → light
  const topBar = gSunset("▄".repeat(w));
  console.log(topBar);

  console.log("");
  console.log(
    `   ${gSunset("       ▐")}  ${bold(gSunset("    ☁  CLOUDFLARE KV BULK DELETER  ☁"))}  ${gSunset("     ▌")}`,
  );
  console.log(
    `   ${hx(C.orLt)("       ▐")}  ${hx(C.orLt)("⚡  Wipe your KV namespace with style  ⚡")}  ${hx(C.orLt)("▌")}`,
  );
  console.log("");
  console.log(
    `             ${dim("by")} ${hx(C.gold).bold(AUTHOR)}  ${dim("·")}  ${dim(GITHUB)}`,
  );
  console.log("");

  // Solid gradient bottom bar — ▀ characters
  const botBar = gSunset("▀".repeat(w));
  console.log(botBar);
  console.log("");
}

// ─────────────────────────────────────────────────────────────
//  DIVIDERS & BOXES
// ─────────────────────────────────────────────────────────────

function divider(char = "━", width) {
  const w = width || Math.max((process.stdout.columns || 80) - 2, 40);
  const line = char.repeat(w);
  process.stdout.write(gSunset(`  ${line}\n`));
}

function thinDivider() {
  const w = Math.max((process.stdout.columns || 80) - 2, 40);
  process.stdout.write(hx(C.orDk)(`  ${"─".repeat(w)}\n`));
}

function stripAnsi(s) {
  return s.replace(/\x1B\[[0-9;]*m/g, "");
}

function panel(lines, title) {
  const clean = lines.map((l) => stripAnsi(l));
  const innerW = Math.max(...clean.map((l) => l.length)) + 4;
  const outerW = innerW + 2;

  const titleStr = title ? ` ${title} ` : "";
  const titleClean = stripAnsi(titleStr);
  const leftPad = Math.floor((outerW - titleClean.length) / 2);
  const rightPad = outerW - titleClean.length - leftPad;

  const top = title
    ? `  ${gSunset("╔" + "═".repeat(leftPad))}${titleStr}${gSunset("═".repeat(rightPad) + "╗")}`
    : `  ${gSunset("╔" + "═".repeat(outerW) + "╗")}`;

  const mid = lines.map((l, i) => {
    const pad = innerW - clean[i].length;
    return `  ${gSunset("║")}  ${l}${" ".repeat(pad)} ${gSunset("║")}`;
  });

  const bot = `  ${gSunset("╚" + "═".repeat(outerW) + "╝")}`;
  return [top, ...mid, bot].join("\n");
}

// ─────────────────────────────────────────────────────────────
//  PROGRESS BAR  —  gradient ▰▱ blocks
// ─────────────────────────────────────────────────────────────

function progressBar(current, total, width = 28) {
  const pct = total > 0 ? current / total : 0;
  const filled = Math.round(pct * width);
  const empty = width - filled;

  const filledStr = filled > 0 ? gProgress("▰".repeat(filled)) : "";
  const emptyStr = dim("▱".repeat(empty));
  const pctStr = bold(`${(pct * 100).toFixed(1)}%`);

  return `${filledStr}${emptyStr} ${pctStr}`;
}

function milestoned(n) {
  if (n >= 50000) return "💀☠️";
  if (n >= 10000) return "🔥🔥";
  if (n >= 5000) return "💪⚡";
  if (n >= 1000) return "⚡✨";
  if (n >= 100) return "✨";
  if (n >= 10) return "👏";
  return "";
}

// ─────────────────────────────────────────────────────────────
//  CONFIG & HELPERS
// ─────────────────────────────────────────────────────────────

function abort(msg) {
  cancel(msg);
  process.exit(0);
}

function loadConfig() {
  try {
    if (existsSync(CONFIG_PATH)) {
      return JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
    }
  } catch {}
  return {};
}

function saveConfig(config) {
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

async function cfFetch(token, path, options = {}) {
  const url = `${CF_API}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  const data = await res.json();
  if (!data.success) {
    throw new Error(data.errors?.[0]?.message || JSON.stringify(data.errors));
  }
  return data;
}

// ─────────────────────────────────────────────────────────────
//  AUTH FLOW
// ─────────────────────────────────────────────────────────────

async function getToken() {
  const envToken = process.env.CLOUDFLARE_API_TOKEN || process.env.CF_API_TOKEN;
  if (envToken) return envToken;

  const config = loadConfig();
  if (config.apiToken) {
    const use = await select({
      message: `${hx(C.orLt)("🔑")}  Use saved API token?`,
      options: [
        { value: "yes", label: "Yes, use saved token" },
        { value: "no", label: "No, enter a new one" },
      ],
    });
    if (isCancel(use)) abort("Cancelled");
    if (use === "yes") return config.apiToken;
  }

  const token = await text({
    message: `${hx(C.orLt)("🔑")}  Enter your Cloudflare API Token`,
    hint: dim("Requires Account:Read + KV:Read + KV:Write"),
    validate: (v) => (v?.length > 0 ? undefined : "Token is required"),
  });
  if (isCancel(token)) abort("Cancelled");

  const save = await confirm({
    message: `${hx(C.orLt)("💾")}  Save token for next time?`,
    initial: false,
  });
  if (isCancel(save)) abort("Cancelled");
  if (save) saveConfig({ ...loadConfig(), apiToken: token });

  return token;
}

// ─────────────────────────────────────────────────────────────
//  ACCOUNT & NAMESPACE
// ─────────────────────────────────────────────────────────────

async function pickAccount(token) {
  const s = spinner();
  s.start(hx(C.orLt)("🌐  Fetching your Cloudflare accounts…"));
  let accounts;
  try {
    const data = await cfFetch(token, "/accounts?per_page=50");
    accounts = data.result;
    s.stop(
      `${hx(C.green)("✔")}  ${bold(accounts.length)} account${accounts.length !== 1 ? "s" : ""} found`,
    );
  } catch (e) {
    s.stop(hx(C.red)("✘  Failed to fetch accounts"));
    throw e;
  }

  if (accounts.length === 0) {
    thinDivider();
    console.log(
      `  ${hx(C.gold)("⚠")}  Token works but lacks Account:Read — accounts list is empty.\n`,
    );
    const manualId = await text({
      message: `${hx(C.orLt)("🆔")}  Enter your Account ID manually`,
      hint: dim("Find it in the dashboard URL: dash.cloudflare.com/?account=…"),
      validate: (v) => (v?.length > 0 ? undefined : "Account ID is required"),
    });
    if (isCancel(manualId)) abort("Cancelled");
    thinDivider();
    return { id: manualId, name: "Manual Account" };
  }

  if (accounts.length === 1) return accounts[0];

  const chosen = await select({
    message: `${hx(C.orLt)("🏢")}  Select an account:`,
    options: accounts.map((a) => ({ value: a.id, label: a.name })),
  });
  if (isCancel(chosen)) abort("Cancelled");
  return accounts.find((a) => a.id === chosen);
}

async function listNamespaces(token, accountId) {
  const s = spinner();
  s.start(hx(C.orLt)("📦  Fetching KV namespaces…"));
  try {
    const data = await cfFetch(
      token,
      `/accounts/${accountId}/storage/kv/namespaces?per_page=100`,
    );
    s.stop(
      `${hx(C.green)("✔")}  ${bold(data.result.length)} namespace${data.result.length !== 1 ? "s" : ""} loaded`,
    );
    return data.result;
  } catch (e) {
    s.stop(hx(C.red)("✘  Failed to fetch namespaces"));
    throw e;
  }
}

async function pickNamespace(token, accountId) {
  const namespaces = await listNamespaces(token, accountId);

  if (namespaces.length === 0) {
    console.log(
      `\n  ${hx(C.red)("✘")}  No KV namespaces found in this account.\n`,
    );
    process.exit(1);
  }

  const chosen = await select({
    message: `${hx(C.orLt)("📦")}  Select a KV namespace:`,
    options: namespaces.map((n) => ({
      value: n.id,
      label: n.title,
      hint: dim(`${n.supports_url_encoding ?? 0} keys`),
    })),
  });
  if (isCancel(chosen)) abort("Cancelled");
  return namespaces.find((n) => n.id === chosen);
}

// ─────────────────────────────────────────────────────────────
//  KEY LISTING
// ─────────────────────────────────────────────────────────────

async function listKeys(token, accountId, namespaceId) {
  const s = spinner();
  s.start(
    hx(C.orLt)(
      "🔎  Scanning keys — this may take a moment for large namespaces",
    ),
  );
  const keys = [];
  let cursor = null;
  let page = 0;
  try {
    do {
      page++;
      let url = `/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/keys?per_page=1000`;
      if (cursor) url += `&cursor=${encodeURIComponent(cursor)}`;
      const data = await cfFetch(token, url);
      keys.push(...data.result);
      cursor = data.result_info?.cursor || null;
      if (page % 5 === 4) {
        s.message(hx(C.orLt)(`📥  Fetched ${bold(keys.length)} keys so far…`));
      }
    } while (cursor);
    const count = keys.length;
    const icon = count === 0 ? "📭" : count > 1000 ? "📦💥" : "📋";
    s.stop(`${icon}  ${bold(count)} key${count !== 1 ? "s" : ""} found`);
    return keys;
  } catch (e) {
    s.stop(hx(C.red)("✘  Failed to list keys"));
    throw e;
  }
}

// ─────────────────────────────────────────────────────────────
//  DELETE ENGINE
// ─────────────────────────────────────────────────────────────

function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

async function deleteKeys(
  token,
  accountId,
  namespaceId,
  keysToDelete,
  namespaceName,
) {
  const total = keysToDelete.length;
  const chunks = chunkArray(keysToDelete, 10000);
  let deleted = 0;
  let failed = 0;

  divider("━");
  console.log(gSunset(`  ▐  🗑   BULK DESTROYER ENGAGED  🗑  ▌`));
  console.log(
    hx(C.orLt)(
      `  ▐  Target · ${bold(namespaceName)}  ·  ${bold(total)} key${total !== 1 ? "s" : ""}   ▌`,
    ),
  );
  divider("━");

  const s = spinner();
  s.start(hx(C.orLt)("Initializing deletion sequence…"));

  const startTime = Date.now();

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    try {
      const body = chunk.map((k) => k.name || k);
      await cfFetch(
        token,
        `/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/bulk/delete`,
        {
          method: "POST",
          body: JSON.stringify(body),
        },
      );
      deleted += chunk.length;
      const bar = progressBar(deleted, total);
      const emoji = milestoned(deleted);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      s.message(
        `${emoji}  ${bar}  ${dim(`[${deleted}/${total}]  chunk ${i + 1}/${chunks.length}  ${elapsed}s`)}`,
      );
    } catch (e) {
      failed += chunk.length;
      s.message(hx(C.red)(`✘  Failed chunk ${i + 1} — ${e.message}`));
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  if (failed > 0) {
    s.stop(
      `${hx(C.green)(`✔  Deleted ${bold(deleted)}`)}  ${hx(C.red)(`${failed} failed`)}  ${dim(`in ${elapsed}s`)}`,
    );
  } else {
    const emoji = total > 1000 ? "🎉🔥" : total > 10 ? "✨" : "✔";
    s.stop(
      `${hx(C.green)(`${emoji}  All ${bold(deleted)} key${deleted !== 1 ? "s" : ""} destroyed`)}  ${dim(`in ${elapsed}s`)}`,
    );
  }

  divider("━");

  // Results panel — two-column layout, all rows same width
  const LABEL_W = 12;
  const VALUE_W = 7;
  const GAP = 3;

  function fmtRow(label, value, lblColor, valColor) {
    const plainLabel = label.padEnd(LABEL_W);
    const plainValue = value.padStart(VALUE_W);
    const rendered = `${lblColor(plainLabel)}${" ".repeat(GAP)}${valColor(plainValue)}`;
    return rendered;
  }

  const results = [
    fmtRow("Total", String(total), hx(C.gold).bold, bold),
    fmtRow("✔ Deleted", String(deleted), hx(C.green).bold, bold),
    failed > 0
      ? fmtRow("✘ Failed", String(failed), hx(C.red).bold, bold)
      : fmtRow("✘ Failed", "0", hx(C.green).bold, dim),
    fmtRow("⏱  Time", `${elapsed}s`, dim, (v) => v),
  ];

  console.log(panel(results, gFire(`💀  ${namespaceName}  💀`)));
  divider("━");

  return { deleted, failed };
}

// ─────────────────────────────────────────────────────────────
//  NUKE ALL  (delete everything)
// ─────────────────────────────────────────────────────────────

async function deleteAllKeys(token, accountId, namespaceId, namespaceName) {
  const keys = await listKeys(token, accountId, namespaceId);
  if (keys.length === 0) {
    console.log(
      `\n  ${hx(C.green)("✨")}  Namespace ${hx(C.cyan)(namespaceName)} is already empty — nothing to do!\n`,
    );
    return;
  }

  // Big danger warning
  divider("━");
  const skull = `
      ▄▄▄███████████████▄▄▄
     ██▀▀               ▀▀██
    ██   ☠   ☠   ☠   ☠   ██
   ██                     ██
   ██    ⚠  D A N G E R  ██
   ██                     ██
   ██   ☠   ☠   ☠   ☠   ██
    ██▄▄               ▄▄██
     ▀▀▀███████████████▀▀▀
  `;
  console.log(gFire(skull));
  console.log(
    gFire(
      `  ⚠  DELETE ALL ${keys.length} KEY${keys.length !== 1 ? "S" : ""}  ⚠`,
    ),
  );
  console.log(hx(C.red)(`  Target · ${bold(namespaceName)}`));
  divider("━");

  const shouldProceed = await confirm({
    message: chalk.bgRed.white.bold("  NUKE THE NAMESPACE?  "),
    initial: false,
    active: "💀 Yes, destroy everything",
    inactive: "No, abort mission!",
  });
  if (isCancel(shouldProceed)) abort("Cancelled");
  if (!shouldProceed) {
    console.log(
      `\n  ${hx(C.green)("✔")}  Aborted. The namespace lives to see another day.\n`,
    );
    return;
  }

  await deleteKeys(token, accountId, namespaceId, keys, namespaceName);
}

// ─────────────────────────────────────────────────────────────
//  SELECTIVE DELETE
// ─────────────────────────────────────────────────────────────

async function selectKeysToDelete(
  token,
  accountId,
  namespaceId,
  namespaceName,
) {
  const keys = await listKeys(token, accountId, namespaceId);
  if (keys.length === 0) {
    console.log(
      `\n  ${hx(C.green)("✨")}  Namespace ${hx(C.cyan)(namespaceName)} is empty — nothing to delete!\n`,
    );
    return;
  }

  thinDivider();
  console.log(
    `  ${hx(C.orLt)("☐")}  Select keys · ${bold("space")} to toggle  ${bold("enter")} to confirm`,
  );
  console.log(
    dim(
      `     ${keys.length} key${keys.length !== 1 ? "s" : ""} available in ${hx(C.cyan)(namespaceName)}\n`,
    ),
  );

  const choices = keys.map((k) => ({
    value: k.name,
    label: k.name.length > 80 ? k.name.slice(0, 77) + "…" : k.name,
    hint: k.metadata ? dim(JSON.stringify(k.metadata).slice(0, 40)) : undefined,
  }));

  const selected = await multiselect({
    message: `${hx(C.orLt)("🔍")}  Pick your targets from ${hx(C.cyan)(namespaceName)}:`,
    options: [
      {
        value: "__ALL__",
        label: "☠  Select All",
        hint: hx(C.red)(`${keys.length} keys — delete everything`),
      },
      ...choices,
    ],
    required: false,
  });
  if (isCancel(selected)) abort("Cancelled");

  if (selected.length === 0) {
    console.log(`\n  ${dim("✔")}  No keys selected.\n`);
    return;
  }

  const allChosen = selected.includes("__ALL__");
  const keysToDelete = allChosen
    ? keys
    : keys.filter((k) => selected.includes(k.name));

  if (keysToDelete.length === 0) {
    console.log(`\n  ${dim("✔")}  No keys matched.\n`);
    return;
  }

  thinDivider();
  console.log(
    `  ${hx(C.gold)("📋")}  ${bold(keysToDelete.length)} key${keysToDelete.length !== 1 ? "s" : ""} marked for deletion`,
  );
  const pct = ((keysToDelete.length / keys.length) * 100).toFixed(1);
  console.log(dim(`     ${pct}% of namespace  ·  ${keys.length} total`));
  thinDivider();

  const shouldProceed = await confirm({
    message: `${hx(C.orLt)(`  Delete ${bold(keysToDelete.length)} key${keysToDelete.length !== 1 ? "s" : ""}?`)}`,
    initial: keysToDelete.length <= 10,
  });
  if (isCancel(shouldProceed)) abort("Cancelled");
  if (!shouldProceed) {
    console.log(`\n  ${dim("✔")}  Aborted.\n`);
    return;
  }

  await deleteKeys(token, accountId, namespaceId, keysToDelete, namespaceName);
}

// ─────────────────────────────────────────────────────────────
//  EXIT SCREEN
// ─────────────────────────────────────────────────────────────

function exitScreen() {
  divider("━");
  console.log("");
  console.log(
    gSunset(
      `       ░▒▓█  Thanks for using KV Bulk Deleter by ${AUTHOR}!  █▓▒░`,
    ),
  );
  console.log(dim(`                     ${GITHUB}`));
  console.log("");
  console.log(gNeon("              ★  ★  ★  Happy deleting!  ★  ★  ★"));
  console.log("");
  divider("━");
}

// ─────────────────────────────────────────────────────────────
//  MAIN
// ─────────────────────────────────────────────────────────────

async function main() {
  await animateIntro();

  try {
    const token = await getToken();
    const account = await pickAccount(token);

    while (true) {
      const namespace = await pickNamespace(token, account.id);

      divider("━");
      const action = await select({
        message: `${gSunset("📦")}  ${bold(namespace.title)}`,
        options: [
          {
            value: "selective",
            label: "🔍  Selective delete",
            hint: dim("pick keys individually"),
          },
          {
            value: "all",
            label: "💀  Delete ALL keys",
            hint: hx(C.red)("nuke the entire namespace"),
          },
          {
            value: "switch",
            label: "🔄  Switch namespace",
            hint: dim("pick a different one"),
          },
          { value: "exit", label: "🚪  Exit", hint: dim("quit") },
        ],
      });
      if (isCancel(action) || action === "exit") {
        exitScreen();
        outro(hx(C.orLt)("Done."));
        return;
      }

      if (action === "switch") continue;

      if (action === "all") {
        await deleteAllKeys(token, account.id, namespace.id, namespace.title);
      } else {
        await selectKeysToDelete(
          token,
          account.id,
          namespace.id,
          namespace.title,
        );
      }

      const again = await confirm({
        message: `${hx(C.orLt)("🔄")}  Do another operation?`,
        initial: true,
      });
      if (isCancel(again)) abort("Cancelled");
      if (!again) {
        exitScreen();
        outro(hx(C.orLt)("Done."));
        return;
      }
    }
  } catch (e) {
    console.error(`\n  ${hx(C.red)(`✗ Error: ${e.message}`)}`);
    process.exit(1);
  }
}

main();
