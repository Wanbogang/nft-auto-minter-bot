// soundness.js
import { execSync } from "node:child_process";

/**
 * Jalankan precheck dengan Soundness CLI.
 * Untuk awal, kita cuma pastikan key "gusjenggot" terdaftar.
 */
export function soundnessPrecheck() {
  try {
    const out = execSync("soundness-cli list-keys", {
      stdio: ["ignore", "pipe", "pipe"],
    })
      .toString()
      .trim();

    if (out.includes("gusjenggot")) {
      console.log("✅ Soundness precheck OK (key gusjenggot ditemukan).");
      return true;
    } else {
      console.error("❌ Key gusjenggot tidak ditemukan di Soundness CLI.");
      return false;
    }
  } catch (e) {
    console.error("❌ Gagal menjalankan soundness-cli:", e.message);
    return false;
  }
}
