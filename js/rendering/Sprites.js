/**
 * Sprites.js — Procedural canvas drawing routines.
 *
 * Everything is drawn from shapes/colours so there are no external image
 * assets. These functions are the single place to swap in real sprites later.
 *
 * Coordinates are in world pixels: (tile.x * ts, tile.y * ts) with the camera
 * transform already applied by the renderer.
 */

import { RESOURCE_TYPES } from '../data/resources.js';
import { BUILDING_DEFS } from '../data/buildings.js';
import { CONFIG } from '../core/config.js';

const BIOME_COLORS = {
  grass: '#4a7a3a',
  stone: '#6b7078',
  river: '#3d6f9e',
};

const MINION_COLORS = {
  idle: '#e8e2d0',
  moving: '#8fd0ff',
  working: '#ffd166',
  recharging: '#7fe0ff',
};

export function drawGround(ctx, tile, ts) {
  const x = tile.x * ts;
  const y = tile.y * ts;
  ctx.fillStyle = BIOME_COLORS[tile.biome] || '#333';
  ctx.fillRect(x, y, ts, ts);

  // Subtle checker so tile boundaries read on flat ground.
  if ((tile.x + tile.y) % 2 === 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    ctx.fillRect(x, y, ts, ts);
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.12)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, ts - 1, ts - 1);
}

export function drawGroundItem(ctx, tile, ts) {
  const item = tile.groundItem;
  if (!item) return;
  const res = RESOURCE_TYPES[item.type];
  const color = res ? res.color : '#fff';
  const x = tile.x * ts;
  const y = tile.y * ts;
  const s = ts * 0.42;
  const ox = x + (ts - s) / 2;
  const oy = y + (ts - s) / 2;

  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.roundRect(ox + 1.5, oy + 2, s, s, 3);
  ctx.fill();

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(ox, oy, s, s, 3);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = 1;
  ctx.stroke();

  if (item.qty > 1) {
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.max(9, ts * 0.32)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(item.qty), x + ts / 2, y + ts / 2 + 1);
  }
}

export function drawTree(ctx, tile, ts) {
  const tree = tile.tree;
  if (!tree) return;
  const cx = tile.x * ts + ts / 2;
  const cy = tile.y * ts + ts / 2;

  // Trunk.
  ctx.fillStyle = '#5b4027';
  ctx.fillRect(cx - ts * 0.08, cy - ts * 0.02, ts * 0.16, ts * 0.4);

  const r = tree.mature ? ts * 0.34 : ts * 0.18;
  ctx.fillStyle = tree.mature ? '#2f6b2a' : '#4f8a43';
  ctx.beginPath();
  ctx.arc(cx, cy - ts * 0.16, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.beginPath();
  ctx.arc(cx - r * 0.3, cy - ts * 0.16 - r * 0.3, r * 0.4, 0, Math.PI * 2);
  ctx.fill();
}

export function drawVein(ctx, tile, ts) {
  const vein = tile.vein;
  if (!vein) return;
  const cx = tile.x * ts + ts / 2;
  const cy = tile.y * ts + ts / 2;
  const ore = vein === 'stone' ? '#666666' : vein === 'iron' ? '#b09a8c' : '#c98a4a';

  ctx.fillStyle = '#5a5f66';
  ctx.beginPath();
  ctx.arc(cx - ts * 0.08, cy + ts * 0.06, ts * 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#7a7f86';
  ctx.beginPath();
  ctx.arc(cx + ts * 0.1, cy - ts * 0.06, ts * 0.24, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = ore;
  ctx.beginPath();
  ctx.arc(cx, cy - ts * 0.02, ts * 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = ore;
  ctx.beginPath();
  ctx.arc(cx + ts * 0.14, cy + ts * 0.1, ts * 0.08, 0, Math.PI * 2);
  ctx.fill();
}

export function drawBuilding(ctx, building, ts) {
  const tiles = building.footprintTiles();
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const t of tiles) {
    minX = Math.min(minX, t.x);
    minY = Math.min(minY, t.y);
    maxX = Math.max(maxX, t.x);
    maxY = Math.max(maxY, t.y);
  }
  const px = minX * ts;
  const py = minY * ts;
  const w = (maxX - minX + 1) * ts;
  const h = (maxY - minY + 1) * ts;
  const def = building.def;
  const color = building.paused ? '#aaa' : def.color || '#888';

  if (def.kind === 'path' || def.kind === 'fastPath' || def.kind === 'bridge') {
    drawPathTile(ctx, building, minX, minY, ts);
    return;
  }

  // Construction sites: pale + progress bar.
  if (building.state === 'construction') {
    ctx.globalAlpha = 0.4;
  }

  // Base footprint.
  ctx.fillStyle = color;
  ctx.fillRect(px + 1, py + 1, w - 2, h - 2);
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.lineWidth = 2;
  ctx.strokeRect(px + 1, py + 1, w - 2, h - 2);

  // Raised "roof" face for a subtle 3/4 feel.
  const inset = Math.max(2, ts * 0.1);
  if (building.state === 'construction') {
    ctx.fillStyle = shade(color, 0.75);
  } else {
    ctx.fillStyle = shade(color, 1.25);
  }
  if (building.paused) {
    ctx.fillStyle = color;
  }
  ctx.fillRect(px + inset, py + inset, w - inset * 2, h - inset * 2);
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 1;
  ctx.strokeRect(px + inset, py + inset, w - inset * 2, h - inset * 2);

  // Door notch.
  const door = building.doorTile();
  const dx = (door.x - minX) * ts;
  const dy = (door.y - minY) * ts;
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(px + dx + ts * 0.2, py + dy + ts * 0.2, ts * 0.6, ts * 0.6);

  // Emblem (initial) or stored-item icon, centred.
  if (w >= ts * 1.2 && h >= ts * 1.2) {
    if (def.kind === 'storage' && building.inventory) {
      const storedType = building.inventory.type;
      if (storedType && RESOURCE_TYPES[storedType]) {
        const res = RESOURCE_TYPES[storedType];
        const s = ts * 0.64;
        ctx.fillStyle = res.color;
        ctx.beginPath();
        ctx.roundRect(px + w / 2 - s / 2, py + h / 2 - s / 2, s, s, 3);
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.55)';
        ctx.lineWidth = 1;
        ctx.stroke();
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.font = `bold ${Math.round(ts * 0.5)}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(emblem(def.id), px + w / 2, py + h / 2 + 1);
      }
    } else if (def.id === 'factory' || def.id === 'smeltery' && building.designatedRecipe) {
      const storedType = building.designatedRecipe;
      if (storedType && RESOURCE_TYPES[storedType]) {
        const res = RESOURCE_TYPES[storedType];
        const s = ts * 0.64;
        ctx.fillStyle = res.color;
        ctx.beginPath();
        ctx.roundRect(px + w / 2 - s / 2, py + h / 2 - s / 2, s, s, 3);
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.55)';
        ctx.lineWidth = 1;
        ctx.stroke();
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.font = `bold ${Math.round(ts * 0.5)}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(emblem(def.id), px + w / 2, py + h / 2 + 1);
      }
    }
    ctx.fillStyle = 'rgba(32, 32, 32, 0.9)';
    ctx.font = `bold ${Math.round(ts * 0.5)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emblem(def.id, building), px + w / 2, py + h / 2 + 1);
  }

  if (building.state === 'construction') {
    ctx.globalAlpha = 1;
    // Progress bar.
    const barW = w * 0.7;
    const barX = px + (w - barW) / 2;
    const barY = py + h - 6;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(barX, barY, barW, 4);
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(barX, barY, barW * building.progress, 4);
  }

  // Storage: show fill fraction.
  if (def.kind === 'storage' && building.inventory) {
    const frac = building.inventory.total / building.inventory.capacity;
    const barW = w * 0.7;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(px + (w - barW) / 2, py + h - 10, barW, 3);
    ctx.fillStyle = '#6bdf8a';
    ctx.fillRect(px + (w - barW) / 2, py + h - 10, barW * frac, 3);
  }
}

function drawPathTile(ctx, building, x, y, ts) {
  const def = building.def;
  const px = x * ts;
  const py = y * ts;
  const color = def.color || '#b7a98a';

  if (building.state === 'construction') {
    ctx.globalAlpha = 0.5;
  }

  ctx.fillStyle = color;
  ctx.fillRect(px, py, ts, ts);

  if (def.kind === 'fastPath') {
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px + ts * 0.25, py + ts * 0.7);
    ctx.lineTo(px + ts * 0.75, py + ts * 0.3);
    ctx.stroke();
  } else if (def.kind === 'bridge') {
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 1;
    for (let i = 1; i <= 3; i++) {
      ctx.beginPath();
      ctx.moveTo(px, py + (ts / 4) * i);
      ctx.lineTo(px + ts, py + (ts / 4) * i);
      ctx.stroke();
    }
  } else {
    // Path pebbles.
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.fillRect(px + ts * 0.2, py + ts * 0.2, ts * 0.2, ts * 0.15);
    ctx.fillRect(px + ts * 0.6, py + ts * 0.55, ts * 0.18, ts * 0.14);
  }

  if (building.state === 'construction') {
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(px + 2, py + ts / 2 - 2, (ts - 4) * building.progress, 4);
  }
}

export function drawMinion(ctx, minion, ts, nowSec) {
  // minion.x/y are already the tile CENTRE (tile index + 0.5), so no extra
  // half-tile offset is needed here.
  const x = minion.x * ts;
  const y = minion.y * ts;
  const r = ts * 0.22;
  const bob = Math.sin(nowSec * 3 + minion.id) * ts * 0.04;
  const cy = y + bob;

  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(x, y + r * 0.8, r, r * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Body.
  const color = MINION_COLORS[minion.state] || MINION_COLORS.idle;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Eye.
  ctx.fillStyle = '#222';
  ctx.beginPath();
  ctx.arc(x + r * 0.25, cy - r * 0.15, r * 0.22, 0, Math.PI * 2);
  ctx.fill();

  // Carried item.
  if (minion.carried) {
    const res = RESOURCE_TYPES[minion.carried.type];
    const cs = ts * 0.3;
    ctx.fillStyle = res ? res.color : '#fff';
    ctx.fillRect(x - cs / 2, cy - r - cs - 1, cs, cs);
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x - cs / 2, cy - r - cs - 1, cs, cs);
  }

  // Battery bar.
  const frac = minion.battery / CONFIG.minion.maxBatteryHours;
  const bw = ts * 0.7;
  const bx = x - bw / 2;
  const by = cy + r + 1;
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(bx, by, bw, 2.5);
  ctx.fillStyle = frac > 0.3 ? '#6bdf8a' : '#ff6b6b';
  ctx.fillRect(bx, by, bw * frac, 2.5);
}

export function drawGhost(ctx, world, def, x, y, rotation, valid, ts) {
  const local = (lx, ly) => {
    const { w, h } = def.footprint;
    switch (rotation) {
      case 0:
        return { x: x + lx, y: y + ly };
      case 1:
        return { x: x + (h - 1 - ly), y: y + lx };
      case 2:
        return { x: x + (w - 1 - lx), y: y + (h - 1 - ly) };
      case 3:
        return { x: x + ly, y: y + (w - 1 - lx) };
      default:
        return { x: x + lx, y: y + ly };
    }
  };

  for (let ly = 0; ly < def.footprint.h; ly++) {
    for (let lx = 0; lx < def.footprint.w; lx++) {
      const p = local(lx, ly);
      const px = p.x * ts;
      const py = p.y * ts;
      ctx.fillStyle = valid ? 'rgba(93,179,255,0.35)' : 'rgba(255,107,107,0.35)';
      ctx.fillRect(px + 1, py + 1, ts - 2, ts - 2);
      ctx.strokeStyle = valid ? 'rgba(93,179,255,0.9)' : 'rgba(255,107,107,0.9)';
      ctx.lineWidth = 2;
      ctx.strokeRect(px + 1, py + 1, ts - 2, ts - 2);
    }
  }

  // Door marker (local (0, h-1), rotated with the shape).
  const door = local(0, def.footprint.h - 1);
  const dx = door.x * ts;
  const dy = door.y * ts;
  ctx.fillStyle = 'rgba(255,209,102,0.85)';
  ctx.fillRect(dx + ts * 0.2, dy + ts * 0.2, ts * 0.6, ts * 0.6);
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(dx + ts * 0.3, dy + ts * 0.3, ts * 0.4, ts * 0.4);
}

/**
 * Draw a pulsing highlight around the currently inspected target:
 * a building (whole footprint), an ore vein / tree (single tile), or a minion
 * (its current tile, so the ring follows it as it moves).
 */
export function drawSelection(ctx, selection, ts) {
  if (!selection) return;

  let rects = [];
  if (selection.kind === 'building') {
    const b = selection.building;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const t of b.footprintTiles()) {
      minX = Math.min(minX, t.x);
      minY = Math.min(minY, t.y);
      maxX = Math.max(maxX, t.x);
      maxY = Math.max(maxY, t.y);
    }
    rects = [{ x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 }];
  } else if (selection.kind === 'minion') {
    const m = selection.minion;
    if (m.dead) return;
    rects = [{ x: Math.floor(m.x), y: Math.floor(m.y), w: 1, h: 1 }];
  } else if (selection.kind === 'vein' || selection.kind === 'tree') {
    rects = [{ x: selection.x, y: selection.y, w: 1, h: 1 }];
  }

  const pulse = 0.55 + 0.45 * Math.sin(performance.now() / 200);
  for (const r of rects) {
    const px = r.x * ts;
    const py = r.y * ts;
    const pw = r.w * ts;
    const ph = r.h * ts;
    ctx.fillStyle = `rgba(255, 209, 102, ${0.1 + 0.06 * pulse})`;
    ctx.fillRect(px + 1, py + 1, pw - 2, ph - 2);
    ctx.strokeStyle = `rgba(255, 209, 102, ${pulse})`;
    ctx.lineWidth = 3;
    ctx.strokeRect(px + 1.5, py + 1.5, pw - 3, ph - 3);
  }
}

/** Draw a building icon for the hotbar. */
export function drawIcon(ctx, defId, size) {
  const def = BUILDING_DEFS[defId];
  if (!def) return;
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = def.color || '#888';
  ctx.beginPath();
  ctx.roundRect(2, 2, size - 4, size - 4, 4);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = `bold ${Math.round(size * 0.5)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emblem(defId), size / 2, size / 2 + 1);
}

function emblem(id, b = null) {
  const map = {
    path: 'P',
    fastPath: 'F',
    bridge: 'B',
    collectingStation: 'C',
    woodcuttingStation: 'W',
    forestingStation: 'F',
    drillingStation: 'D',
    rechargeStation: '⚡',
    minionDuplicationStation: 'M',
    storageSmall: 'S',
    storageMedium: 'S',
    storageLarge: 'S',
    factory: 'F',
    smeltery: 'S',
    transportStation: 'T',
  };
  if( b && b.inventory && b.inventory.designatedType ) {
    return b.inventory.designatedType.slice(0,2);
  }
  if( b && b.designatedRecipe ) {
    return b.designatedRecipe.slice(0,2);
  }
  return map[id] || '?';
}

function shade(hex, factor) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255;
  let g = (n >> 8) & 255;
  let b = n & 255;
  r = Math.min(255, Math.round(r * factor));
  g = Math.min(255, Math.round(g * factor));
  b = Math.min(255, Math.round(b * factor));
  return `rgb(${r},${g},${b})`;
}
