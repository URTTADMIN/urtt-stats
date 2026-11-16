import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const restoreIndex = args.indexOf("--restore");
const RESTORE_PATH = restoreIndex >= 0 ? args[restoreIndex + 1] : "";
const BUCKET = "special-card-images";
const BACKUP_DIR = resolve(process.env.SPECIAL_CARD_BACKUP_DIR || ".special-card-migration-backups");
const BASE_URL = String(process.env.SUPABASE_URL || "").replace(/\/+$/, "");
// This utility is the only part of this migration that reads the service key.
// Dry-run and restore preview use a publishable key where a Supabase read is needed.
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;

function makeHeaders(key) {
  const headers = { apikey: key };
  // New Supabase sb_publishable_ / sb_secret_ keys are opaque API keys, not JWTs.
  // Keep Authorization only for legacy anon/service_role JWT keys.
  if (!String(key || "").startsWith("sb_")) headers.Authorization = `Bearer ${key}`;
  return headers;
}

async function request(path, options = {}, key = APPLY ? SERVICE_ROLE_KEY : PUBLISHABLE_KEY) {
  if (!BASE_URL || !key) throw new Error("SUPABASE_URL et la clé requise ne sont pas définies dans l’environnement local.");
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { ...makeHeaders(key), ...options.headers },
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    throw new Error(`Supabase ${response.status}: ${detail}`);
  }
  return response;
}

function requireApplyKey() {
  if (!BASE_URL || !SERVICE_ROLE_KEY) {
    throw new Error("Pour écrire, définis SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY uniquement dans l’environnement local. Ne les mets pas dans .env ni dans le dépôt.");
  }
}

function parseDataUri(image) {
  const match = String(image || "").match(/^data:image\/(png|jpe?g|webp);base64,([\s\S]+)$/i);
  if (!match) return null;
  return Buffer.from(match[2], "base64");
}

function safeSlug(value) {
  return String(value || "special-card")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "special-card";
}

function publicObjectUrl(path) {
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  return `${BASE_URL}/storage/v1/object/public/${BUCKET}/${encodedPath}`;
}

async function convert(card) {
  const input = parseDataUri(card.image);
  if (!input) {
    const currentImage = String(card.image || "");
    if (!/^https?:\/\//i.test(currentImage)) {
      throw new Error(`Image absente ou format non pris en charge pour la carte « ${card.name || card.id || "sans nom"} ».`);
    }
    return {
      card,
      skipped: true,
      beforeBytes: Buffer.byteLength(currentImage),
      webpBytes: 0,
      urlBytes: Buffer.byteLength(currentImage),
    };
  }

  const webp = await sharp(input)
    .rotate()
    .resize({ width: 256, height: 256, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82, alphaQuality: 90, effort: 5 })
    .toBuffer();
  const contentHash = createHash("sha256").update(webp).digest("hex");
  const objectPath = `special-cards/${safeSlug(card.id || card.name)}-${contentHash.slice(0, 20)}.webp`;
  const imageUrl = publicObjectUrl(objectPath);

  return {
    card: { ...card, image: imageUrl },
    input,
    webp,
    objectPath,
    contentHash,
    imageUrl,
    beforeBytes: Buffer.byteLength(String(card.image)),
    webpBytes: webp.length,
    urlBytes: Buffer.byteLength(imageUrl),
  };
}

async function loadSpecialCards(key) {
  const response = await request("/rest/v1/site_settings?select=key,value&key=eq.specialCards", {}, key);
  const rows = await response.json();
  if (!Array.isArray(rows) || rows.length !== 1 || !Array.isArray(rows[0].value)) {
    throw new Error("La ligne site_settings.specialCards est absente ou son format est inattendu.");
  }
  return rows[0].value;
}

function readBackupRows(text, backupPath) {
  let rows;
  try {
    rows = JSON.parse(text);
  } catch {
    throw new Error(`La sauvegarde n’est pas un JSON lisible : ${backupPath}`);
  }
  if (!Array.isArray(rows) || !rows.length || rows.some((row) => !row || typeof row.key !== "string" || !("value" in row))) {
    throw new Error(`La sauvegarde ne contient pas une exportation complète de site_settings : ${backupPath}`);
  }
  const specialRow = rows.find((row) => row.key === "specialCards");
  if (!specialRow || !Array.isArray(specialRow.value)) {
    throw new Error(`La sauvegarde ne contient pas site_settings.specialCards : ${backupPath}`);
  }
  return { rows, specialRow };
}

async function restoreFromBackup(backupPath) {
  if (!backupPath) throw new Error("Utilisation : --restore <chemin-sauvegarde> [--apply].");
  const absoluteBackupPath = resolve(backupPath);
  const { rows, specialRow } = readBackupRows(await readFile(absoluteBackupPath, "utf8"), absoluteBackupPath);
  const cards = specialRow.value;
  const restoredBytes = Buffer.byteLength(JSON.stringify(cards));

  if (!APPLY) {
    console.log("APERÇU DE RESTAURATION — aucune écriture effectuée");
    console.log(`Sauvegarde lisible : ${absoluteBackupPath}`);
    console.log(`Réglages sauvegardés : ${rows.length} lignes ; specialCards : ${cards.length} cartes, ${restoredBytes} octets.`);
    console.log("La restauration rétablira uniquement la ligne specialCards afin de préserver tout autre réglage modifié depuis la sauvegarde.");
    console.log("Pour appliquer : ajouter --apply. La commande exige SUPABASE_SERVICE_ROLE_KEY dans l’environnement local.");
    return;
  }

  requireApplyKey();
  const currentCards = await loadSpecialCards(SERVICE_ROLE_KEY);
  if (JSON.stringify(currentCards) === JSON.stringify(cards)) {
    console.log("Restauration inutile : specialCards correspond déjà à cette sauvegarde. Aucune écriture effectuée.");
    return;
  }
  await request("/rest/v1/site_settings?key=eq.specialCards", {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ value: cards }),
  }, SERVICE_ROLE_KEY);
  console.log(`Restauration terminée depuis ${absoluteBackupPath}. Seule la ligne specialCards a été rétablie.`);
}

async function verifyPublicObject(item) {
  const response = await fetch(item.imageUrl, { cache: "no-store" });
  if (response.status === 404) return false;
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    let errorInfo = {};
    try {
      errorInfo = JSON.parse(detail);
    } catch {
      // Keep the HTTP status and response body below for unexpected errors.
    }
    // Supabase Storage can wrap a missing-object 404 in an HTTP 400 response.
    if (errorInfo.code === "NoSuchKey" || Number(errorInfo.statusCode) === 404 || errorInfo.error === "not_found") return false;
    throw new Error(`L’objet ${item.objectPath} n’est pas lisible publiquement (HTTP ${response.status}) : ${detail}`);
  }
  const content = Buffer.from(await response.arrayBuffer());
  const hash = createHash("sha256").update(content).digest("hex");
  if (hash !== item.contentHash) {
    throw new Error(`L’objet ${item.objectPath} existe mais son contenu diffère. Aucun objet ni JSON n’a été écrasé.`);
  }
  return true;
}

async function verifyAllPublicCardImages(cards) {
  if (cards.length !== 8) {
    throw new Error(`Vérification refusée : ${cards.length} cartes trouvées au lieu des 8 attendues.`);
  }
  for (const card of cards) {
    const imageUrl = String(card.image || "");
    if (!/^https?:\/\//i.test(imageUrl)) {
      throw new Error(`La carte « ${card.name || card.id || "sans nom"} » ne contient pas une URL publique.`);
    }
    const response = await fetch(imageUrl, { cache: "no-store" });
    if (!response.ok || !String(response.headers.get("content-type") || "").toLowerCase().startsWith("image/")) {
      throw new Error(`L’image de « ${card.name || card.id || "sans nom"} » n’est pas publiquement accessible comme image (HTTP ${response.status}).`);
    }
    if ((await response.arrayBuffer()).byteLength === 0) {
      throw new Error(`L’image de « ${card.name || card.id || "sans nom"} » est accessible mais vide.`);
    }
  }
  console.log("Vérification publique réussie : 8 cartes ont une URL HTTP(S) accessible renvoyant une image.");
}

async function uploadIfMissing(item) {
  if (await verifyPublicObject(item)) {
    console.log(`Déjà téléversé et vérifié, ignoré : ${item.objectPath}`);
    return;
  }

  const objectPath = item.objectPath.split("/").map(encodeURIComponent).join("/");
  try {
    await request(`/storage/v1/object/${BUCKET}/${objectPath}`, {
      method: "POST",
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "max-age=31536000",
        "x-upsert": "false",
      },
      body: item.webp,
    }, SERVICE_ROLE_KEY);
  } catch (error) {
    // A concurrent retry may have created the same deterministic object.
    if (!(await verifyPublicObject(item))) throw error;
    console.log(`Créé par une autre reprise, vérifié et ignoré : ${item.objectPath}`);
    return;
  }

  if (!(await verifyPublicObject(item))) throw new Error(`Vérification publique échouée après l’upload de ${item.objectPath}. Le JSON n’a pas été modifié.`);
  console.log(`Téléversé et vérifié : ${item.objectPath}`);
}

async function createAndVerifyBackup(fullSettings) {
  await mkdir(BACKUP_DIR, { recursive: true });
  const backupPath = resolve(BACKUP_DIR, `site_settings-${new Date().toISOString().replaceAll(":", "-")}.json`);
  await writeFile(backupPath, `${JSON.stringify(fullSettings, null, 2)}\n`, { flag: "wx" });
  const verified = readBackupRows(await readFile(backupPath, "utf8"), backupPath);
  if (verified.rows.length !== fullSettings.length || JSON.stringify(verified.rows) !== JSON.stringify(fullSettings)) {
    throw new Error(`La sauvegarde n’a pas pu être relue et vérifiée : ${backupPath}. Aucune donnée Supabase n’a été modifiée.`);
  }
  console.log(`Sauvegarde complète vérifiée avant toute écriture : ${backupPath}`);
  return backupPath;
}

async function migrate() {
  const keyForRead = APPLY ? SERVICE_ROLE_KEY : PUBLISHABLE_KEY;
  if (!BASE_URL || !keyForRead) {
    throw new Error(APPLY
      ? "Définis SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY localement."
      : "Définis SUPABASE_URL et SUPABASE_PUBLISHABLE_KEY localement pour le dry-run.");
  }
  if (APPLY) requireApplyKey();

  const cards = await loadSpecialCards(keyForRead);
  const converted = await Promise.all(cards.map(convert));
  const nextCards = converted.map((item) => item.card);
  const beforeJsonBytes = Buffer.byteLength(JSON.stringify(cards));
  const afterJsonBytes = Buffer.byteLength(JSON.stringify(nextCards));
  const imagesBefore = converted.reduce((sum, item) => sum + item.beforeBytes, 0);
  const imagesAfter = converted.reduce((sum, item) => sum + (item.webpBytes || item.urlBytes), 0);

  console.log(APPLY ? "MIGRATION EXPLICITE" : "DRY-RUN — aucune écriture effectuée");
  console.log("Carte | Actuel | WebP estimé | Diminution");
  for (const [index, item] of converted.entries()) {
    const cardName = String(item.card.name || `Carte ${index + 1}`);
    const name = `${cardName} — ${String(item.card.label || "").trim()}`.replace(/\s+—\s*$/, "").replaceAll("|", "/");
    const afterBytes = item.skipped ? item.urlBytes : item.webpBytes;
    const reduction = item.beforeBytes ? Math.round((1 - afterBytes / item.beforeBytes) * 100) : 0;
    console.log(`${name} | ${item.beforeBytes} o | ${afterBytes} o${item.skipped ? " (déjà URL)" : ""} | ${item.skipped ? "—" : `${reduction} %`}`);
  }
  console.log(`Images: ${imagesBefore} o → ${imagesAfter} o`);
  console.log(`specialCards JSON: ${beforeJsonBytes} o → ${afterJsonBytes} o`);

  if (!APPLY) {
    console.log("Pour appliquer après validation : npm run migrate-special-card-images -- --apply");
    return;
  }

  if (converted.every((item) => item.skipped)) {
    await verifyAllPublicCardImages(cards);
    console.log("Toutes les cartes utilisent déjà des URLs. Aucune sauvegarde, upload ou écriture JSON nécessaire.");
    return;
  }

  const bucketsResponse = await fetch(`${BASE_URL}/storage/v1/bucket`, { headers: makeHeaders(SERVICE_ROLE_KEY) });
  if (!bucketsResponse.ok) {
    const detail = (await bucketsResponse.text()).slice(0, 500);
    throw new Error(`Impossible de lire la liste Storage (HTTP ${bucketsResponse.status}). Vérifie le projet et la clé secrète. ${detail}`);
  }
  const buckets = await bucketsResponse.json();
  if (!Array.isArray(buckets) || !buckets.some((bucket) => bucket.id === BUCKET)) {
    throw new Error(`L’API Storage ne voit pas le bucket ${BUCKET}, même si la table storage.buckets le contient.`);
  }

  const fullSettingsResponse = await request("/rest/v1/site_settings?select=*", {}, SERVICE_ROLE_KEY);
  const fullSettings = await fullSettingsResponse.json();
  if (!Array.isArray(fullSettings) || !fullSettings.length) throw new Error("Impossible d’exporter les réglages complets.");
  await createAndVerifyBackup(fullSettings);

  // All objects are content-addressed and verified before the single JSON update.
  // A retry skips matching objects and never overwrites an object or a changed JSON row.
  for (const item of converted.filter((entry) => !entry.skipped)) await uploadIfMissing(item);

  const latestCards = await loadSpecialCards(SERVICE_ROLE_KEY);
  if (JSON.stringify(latestCards) === JSON.stringify(nextCards)) {
    console.log("Le JSON a déjà été remplacé par une reprise précédente. Aucune nouvelle écriture JSON.");
    return;
  }
  if (JSON.stringify(latestCards) !== JSON.stringify(cards)) {
    throw new Error("site_settings.specialCards a changé pendant la migration. Les images vérifiées restent dans Storage, mais le JSON n’a pas été écrasé. Relance après avoir examiné les changements.");
  }

  await request("/rest/v1/site_settings?key=eq.specialCards", {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ value: nextCards }),
  }, SERVICE_ROLE_KEY);
  const migratedCards = await loadSpecialCards(SERVICE_ROLE_KEY);
  await verifyAllPublicCardImages(migratedCards);
  console.log("Migration terminée : le JSON a été relu après écriture et les 8 images ont été validées publiquement.");
}

if (restoreIndex >= 0) {
  await restoreFromBackup(RESTORE_PATH);
} else {
  await migrate();
}
