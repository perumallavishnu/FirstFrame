#!/usr/bin/env node
/* Validate the EOS R100 camera profile against the exported GLB.
   node scripts/validate-camera-profile.js
   Fails (exit 1) if a registry part has no anchor or mesh in the GLB, if a PART_* node in the GLB has no registry
   part, or if ids/anchors are duplicated. Child detail nodes (marks, tabs, rails, contacts...) are allowed. */
'use strict';
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
global.window = {};
require(path.join(root, 'js/camera/eos_r100_profile.js'));
const P = window.FF.camera;
let failed = false;
for (const url of [P.modelUrl, P.mobileModelUrl].filter(Boolean)) {
const glb = fs.readFileSync(path.join(root, url));
const jlen = glb.readUInt32LE(12), gj = JSON.parse(glb.slice(20, 20 + jlen).toString('utf8'));
const nodes = new Set(gj.nodes.map((n) => n.name));
const errs = [], warns = [];
const ids = new Set(), anchors = new Set();
for (const p of P.parts) {
  if (ids.has(p.id)) errs.push('duplicate id ' + p.id); ids.add(p.id);
  if (anchors.has(p.anchorName)) errs.push('duplicate anchor ' + p.anchorName); anchors.add(p.anchorName);
  if (!nodes.has(p.anchorName)) errs.push(`${p.id}: anchor ${p.anchorName} missing from GLB`);
  for (const m of p.meshNames) if (!nodes.has(m)) errs.push(`${p.id}: mesh ${m} missing from GLB`);
  if (!p.meshNames.length && p.status !== 'educational') errs.push(`${p.id}: physical part with no mesh`);
  if (!p.sourceUrl && p.status !== 'educational') errs.push(`${p.id}: no source`);
  for (const f of p.functions || []) if (!nodes.has(f.anchorName)) errs.push(`${p.id}/${f.dir}: anchor ${f.anchorName} missing`);
}
const meshOwners = new Set(P.parts.flatMap((p) => p.meshNames));
const DETAIL = /_(Mark\w*|Tab\d|Rail|Contact|Window|Bar|Curtain\d|Chip|Panel)(\.\d+)?$/;
for (const n of nodes) {
  if (!n.startsWith('PART_')) continue;
  if (meshOwners.has(n)) continue;
  if (DETAIL.test(n) && meshOwners.has(n.replace(DETAIL, ''))) continue;
  errs.push(`GLB node ${n} has no registry part`);
}
const stray = [...nodes].filter((n) => n.startsWith('ANCHOR_') && !anchors.has(n) && !/^ANCHOR_CrossKeys_/.test(n));
if (stray.length) warns.push('anchors in GLB without a registry part (not selectable): ' + stray.join(', '));
console.log(`${url}: ${P.parts.length} parts, ${anchors.size} anchors, ${nodes.size} nodes, ${(glb.length / 1e6).toFixed(2)} MB`);
warns.forEach((w) => console.log('  warn:', w));
if (errs.length) { errs.forEach((e) => console.log('  ERROR:', e)); failed = true; } else console.log('  OK: every part has its mesh and anchor; every PART_* mesh maps to a part');
}
process.exit(failed ? 1 : 0);
