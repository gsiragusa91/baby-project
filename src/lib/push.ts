import { createECDH, createPrivateKey, createCipheriv, hkdfSync, randomBytes, sign } from "node:crypto";

/**
 * Web Push SIN dependencias: implementado con node:crypto.
 *
 * Mandar un push tiene dos partes:
 *  1) VAPID (RFC 8292): firmamos un JWT con nuestra clave privada. Es la "credencial"
 *     que le dice al servicio del navegador (Apple/Google) que el push es nuestro.
 *  2) Cifrado del payload (RFC 8291 / aes128gcm): el cuerpo va cifrado con un secreto
 *     derivado de las claves del navegador (p256dh + auth). Solo ese dispositivo puede
 *     descifrarlo; ni el servicio intermediario lo lee.
 *
 * La librería `web-push` hacía exactamente esto por debajo.
 */

export type StoredSubscription = {
  endpoint: string;
  p256dh: string; // clave pública del navegador (base64url, 65 bytes)
  auth: string; // secreto del navegador (base64url, 16 bytes)
};

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

export type PushResult = {
  endpoint: string;
  ok: boolean;
  /** true si el navegador reportó que la suscripción ya no existe (404/410). */
  expired: boolean;
};

const b64url = (buf: Buffer) => buf.toString("base64url");
const fromB64url = (str: string) => Buffer.from(str, "base64url");

/** Concatena "<texto>\0" + extras, como pide el esquema de info de HKDF. */
function infoBytes(label: string, ...extra: Buffer[]) {
  return Buffer.concat([Buffer.from(label, "utf8"), Buffer.from([0]), ...extra]);
}

/**
 * Cifra el payload para una suscripción (aes128gcm, un solo record).
 * Devuelve el cuerpo binario listo para enviar (header + ciphertext + tag).
 */
function encryptPayload(plaintext: Buffer, uaPublic: Buffer, authSecret: Buffer) {
  // Par efímero del servidor para ESTE mensaje (distinto de las claves VAPID).
  const ecdh = createECDH("prime256v1");
  const asPublic = ecdh.generateKeys(); // 65 bytes, uncompressed (empieza con 0x04)
  const ecdhSecret = ecdh.computeSecret(uaPublic); // 32 bytes

  const salt = randomBytes(16);

  // RFC 8291: IKM = HKDF(salt=auth, ikm=ecdhSecret, info="WebPush: info"||ua||as)
  const keyInfo = infoBytes("WebPush: info", uaPublic, asPublic);
  const ikm = Buffer.from(hkdfSync("sha256", ecdhSecret, authSecret, keyInfo, 32));

  // RFC 8188: de (salt, IKM) derivamos la clave (CEK) y el nonce.
  const cek = Buffer.from(
    hkdfSync("sha256", ikm, salt, infoBytes("Content-Encoding: aes128gcm"), 16)
  );
  const nonce = Buffer.from(
    hkdfSync("sha256", ikm, salt, infoBytes("Content-Encoding: nonce"), 12)
  );

  // Un único record: plaintext + delimitador 0x02.
  const padded = Buffer.concat([plaintext, Buffer.from([0x02])]);
  const cipher = createCipheriv("aes-128-gcm", cek, nonce);
  const ciphertext = Buffer.concat([cipher.update(padded), cipher.final()]);
  const tag = cipher.getAuthTag();

  // Header aes128gcm: salt(16) | recordSize(4) | idLen(1) | keyid(=asPublic).
  const rs = Buffer.alloc(4);
  rs.writeUInt32BE(4096, 0);
  const header = Buffer.concat([salt, rs, Buffer.from([asPublic.length]), asPublic]);

  return Buffer.concat([header, ciphertext, tag]);
}

/** Arma el header Authorization con un JWT VAPID firmado (ES256). */
function vapidAuthHeader(audience: string) {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:guido.siragusa@gmail.com";
  if (!publicKey || !privateKey) {
    throw new Error("Faltan VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY.");
  }

  // La clave privada la reconstruimos como JWK (necesita d + x + y).
  const pub = fromB64url(publicKey); // 65 bytes: 0x04 | X(32) | Y(32)
  const jwk = {
    kty: "EC",
    crv: "P-256",
    d: privateKey,
    x: b64url(pub.subarray(1, 33)),
    y: b64url(pub.subarray(33, 65))
  };
  const keyObject = createPrivateKey({ key: jwk, format: "jwk" });

  const header = b64url(Buffer.from(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const payload = b64url(
    Buffer.from(
      JSON.stringify({
        aud: audience,
        exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60, // 12 h (máx 24 h)
        sub: subject
      })
    )
  );
  const signingInput = `${header}.${payload}`;
  // ES256 necesita la firma "cruda" r||s (64 bytes), no DER → dsaEncoding ieee-p1363.
  const signature = sign("SHA256", Buffer.from(signingInput), {
    key: keyObject,
    dsaEncoding: "ieee-p1363"
  });

  const jwt = `${signingInput}.${b64url(signature)}`;
  return `vapid t=${jwt}, k=${publicKey}`;
}

/** Envía el payload a una suscripción. No tira: devuelve ok/expired. */
async function sendOne(sub: StoredSubscription, data: Buffer): Promise<PushResult> {
  try {
    const audience = new URL(sub.endpoint).origin;
    const body = encryptPayload(data, fromB64url(sub.p256dh), fromB64url(sub.auth));

    const res = await fetch(sub.endpoint, {
      method: "POST",
      headers: {
        Authorization: vapidAuthHeader(audience),
        "Content-Encoding": "aes128gcm",
        "Content-Type": "application/octet-stream",
        TTL: "86400"
      },
      body
    });

    if (res.ok) return { endpoint: sub.endpoint, ok: true, expired: false };
    const expired = res.status === 404 || res.status === 410;
    return { endpoint: sub.endpoint, ok: false, expired };
  } catch {
    return { endpoint: sub.endpoint, ok: false, expired: false };
  }
}

/** Envía el payload a varias suscripciones en paralelo. */
export async function sendPushToSubscriptions(
  subs: StoredSubscription[],
  payload: PushPayload
): Promise<PushResult[]> {
  const data = Buffer.from(JSON.stringify(payload), "utf8");
  return Promise.all(subs.map((sub) => sendOne(sub, data)));
}
