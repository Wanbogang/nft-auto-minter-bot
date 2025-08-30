import fs from "fs";
const LOG_FILE = "./logs/tx-log.json";

export function logTx(entry) {
  const time = new Date().toISOString();
  const newEntry = { time, ...entry };
  let data = [];
  if (fs.existsSync(LOG_FILE)) {
    try {
      data = JSON.parse(fs.readFileSync(LOG_FILE));
    } catch {
      data = [];
    }
  }
  data.push(newEntry);
  fs.writeFileSync(LOG_FILE, JSON.stringify(data, null, 2));
  console.log("📝 TX log updated:", newEntry);
}
