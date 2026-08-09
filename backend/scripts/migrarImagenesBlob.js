// Migración: mueve las imágenes guardadas como base64 en MongoDB a Vercel Blob
// y deja sólo la URL en el documento. Idempotente: lo que ya es URL lo saltea.
//
// Uso (desde la carpeta backend/, con las envs cargadas):
//   MONGODB_URI="..." BLOB_READ_WRITE_TOKEN="..." node scripts/migrarImagenesBlob.js
//
// Tip: podés bajar el token con `vercel env pull` o copiarlo del dashboard de
// Vercel (Storage → tu Blob store → .env.local).

import mongoose from "mongoose";
import dotenv from "dotenv";
import { subirImagen } from "../src/lib/blob.js";
import User from "../src/models/userModel.js";
import Group from "../src/models/groupModel.js";
import Challenge from "../src/models/challengeModel.js";
import Post from "../src/models/postModel.js";

dotenv.config();

const esBase64 = (v) => typeof v === "string" && v.startsWith("data:image/");
let subidas = 0;

const conv = async (valor, carpeta) => {
  if (!esBase64(valor)) return valor;
  const url = await subirImagen(valor, carpeta);
  if (url && url !== valor) subidas++;
  return url;
};

async function main() {
  if (!process.env.MONGODB_URI) throw new Error("Falta MONGODB_URI");
  if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error("Falta BLOB_READ_WRITE_TOKEN");
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Conectado a Mongo. Migrando imágenes base64 → Blob...\n");

  // --- Usuarios: foto de perfil, portada y negocios ---
  const usuarios = await User.find({
    $or: [
      { profilePhotoUrl: /^data:image\// },
      { bannerUrl: /^data:image\// },
      { "businessProfiles.logoUrl": /^data:image\// },
      { "businessProfiles.bannerUrl": /^data:image\// },
    ],
  });
  for (const u of usuarios) {
    u.profilePhotoUrl = await conv(u.profilePhotoUrl, "perfil");
    u.bannerUrl = await conv(u.bannerUrl, "perfil");
    if (Array.isArray(u.businessProfiles)) {
      for (const b of u.businessProfiles) {
        b.logoUrl = await conv(b.logoUrl, "negocios");
        b.bannerUrl = await conv(b.bannerUrl, "negocios");
      }
    }
    if (u.businessProfile) {
      u.businessProfile.logoUrl = await conv(u.businessProfile.logoUrl, "negocios");
      u.businessProfile.bannerUrl = await conv(u.businessProfile.bannerUrl, "negocios");
    }
    await u.save();
  }
  console.log(`Usuarios revisados: ${usuarios.length}`);

  // --- Clubes ---
  const grupos = await Group.find({ foto: /^data:image\// });
  for (const g of grupos) {
    g.foto = await conv(g.foto, "clubes");
    await g.save();
  }
  console.log(`Clubes revisados: ${grupos.length}`);

  // --- Retos ---
  const retos = await Challenge.find({ foto: /^data:image\// });
  for (const r of retos) {
    r.foto = await conv(r.foto, "retos");
    await r.save();
  }
  console.log(`Retos revisados: ${retos.length}`);

  // --- Posteos ---
  const posts = await Post.find({ foto: /^data:image\// });
  for (const p of posts) {
    p.foto = await conv(p.foto, "posts");
    await p.save();
  }
  console.log(`Posteos revisados: ${posts.length}`);

  console.log(`\nListo. Imágenes subidas a Blob: ${subidas}`);
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error("Error en la migración:", e);
  process.exit(1);
});
