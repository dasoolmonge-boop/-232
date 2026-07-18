// app.js - Сервер для мини-приложения цветочного магазина
const http = require('http');
const fs = require('fs');
const path = require('path');
const https = require('https');
const url = require('url');

const PORT = process.env.PORT || 3000;
const BOT_TOKEN = "8881307450:AAEbuDvFHtHiPnbasu8nbkF2VB1I-Sk3zNk"; // Токен для цветочного магазина

// MIME типы для статических файлов
const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

// Файл для хранения данных
const DB_FILE = path.join(__dirname, 'db.json');
// Папка для загруженных изображений
const UPLOAD_DIR = path.join(__dirname, 'public', 'uploads');

// Создаем папку для загрузок, если её нет
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    console.log('✅ Папка для загрузок создана');
}

// Начальные данные для БД
const getInitialData = () => ({
    bouquets: [
        {
            id: 1,
            name: 'Нежность',
            price: 3500,
            description: 'Нежные розовые пионы с эвкалиптом',
            photo: 'https://images.unsplash.com/photo-1582794543139-8ac9cb0f7b11?w=400',
            available: true,
            composition: 'Пионы, эвкалипт, гипсофила',
            size: 'Средний (40 см)'
        },
        {
            id: 2,
            name: 'Красный вечер',
            price: 4200,
            description: 'Страстные красные розы в элегантной упаковке',
            photo: 'https://images.unsplash.com/photo-1548092372-0d1bd40894a3?w=400',
            available: true,
            composition: 'Розы красные (15 шт), флористическая сетка',
            size: 'Большой (50 см)'
        },
        {
            id: 3,
            name: 'Солнечное настроение',
            price: 2800,
            description: 'Яркие подсолнухи и герберы',
            photo: 'https://images.unsplash.com/photo-1535468850893-d6a71e1c2e4c?w=400',
            available: true,
            composition: 'Подсолнухи, герберы, зелень',
            size: 'Средний (35 см)'
        },
        {
            id: 4,
            name: 'Лавандовый рай',
            price: 3900,
            description: 'Нежная лаванда в композиции с розами',
            photo: 'https://images.unsplash.com/photo-1468327768560-75b778c92b9c?w=400',
            available: true,
            composition: 'Лаванда, розы кустовые, эвкалипт',
            size: 'Средний (40 см)'
        }
    ],
    orders: [],
    admins: [1066867845],
    couriers: [],
    nextBouquetId: 5,
    nextOrderId: 1
});

// Глобальная переменная для базы данных (In-Memory Fallback)
let memoryDB = null;

// Инициализация базы данных
function initDB() {
    try {
        if (!fs.existsSync(DB_FILE)) {
            const initialData = getInitialData();
            fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2));
            console.log('✅ База данных создана с начальными данными');
            return;
        }

        const stats = fs.statSync(DB_FILE);
        if (stats.size === 0) {
            console.log('⚠️ Файл базы данных пустой, создаю новый...');
            const initialData = getInitialData();
            fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2));
            console.log('✅ База данных восстановлена');
            return;
        }

        const content = fs.readFileSync(DB_FILE, 'utf8');
        JSON.parse(content);
        console.log('✅ База данных загружена');

    } catch (error) {
        console.error('❌ Ошибка при инициализации БД (возможно, файловая система только для чтения):', error.message);
        console.log('🔄 Переход в режим In-Memory (БД в оперативной памяти)');
        memoryDB = getInitialData();
    }
}

// Чтение данных из БД с защитой от ошибок
function readDB() {
    if (memoryDB) return JSON.parse(JSON.stringify(memoryDB));

    try {
        if (!fs.existsSync(DB_FILE)) {
            console.log('⚠️ Файл БД не найден, создаю новый...');
            const initialData = getInitialData();
            try { fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2)); } catch(e){}
            return initialData;
        }

        const stats = fs.statSync(DB_FILE);
        if (stats.size === 0) {
            console.log('⚠️ Файл БД пустой, создаю новый...');
            const initialData = getInitialData();
            try { fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2)); } catch(e){}
            return initialData;
        }

        const content = fs.readFileSync(DB_FILE, 'utf8');
        const db = JSON.parse(content);
        if (!db.bouquets) db.bouquets = [];
        if (!db.orders) db.orders = [];
        if (!db.admins) db.admins = [1066867845];
        if (!db.couriers) db.couriers = [];
        if (!db.nextBouquetId) db.nextBouquetId = 1;
        if (!db.nextOrderId) db.nextOrderId = 1;
        return db;

    } catch (error) {
        console.error('❌ Ошибка чтения БД:', error.message);
        const defaultData = getInitialData();
        try { fs.writeFileSync(DB_FILE, JSON.stringify(defaultData, null, 2)); } catch (e) {}
        return defaultData;
    }
}

// Запись данных в БД с проверкой
function writeDB(data) {
    if (memoryDB !== null) {
        memoryDB = JSON.parse(JSON.stringify(data));
        return true;
    }

    try {
        const tempFile = `${DB_FILE}.tmp`;
        fs.writeFileSync(tempFile, JSON.stringify(data, null, 2));

        const verification = fs.readFileSync(tempFile, 'utf8');
        JSON.parse(verification);

        fs.renameSync(tempFile, DB_FILE);
        return true;
    } catch (error) {
        console.error('❌ Ошибка записи БД:', error.message);
        try {
            if (fs.existsSync(`${DB_FILE}.tmp`)) {
                fs.unlinkSync(`${DB_FILE}.tmp`);
            }
        } catch (e) {}
        
        memoryDB = JSON.parse(JSON.stringify(data));
        console.log('🔄 Аварийный переход в режим In-Memory');
        return true;
    }
}

// Инициализируем БД при старте
initDB();

const server = http.createServer((req, res) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);

    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;

    // ============================================
    // API ДЛЯ ЗАГРУЗКИ ФОТО
    // ============================================

    if (pathname === '/api/upload' && req.method === 'POST') {
        try {
            const contentType = req.headers['content-type'] || '';
            const boundaryMatch = contentType.split('boundary=');
            if (boundaryMatch.length < 2) {
                res.writeHead(400);
                res.end(JSON.stringify({ error: 'Missing boundary' }));
                return;
            }
            const boundary = boundaryMatch[1];
            let body = [];

            req.on('data', chunk => {
                body.push(chunk);
            }).on('end', () => {
                try {
                    const buffer = Buffer.concat(body);

                    // Ищем имя файла
                    const text = buffer.toString('binary');
                    const filenameMatch = text.match(/filename="(.+?)"/);
                    const filename = filenameMatch ? filenameMatch[1] : `photo_${Date.now()}.jpg`;

                    // Ищем содержимое файла
                    const fileDataStart = buffer.indexOf('\r\n\r\n') + 4;
                    const fileDataEnd = buffer.lastIndexOf('\r\n--' + boundary);

                    if (fileDataStart !== -1 && fileDataEnd !== -1 && fileDataStart < fileDataEnd) {
                        const fileData = buffer.slice(fileDataStart, fileDataEnd);

                        // Генерируем уникальное имя файла
                        const ext = path.extname(filename) || '.jpg';
                        const newFilename = `flower_${Date.now()}${ext}`;
                        const filePath = path.join(UPLOAD_DIR, newFilename);

                        // Сохраняем файл
                        fs.writeFileSync(filePath, fileData);

                        const fileUrl = `/uploads/${newFilename}`;

                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            success: true,
                            url: fileUrl,
                            filename: newFilename
                        }));
                    } else {
                        throw new Error('Не удалось извлечь данные файла (неверный формат)');
                    }
                } catch (error) {
                    console.error('❌ Ошибка обработки файла:', error);
                    res.writeHead(500);
                    res.end(JSON.stringify({ error: 'Ошибка загрузки файла' }));
                }
            });
        } catch (error) {
            console.error('❌ Ошибка /api/upload:', error);
            res.writeHead(500);
            res.end(JSON.stringify({ error: 'Внутренняя ошибка сервера' }));
        }
        return;
    }

    // ============================================
    // API ДЛЯ БУКЕТОВ
    // ============================================

    // Получить все доступные букеты (для клиентов)
    if (pathname === '/api/bouquets' && req.method === 'GET') {
        const db = readDB();
        const availableBouquets = db.bouquets.filter(b => b.available);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(availableBouquets));
        return;
    }

    // Получить все букеты (для админа)
    if (pathname === '/api/admin/bouquets' && req.method === 'GET') {
        const db = readDB();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(db.bouquets));
        return;
    }

    // Получить конкретный букет
    if (pathname.startsWith('/api/bouquets/') && req.method === 'GET') {
        const bouquetId = parseInt(pathname.split('/').pop());
        const db = readDB();
        const bouquet = db.bouquets.find(b => b.id === bouquetId);

        if (bouquet) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(bouquet));
        } else {
            res.writeHead(404);
            res.end(JSON.stringify({ error: 'Букет не найден' }));
        }
        return;
    }

    // Добавить новый букет (админ)
    if (pathname === '/api/admin/bouquets' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const bouquetData = JSON.parse(body);
                const db = readDB();

                const newBouquet = {
                    id: db.nextBouquetId++,
                    ...bouquetData,
                    available: true
                };

                db.bouquets.push(newBouquet);

                if (writeDB(db)) {
                    res.writeHead(201, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(newBouquet));
                } else {
                    throw new Error('Ошибка сохранения');
                }
            } catch (error) {
                console.error('❌ Ошибка добавления букета:', error);
                res.writeHead(500);
                res.end(JSON.stringify({ error: 'Ошибка сервера' }));
            }
        });
        return;
    }

    // Обновить букет (админ)
    if (pathname.startsWith('/api/admin/bouquets/') && req.method === 'PUT') {
        const bouquetId = parseInt(pathname.split('/').pop());
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const updates = JSON.parse(body);
                const db = readDB();

                const bouquetIndex = db.bouquets.findIndex(b => b.id === bouquetId);
                if (bouquetIndex === -1) {
                    res.writeHead(404);
                    res.end(JSON.stringify({ error: 'Букет не найден' }));
                    return;
                }

                db.bouquets[bouquetIndex] = { ...db.bouquets[bouquetIndex], ...updates };

                if (writeDB(db)) {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(db.bouquets[bouquetIndex]));
                } else {
                    throw new Error('Ошибка сохранения');
                }
            } catch (error) {
                console.error('❌ Ошибка обновления букета:', error);
                res.writeHead(500);
                res.end(JSON.stringify({ error: 'Ошибка сервера' }));
            }
        });
        return;
    }

    // Удалить букет (админ)
    if (pathname.startsWith('/api/admin/bouquets/') && req.method === 'DELETE') {
        const bouquetId = parseInt(pathname.split('/').pop());
        const db = readDB();

        // Удаляем фото букета
        const bouquet = db.bouquets.find(b => b.id === bouquetId);
        if (bouquet && bouquet.photo && bouquet.photo.startsWith('/uploads/')) {
            const photoPath = path.join(__dirname, 'public', bouquet.photo);
            if (fs.existsSync(photoPath)) {
                fs.unlinkSync(photoPath);
                console.log(`📸 Удалено фото: ${bouquet.photo}`);
            }
        }

        db.bouquets = db.bouquets.filter(b => b.id !== bouquetId);

        if (writeDB(db)) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));
        } else {
            res.writeHead(500);
            res.end(JSON.stringify({ error: 'Ошибка сохранения' }));
        }
        return;
    }

    // ============================================
    // API ДЛЯ ЗАКАЗОВ
    // ============================================

    // Создать заказ
    if (pathname === '/api/orders' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const orderData = JSON.parse(body);
                const db = readDB();

                // Помечаем каждый букет в заказе как недоступный
                if (orderData.cart && orderData.cart.length > 0) {
                    orderData.cart.forEach(item => {
                        const bouquetIndex = db.bouquets.findIndex(b => b.id === item.id);
                        if (bouquetIndex !== -1) {
                            db.bouquets[bouquetIndex].available = false;
                            console.log(`💐 Букет "${db.bouquets[bouquetIndex].name}" скрыт из каталога`);
                        }
                    });
                }

                const newOrder = {
                    id: db.nextOrderId++,
                    ...orderData,
                    status: 'active',
                    createdAt: new Date().toISOString()
                };

                db.orders.push(newOrder);

                if (writeDB(db)) {
                    // Отправляем уведомление админам в Telegram
                    sendOrderToAdmins(newOrder, db.admins);

                    res.writeHead(201, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: true,
                        orderId: newOrder.id,
                        message: 'Букеты скрыты из каталога'
                    }));
                } else {
                    throw new Error('Ошибка сохранения');
                }
            } catch (error) {
                console.error('❌ Ошибка создания заказа:', error);
                res.writeHead(500);
                res.end(JSON.stringify({ error: 'Ошибка сервера' }));
            }
        });
        return;
    }

    // Получить все заказы (админ)
    if (pathname === '/api/admin/orders' && req.method === 'GET') {
        const db = readDB();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(db.orders));
        return;
    }

    // Получить активные заказы (админ)
    if (pathname === '/api/admin/orders/active' && req.method === 'GET') {
        const db = readDB();
        const activeOrders = db.orders.filter(o => o.status === 'active' || o.status === 'processing');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(activeOrders));
        return;
    }

    // Получить историю заказов (админ)
    if (pathname === '/api/admin/orders/history' && req.method === 'GET') {
        const db = readDB();
        const historyOrders = db.orders.filter(o => o.status === 'completed' || o.status === 'cancelled');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(historyOrders));
        return;
    }

    // Обновить статус заказа (админ)
    if (pathname.startsWith('/api/admin/orders/') && req.method === 'PUT') {
        const orderId = parseInt(pathname.split('/').pop());
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const updates = JSON.parse(body);
                const db = readDB();

                const orderIndex = db.orders.findIndex(o => o.id === orderId);
                if (orderIndex === -1) {
                    res.writeHead(404);
                    res.end(JSON.stringify({ error: 'Заказ не найден' }));
                    return;
                }

                // Если заказ отменяют, возвращаем букеты в доступные
                if (updates.status === 'cancelled') {
                    const order = db.orders[orderIndex];
                    if (order.cart) {
                        order.cart.forEach(item => {
                            const bouquetIndex = db.bouquets.findIndex(b => b.id === item.id);
                            if (bouquetIndex !== -1) {
                                db.bouquets[bouquetIndex].available = true;
                                console.log(`💐 Букет "${db.bouquets[bouquetIndex].name}" восстановлен в каталоге`);
                            }
                        });
                    }
                }

                const oldStatus = db.orders[orderIndex].status;
                db.orders[orderIndex] = { ...db.orders[orderIndex], ...updates };

                if (writeDB(db)) {
                    if (oldStatus !== 'processing' && updates.status === 'processing') {
                        sendOrderToCouriers(db.orders[orderIndex], db.couriers);
                    }
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(db.orders[orderIndex]));
                } else {
                    throw new Error('Ошибка сохранения');
                }
            } catch (error) {
                console.error('❌ Ошибка обновления заказа:', error);
                res.writeHead(500);
                res.end(JSON.stringify({ error: 'Ошибка сервера' }));
            }
        });
        return;
    }

    // Проверка прав администратора
    if (pathname === '/api/check-admin' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const { userId } = JSON.parse(body);
                const db = readDB();
                const isAdminUser = db.admins.includes(parseInt(userId));
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ isAdmin: isAdminUser }));
            } catch (error) {
                res.writeHead(400);
                res.end(JSON.stringify({ error: 'Invalid JSON' }));
            }
        });
        return;
    }

    // ============================================
    // API ДЛЯ РОЛЕЙ (Сотрудников)
    // ============================================

    // Получить списки сотрудников
    if (pathname === '/api/admin/roles' && req.method === 'GET') {
        const db = readDB();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            admins: db.admins || [],
            couriers: db.couriers || []
        }));
        return;
    }

    // Добавить сотрудника
    if (pathname === '/api/admin/roles' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const { type, id } = JSON.parse(body); // type = 'admins' | 'couriers'
                const db = readDB();
                const numId = parseInt(id);

                if ((type === 'admins' || type === 'couriers') && numId && !isNaN(numId)) {
                    if (!db[type].includes(numId)) {
                        db[type].push(numId);
                        writeDB(db);
                    }
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, [type]: db[type] }));
                } else {
                    res.writeHead(400);
                    res.end(JSON.stringify({ error: 'Invalid data' }));
                }
            } catch (error) {
                res.writeHead(500);
                res.end(JSON.stringify({ error: 'Server error' }));
            }
        });
        return;
    }

    // Удалить сотрудника
    if (pathname.startsWith('/api/admin/roles/') && req.method === 'DELETE') {
        const parts = pathname.split('/');
        const type = parts[4]; // admins or couriers
        const id = parseInt(parts[5]);

        if (type === 'admins' || type === 'couriers') {
            const db = readDB();
            db[type] = db[type].filter(userId => userId !== id);
            writeDB(db);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, [type]: db[type] }));
        } else {
            res.writeHead(400);
            res.end(JSON.stringify({ error: 'Invalid type' }));
        }
        return;
    }


    // ============================================
    // РАЗДАЧА СТАТИЧЕСКИХ ФАЙЛОВ
    // ============================================

    // Определяем, какой файл отдавать
    let filePath;
    if (pathname === '/') {
        filePath = path.join(__dirname, 'public', 'index.html');
    } else if (pathname === '/admin') {
        filePath = path.join(__dirname, 'public', 'admin.html');
    } else {
        filePath = path.join(__dirname, 'public', pathname);
    }

    const extname = path.extname(filePath);
    const contentType = mimeTypes[extname] || 'text/plain';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                // Если файл не найден, отдаем index.html
                fs.readFile(path.join(__dirname, 'public', 'index.html'), (err, content) => {
                    if (err) {
                        res.writeHead(404);
                        res.end('Файл не найден');
                    } else {
                        res.writeHead(200, { 'Content-Type': 'text/html' });
                        res.end(content, 'utf-8');
                    }
                });
            } else {
                res.writeHead(500);
                res.end(`Ошибка сервера: ${error.code}`);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

// Функция отправки уведомления админам
function sendOrderToAdmins(orderData, admins) {
    if (!admins || admins.length === 0) return;

    const { name, phone, address, deliveryDate, deliveryTime, wish, cart, totalPrice, userId, username } = orderData;

    const bouquetsList = cart.map(item =>
        `💐 ${item.name} - ${(item.price - (item.discount || 0))} ₽`
    ).join('\n');

    const protocol = 'https';
    const host = 'monge.bothost.tech.ru'; // Домен
    const adminLink = `${protocol}://${host}/admin`;

    const message =
        `📩 **НОВЫЙ ЗАКАЗ ЦВЕТОВ**\n\n` +
        `💐 **Букеты:**\n${bouquetsList}\n` +
        `💰 **Итого:** ${totalPrice} ₽\n\n` +
        `👤 **Имя:** ${name}\n` +
        `📱 **Телефон:** ${phone}\n` +
        `📍 **Адрес:** ${address}\n` +
        `📅 **Дата доставки:** ${deliveryDate}\n` +
        `⏰ **Время доставки:** ${deliveryTime}\n` +
        `📝 **Пожелания:** ${wish || 'Без пожеланий'}\n` +
        `👑 **Админка:** ${adminLink}`;

    admins.forEach(adminId => {
        sendTelegramMessage(adminId, message);
    });
}

// Функция отправки уведомления курьерам
function sendOrderToCouriers(orderData, couriers) {
    if (!couriers || couriers.length === 0) return;

    const { name, phone, address, deliveryDate, deliveryTime, wish, cart, totalPrice } = orderData;
    
    const bouquetsList = cart.map(item => `💐 ${item.name}`).join('\n');

    const message =
        `🚚 **ЗАКАЗ ПЕРЕДАН В ДОСТАВКУ (Заказ #${orderData.id})**\n\n` +
        `💐 **Букеты:**\n${bouquetsList}\n\n` +
        `💰 **К оплате курьеру:** ${totalPrice} ₽\n` +
        `👤 **Имя клиента:** ${name}\n` +
        `📱 **Телефон:** ${phone}\n` +
        `📍 **Адрес:** ${address}\n` +
        `📅 **Дата:** ${deliveryDate}\n` +
        `⏰ **Время:** ${deliveryTime}\n` +
        `📝 **Комментарий:** ${wish || 'Нет'}`;

    couriers.forEach(courierId => {
        sendTelegramMessage(courierId, message);
    });
}

function sendTelegramMessage(chatId, text) {
    const postData = JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'Markdown'
    });

    const options = {
        hostname: 'api.telegram.org',
        path: `/bot${BOT_TOKEN}/sendMessage`,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
        }
    };

    const req = https.request(options, (apiRes) => {
        apiRes.on('data', () => {});
    });
    req.on('error', (e) => console.error(e));
    req.write(postData);
    req.end();
}

server.listen(PORT, '0.0.0.0', () => {
    console.log('\n' + '='.repeat(50));
    console.log('✅ Flower Mini App сервер запущен');
    console.log('='.repeat(50));
    console.log(`📱 Порт: ${PORT}`);
    console.log(`🌐 Домен: monge.bothost.tech.ru`);
    console.log(`👑 Админ панель: https://monge.bothost.tech.ru/admin`);
    console.log(`💾 База данных: ${DB_FILE}`);
    console.log(`📸 Папка загрузок: ${UPLOAD_DIR}`);
    console.log(`🔑 Токен бота: ${BOT_TOKEN.substring(0, 10)}...`);
    console.log('='.repeat(50));
});