// index.js
// Улучшенный CLI-бот для Ping Network с ясным выводом баллов

import fs from 'fs';
import path from 'path';
import axios from 'axios';
import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import ora from 'ora';
import chalk from 'chalk';
import figlet from 'figlet';
import enquirer from 'enquirer';


// Определяем __dirname для ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Загружаем .env
dotenv.config({ path: path.resolve(__dirname, '.env') });

// Проверяем обязательные переменные
const USER_ID = process.env.USER_ID;
let DEVICE_ID = process.env.DEVICE_ID;

if (!USER_ID) {
  console.error(chalk.red('[ERROR]') + ' USER_ID не задан в .env');
  process.exit(1);
}
if (!DEVICE_ID) {
  DEVICE_ID = uuidv4();
  fs.appendFileSync(path.join(__dirname, '.env'), `DEVICE_ID=${DEVICE_ID}\n`);
  console.log(chalk.green('[OK]') + ` Сгенерирован DEVICE_ID: ${DEVICE_ID}`);
}

// Конфигурация
const CONFIG = {
  USER_ID,
  DEVICE_ID,
  wsUrl: `wss://ws.pingvpn.xyz/pingvpn/v1/clients/${USER_ID}/events`,
  ga: {
    url: 'https://www.google-analytics.com/mp/collect',
    measurement_id: process.env.GA_MEASUREMENT_ID,
    api_secret: process.env.GA_API_SECRET
  }
};

// Логгеры
const log = {
  info: msg    => console.log(chalk.blue(' >'), msg),
  success: msg => console.log(chalk.green(' ✓'), msg),
  warn: msg    => console.log(chalk.yellow(' !'), msg),
  error: msg   => console.log(chalk.red(' ✗'), msg),
};

// Баннер
function showBanner() {
  console.clear();
  console.log(
    chalk.cyan(
      figlet.textSync('Nod3r', { horizontalLayout: 'full' })
    )
  );
  console.log(chalk.gray('      Ping Network — TG: @Nod3r\n'));
}

// Отправка аналитики
async function sendAnalytics() {
  if (!CONFIG.ga.measurement_id || !CONFIG.ga.api_secret) {
    log.warn('Аналитика отключена в .env');
    return;
  }
  const spinner = ora('Отправка аналитики...').start();
  const url = `${CONFIG.ga.url}?measurement_id=${CONFIG.ga.measurement_id}&api_secret=${CONFIG.ga.api_secret}`;
  const payload = {
    client_id: CONFIG.DEVICE_ID,
    events: [{
      name: 'connect_clicked',
      params: {
        session_id: Date.now().toString(),
        engagement_time_msec: 100
      }
    }]
  };

  try {
    await axios.post(url, payload, { timeout: 5000 });
    spinner.succeed('Аналитика отправлена');
  } catch (err) {
    spinner.fail('Не удалось отправить аналитику');
    log.error(err.message);
  }
}

// Подключение к WS с ожиданием баллов через спиннер
function connectWebSocket() {
  let reconnectCount = 0;
  const maxReconnect = 5;
  let waitingSpinner;

  const connectSpinner = ora({ text: 'Подключение к серверу...', color: 'cyan' }).start();

  function connect() {
    const ws = new WebSocket(CONFIG.wsUrl);

    ws.on('open', () => {
      connectSpinner.succeed('WebSocket подключен');
      reconnectCount = 0;
      sendAnalytics();

      // Спиннер ожидания баллов
      waitingSpinner = ora({ text: 'Ожидаем начисления баллов…', color: 'yellow' }).start();
      keepAlive(ws);
    });

    ws.on('message', data => {
      try {
        const msg = JSON.parse(data);
        if (msg.type === 'client_points') {
          waitingSpinner.succeed(chalk.green(`Баллы: ${msg.data.amount}`));
          waitingSpinner = ora({ text: 'Ожидаем следующих начислений…', color: 'yellow' }).start();
        } else if (msg.type === 'referral_points') {
          waitingSpinner.succeed(chalk.green(`Реферальные баллы: ${msg.data.amount}`));
          waitingSpinner = ora({ text: 'Ожидаем следующих начислений…', color: 'yellow' }).start();
        }
      } catch {
        log.error('Неверный формат WS-сообщения');
      }
    });

    ws.on('close', () => {
      log.warn('Соединение закрыто');
      if (reconnectCount < maxReconnect) {
        const delay = 2000 * ++reconnectCount;
        log.info(`Переподключение через ${delay/1000}s...`);
        setTimeout(() => {
          connectSpinner.start();
          connect();
        }, delay);
      } else {
        connectSpinner.fail('Переподключение не удалось');
      }
    });

    ws.on('error', err => log.error(`WS ошибка: ${err.message}`));
  }

  connect();
}

// Пинг для поддержания «живости» без логов
function keepAlive(ws) {
  const interval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'ping' }));
    } else {
      clearInterval(interval);
    }
  }, 30000);
}

// Главное меню
async function mainMenu() {
  showBanner();
  console.log(chalk.gray(` USER_ID:   ${CONFIG.USER_ID}`));
  console.log(chalk.gray(` DEVICE_ID: ${CONFIG.DEVICE_ID}\n`));

  const { Select } = enquirer;
  const prompt = new Select({
    name: 'action',
    message: 'Меню',
    choices: [
      { name: 'start',     message: '1) Запустить бота'     },
      { name: 'analytics', message: '2) Отправить аналитику' },
      { name: 'exit',      message: '0) Выход'              }
    ],
    initial: 0
  });

  const action = await prompt.run();
  switch (action) {
    case 'start':
      connectWebSocket();
      break;
    case 'analytics':
      await sendAnalytics();
      await mainMenu();
      break;
    case 'exit':
      log.info('Выход');
      process.exit(0);
  }
}

// Запуск
mainMenu();
