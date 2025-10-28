const crypto = require("crypto");

// Проверка подписи Telegram Login Widget
function checkTelegramAuth(query, botToken) {
  // query - это объект с параметрами URL, например req.query
  // botToken - твой токен бота (строка)

  const receivedHash = query.hash;
  if (!receivedHash) return false;

  // Скопируем объект без hash
  const data = { ...query };
  delete data.hash;

  // 1. Сортируем ключи по алфавиту
  const keys = Object.keys(data).sort();

  // 2. Собираем data_check_string: "key=value\nkey=value..."
  const dataCheckString = keys
    .map((key) => `${key}=${data[key]}`)
    .join("\n");

  // 3. Секрет = SHA256(bot_token), бинарно
  const secretKey = crypto
    .createHash("sha256")
    .update(botToken)
    .digest();

  // 4. HMAC_SHA256(data_check_string, secretKey) в hex
  const hmac = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  // 5. Сравниваем
  return hmac === receivedHash;
}

module.exports = (req, res) => {
  try {
    const botToken = process.env.BOT_TOKEN;
    if (!botToken) {
      res.status(500).send("Server is not configured: BOT_TOKEN missing.");
      return;
    }

    const ok = checkTelegramAuth(req.query, botToken);

    // Для наглядности будем отвечать простой HTML-страницей
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(200).send(`
      <html>
        <body style="font-family: sans-serif; line-height:1.4; padding:1rem;">
          <h2>Telegram auth callback</h2>
          <p>auth ok: <b>${ok}</b></p>
          <p>query data:</p>
          <pre>${escapeHtml(JSON.stringify(req.query, null, 2))}</pre>
        </body>
      </html>
    `);
  } catch (err) {
    res.status(500).send("Error: " + err.toString());
  }
};

// маленькая утилита, чтобы не сломать HTML, когда печатаем JSON
function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
