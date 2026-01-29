const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database.db');

db.serialize(() => {
  // Создание таблицы продавца
  db.run(`CREATE TABLE IF NOT EXISTS seller (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    balance REAL NOT NULL DEFAULT 0,
    game_nickname TEXT NOT NULL
  )`);

  // Создание таблицы поставщиков
  db.run(`CREATE TABLE IF NOT EXISTS suppliers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    game_nickname TEXT NOT NULL,
    debt REAL NOT NULL DEFAULT 0,
    orders_count INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Создание таблицы заказов
  db.run(`CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_id INTEGER NOT NULL,
    image_url TEXT NOT NULL,
    cost REAL NOT NULL DEFAULT 0,
    premium REAL NOT NULL DEFAULT 0,
    debt_amount REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (supplier_id) REFERENCES suppliers (id) ON DELETE CASCADE
  )`);

  // Вставка начальных данных продавца
  db.run(`INSERT OR IGNORE INTO seller (id, name, balance, game_nickname) 
          VALUES (1, 'Иван Иванов', 15000, 'SellerPro')`);

  // Вставка начальных данных поставщиков
  const initialSuppliers = [
    ['ООО Поставщик 1', 'Supplier1', 0, 0],
    ['ИП Сидоров', 'SidorovIP', 0, 0],
    ['АО Доставка Быстрая', 'FastDelivery', 0, 0],
    ['ООО ТехноПоставка', 'TechSupplier', 0, 0]
  ];

  const stmt = db.prepare(`INSERT OR IGNORE INTO suppliers (name, game_nickname, debt, orders_count) 
                           VALUES (?, ?, ?, ?)`);
  
  initialSuppliers.forEach(supplier => {
    stmt.run(supplier);
  });
  
  stmt.finalize();

  // Вставка тестовых заказов
const initialOrders = [
    [1, 'https://picsum.photos/seed/order1/300/200', 5000, 300, 5000*0.5+300, 'active', 'Первый заказ'],
    [1, 'https://picsum.photos/seed/order2/300/200', 8000, 500, 8000*0.5+500, 'active', 'Второй заказ'],
    [2, 'https://picsum.photos/seed/order3/300/200', 3000, 200, 3000*0.5+200, 'completed', 'Завершенный заказ'],
    [3, 'https://picsum.photos/seed/order4/300/200', 12000, 1000, 12000*0.5+1000, 'active', 'Крупный заказ'],
    [4, 'https://picsum.photos/seed/order5/300/200', 2500, 150, 2500*0.5+150, 'active', 'Небольшой заказ']
  ];

  const orderStmt = db.prepare(`INSERT OR IGNORE INTO orders 
                               (supplier_id, image_url, cost, premium, debt_amount, status, notes) 
                               VALUES (?, ?, ?, ?, ?, ?, ?)`);
  
  initialOrders.forEach(order => {
    orderStmt.run(order);
  });
  
  orderStmt.finalize();

  // Обновляем задолженность поставщиков на основе заказов
  db.run(`UPDATE suppliers 
          SET debt = (
            SELECT COALESCE(SUM(debt_amount), 0) 
            FROM orders 
            WHERE supplier_id = suppliers.id AND status = 'active'
          )`);

  // Обновляем количество заказов
  db.run(`UPDATE suppliers 
          SET orders_count = (
            SELECT COUNT(*) 
            FROM orders 
            WHERE supplier_id = suppliers.id AND status = 'active'
          )`);

  console.log('База данных инициализирована с таблицей заказов!');
});

db.close();