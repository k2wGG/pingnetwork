// index.js
// CLI-бот для Ping Network с баннером, меню и мгновенным тик-выводом баллов (через WebSocket)

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
import UserAgent from 'user-agents';

// ESM __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// load .env
dotenv.config({ path: path.resolve(__dirname, '.env') });

// USER_ID & DEVICE_ID
const USER_ID   = process.env.USER_ID;
let   DEVICE_ID = process.env.DEVICE_ID;

if (!USER_ID) {
  console.error(chalk.red('[ERROR]') + ' USER_ID не задан в .env');
  process.exit(1);
}
if (!DEVICE_ID) {
  DEVICE_ID = uuidv4();
  fs.appendFileSync(path.join(__dirname, '.env'), `DEVICE_ID=${DEVICE_ID}\n`);
  console.log(chalk.green('[OK]') + ` Сгенерирован DEVICE_ID: ${DEVICE_ID}`);
}

// prepare User-Agent
const ua = new UserAgent({ deviceCategory: 'desktop' });
const UA_STRING = ua.toString();

// WS и HTTP headers
const WS_HEADERS = {
  'user-agent': UA_STRING,
  'accept-language': 'en-US,en;q=0.9'
};

// GA headers (if used)
const HTTP_HEADERS = {
  'user-agent': UA_STRING,
  'accept': '*/*',
  'content-type': 'text/plain;charset=UTF-8',
  'accept-language': 'en-US,en;q=0.9',
  'sec-ch-ua': ua.data.userAgent,
  'sec-ch-ua-mobile': ua.data.isMobile ? '?1':'?0',
  'sec-ch-ua-platform': `"${ua.data.platform}"`
};

// config
const CONFIG = {
  USER_ID,
  DEVICE_ID,
  wsUrl: `wss://ws.pingvpn.xyz/pingvpn/v1/clients/${USER_ID}/events`,
  ga: {
    measurement_id: process.env.GA_MEASUREMENT_ID,
    api_secret:     process.env.GA_API_SECRET
  }
};

// colored logs
const log = {
  info:    msg => console.log(chalk.blue(' >'), msg),
  success: msg => console.log(chalk.green(' ✓'), msg),
  warn:    msg => console.log(chalk.yellow(' !'), msg),
  error:   msg => console.log(chalk.red(' ✗'), msg),
};

// banner
function showBanner() {
  console.clear();
  console.log(
    chalk.cyan(figlet.textSync('Nod3r', { horizontalLayout: 'full' }))
  );
  console.log(chalk.gray('      Ping Network — TG: @Nod3r\n'));
}

// send analytics
async function sendAnalytics() {
  if (!CONFIG.ga.measurement_id || !CONFIG.ga.api_secret) {
    log.warn('Аналитика отключена в .env');
    return;
  }
  const spinner = ora('Отправка аналитики…').start();
  const url = `https://www.google-analytics.com/mp/collect?measurement_id=${CONFIG.ga.measurement_id}&api_secret=${CONFIG.ga.api_secret}`;
  const payload = {
    client_id: CONFIG.DEVICE_ID,
    events: [{
      name: 'connect_clicked',
      params: { session_id: Date.now().toString(), engagement_time_msec: 100 }
    }]
  };
  try {
    await axios.post(url, payload, { headers: HTTP_HEADERS, timeout: 5000 });
    spinner.succeed('Аналитика отправлена');
  } catch (err) {
    spinner.fail('Не удалось отправить аналитику');
    log.error(err.message);
  }
}

// connect WS and output points
function connectWebSocket() {
  let reconnectCount = 0;
  const maxReconnect = 5;
  const spinner = ora({ text: 'Подключение к серверу...', color: 'cyan' }).start();

  // we'll use this spinner for both initial wait and subsequent ticks
  let pointsSpinner;

  function connect() {
    const ws = new WebSocket(CONFIG.wsUrl, { headers: WS_HEADERS });

    ws.on('open', () => {
      spinner.succeed('WebSocket подключен');
      reconnectCount = 0;

      // analytics if configured
      sendAnalytics();

      // start waiting spinner
      pointsSpinner = ora({ text: 'Ожидаем первого обновления баллов…', color: 'yellow' }).start();
    });

    ws.on('message', data => {
      try {
        const msg = JSON.parse(data);
        if (msg.type === 'client_points') {
          pointsSpinner.succeed(`Баллы: ${Number(msg.data.amount).toFixed(2)}`);
          // restart spinner for next update
          pointsSpinner = ora({ text: 'Ожидаем следующих начислений…', color: 'yellow' }).start();
        }
        if (msg.type === 'referral_points') {
          pointsSpinner.succeed(`Реферальные баллы: ${Number(msg.data.amount).toFixed(2)}`);
          pointsSpinner = ora({ text: 'Ожидаем следующих начислений…', color: 'yellow' }).start();
        }
      } catch {
        log.error('Ошибка парсинга WS-сообщения');
      }
    });

    ws.on('close', () => {
      log.warn('Соединение закрыто');
      if (reconnectCount < maxReconnect) {
        const delay = 2_000 * ++reconnectCount;
        log.info(`Переподключение через ${delay/1000}s…`);
        setTimeout(connect, delay);
      } else {
        spinner.fail('Не удалось переподключиться');
      }
    });

    ws.on('error', err => log.error(`WS ошибка: ${err.message}`));

    // heartbeat without logs
    const iv = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type:'ping' }));
      else clearInterval(iv);
    }, 30_000);
  }

  connect();
}

// main menu
async function mainMenu() {
  showBanner();
  console.log(chalk.gray(` USER_ID:   ${CONFIG.USER_ID}`));
  console.log(chalk.gray(` DEVICE_ID: ${CONFIG.DEVICE_ID}\n`));

  const { Select } = enquirer;
  const prompt = new Select({
    name:    'action',
    message: 'Выберите действие:',
    choices: [
      { name:'start',     message:'1) Запустить бота'     },
      { name:'analytics', message:'2) Отправить аналитику' },
      { name:'exit',      message:'0) Выход'              }
    ],
    initial: 0
  });

  const action = await prompt.run();
  if (action === 'start') {
    connectWebSocket();
  } else if (action === 'analytics') {
    await sendAnalytics();
    await mainMenu();
  } else {
    log.info('Выход');
    process.exit(0);
  }
}

// start
mainMenu();
