# === Настройки ===
$token   = "8224160873:AAHRX9hzH_6Kj4OMuVdbpB8aVja-B5Z_OZE"   # ← твой Bot API токен
$chat_id = "617105920"                                        # ← твой chat_id (число без кавычек тоже можно)
$url     = "https://howobot.vercel.app/"             # ← адрес твоего мини-аппа

# === Формируем тело JSON ===
$body = @{
    chat_id = $chat_id
    text    = "Test Mini App"
    reply_markup = @{
        inline_keyboard = @(
            ,(@(
                @{
                    text = "Open Mini App"
                    web_app = @{ url = $url }
                }
            ))
        )
    }
} | ConvertTo-Json -Depth 6

# === Конвертируем JSON в UTF-8 байты ===
$utf8Body = [System.Text.Encoding]::UTF8.GetBytes($body)

# === Отправляем ===
Invoke-RestMethod -Uri "https://api.telegram.org/bot$token/sendMessage" `
    -Method Post `
    -ContentType "application/json; charset=utf-8" `
    -Body $utf8Body
