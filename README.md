# 📡 Ping Network CLI Bot

[![Node.js ≥16.x](https://img.shields.io/badge/node-%3E%3D16.x-green)](https://nodejs.org/)  [![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

> CLI-бот для автоматического сбора баллов в [Ping Network](https://pingnetwork.io) (DePIN)  
> Поддерживает «живой» WebSocket-клиент, автоматические пинги и опциональную аналитику в Google Analytics.

---

## 🚀 Быстрый старт

1. **Клонировать**  
   ```bash
   git clone https://github.com/k2wGG/pingnetwork.git
   cd pingnetwork
    ````

2. **Установить зависимости**

   ```bash
   npm install
   ```

3. **Настроить `.env`**
   Создайте файл `.env` в корне:

   ```ini
   USER_ID=ваш_user_id              # обязательно
   # DEVICE_ID=                      # опционально, сгенерируется автоматически
   # GA_MEASUREMENT_ID=G-XXXXXXX     # опционально, для Google Analytics
   # GA_API_SECRET=your_api_secret  # опционально, для Google Analytics
   ```

4. **Убедиться, что `package.json` содержит**

   ```jsonc
   {
     "type": "module",
     "scripts": {
       "start": "node index.js"
     }
   }
   ```

5. **Запустить**

   ```bash
   npm start
   ```

---

## ⚙️ Конфигурация

| Переменная          | Описание                                                         |
| ------------------- | ---------------------------------------------------------------- |
| `USER_ID`           | Ваш уникальный идентификатор в Ping Network (обязательно).       |
| `DEVICE_ID`         | Уникальный ID узла. При отсутствии — генерируется автоматически. |
| `GA_MEASUREMENT_ID` | Measurement ID Google Analytics (опционально).                   |
| `GA_API_SECRET`     | API Secret Google Analytics (опционально).                       |

---

## 🧩 Использование

После запуска вы увидите ASCII-баннер и меню:

```text
🔹 1) Запустить бота
🔹 2) Отправить аналитику
🔹 0) Выход
```

* **Запустить бота**

  * Устанавливает WebSocket-соединение
  * Шлёт «ping» каждые 30 сек
  * Отображает обновления баллов (`client_points` и `referral_points`)

* **Отправить аналитику**

  * Принудительно шлёт событие `connect_clicked`
  * Работает только если настроены `GA_MEASUREMENT_ID` и `GA_API_SECRET`

* **Выход**

  * Завершает работу CLI

---

## 🛠️ Возможные доработки

* **Логирование в файл** — сохраняя все сообщения WebSocket
* **Docker**:

  ```dockerfile
  FROM node:18-alpine
  WORKDIR /app
  COPY package*.json ./
  RUN npm ci
  COPY . .
  CMD ["npm", "start"]
  ```
* **CI/CD** — GitHub Actions для линтинга и тестирования

---

## 🙏 Благодарности

* [Ping Network](https://pingnetwork.io) — децентрализованная DePIN-платформа
* [enquirer](https://github.com/enquirer/enquirer) — для современного CLI
* [chalk](https://github.com/chalk/chalk), [ora](https://github.com/sindresorhus/ora), [figlet](https://github.com/patorjk/figlet.js) — за удобные инструменты визуализации в консоли

---

## 📄 Лицензия

MIT © [k2wGG](https://github.com/k2wGG/pingnetwork/blob/main/LICENSE)
