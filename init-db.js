const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database.db');

db.serialize(() => {
  // Удаляем существующие таблицы если они есть
  db.run(`DROP TABLE IF EXISTS orders`);
  db.run(`DROP TABLE IF EXISTS suppliers`);
  db.run(`DROP TABLE IF EXISTS seller`);

  // Создание таблицы продавца
  db.run(`CREATE TABLE seller (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    balance REAL NOT NULL DEFAULT 0,
    game_nickname TEXT NOT NULL
  )`);

  // Создание таблицы поставщиков
  db.run(`CREATE TABLE suppliers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    game_nickname TEXT NOT NULL,
    debt REAL NOT NULL DEFAULT 0,
    orders_count INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Создание таблицы заказов (с полями для разделения)
  db.run(`CREATE TABLE orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_id INTEGER NOT NULL,
    image_url TEXT NOT NULL,
    cost REAL NOT NULL DEFAULT 0,
    premium REAL NOT NULL DEFAULT 0,
    debt_amount REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    notes TEXT,
    is_split BOOLEAN DEFAULT 0,
    split_with TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (supplier_id) REFERENCES suppliers (id) ON DELETE CASCADE
  )`);

  // Вставка начальных данных продавца
  db.run(`INSERT INTO seller (id, name, balance, game_nickname) 
          VALUES (1, 'Иван Иванов', 15000, 'SellerPro')`);

  // Вставка начальных данных поставщиков
  const initialSuppliers = [
    ['ООО Поставщик 1', 'Supplier1', 0, 0],
    ['ИП Сидоров', 'SidorovIP', 0, 0],
    ['АО Доставка Быстрая', 'FastDelivery', 0, 0],
    ['ООО ТехноПоставка', 'TechSupplier', 0, 0]
  ];

  const stmt = db.prepare(`INSERT INTO suppliers (name, game_nickname, debt, orders_count) 
                           VALUES (?, ?, ?, ?)`);
  
  initialSuppliers.forEach(supplier => {
    stmt.run(supplier);
  });
  
  stmt.finalize();

  // Вставка тестовых заказов (ИСПРАВЛЕНО: правильный расчет для разделенных заказов)
  const initialOrders = [
    [1, 'https://picsum.photos/seed/order1/300/200', 5000, 300, 5000 - (5000 * 0.3) - 300, 'active', 'Первый заказ', 0, null, '2024-01-15 10:30:00'],
    [1, 'https://picsum.photos/seed/order2/300/200', 8000, 500, 8000 - (8000 * 0.3) - 500, 'active', 'Второй заказ', 0, null, '2024-01-16 14:45:00'],
    [2, 'https://picsum.photos/seed/order3/300/200', 3000, 200, 3000 - (3000 * 0.3) - 200, 'completed', 'Завершенный заказ', 0, null, '2024-01-10 09:15:00'],
    // ИСПРАВЛЕНО: Для разделенных заказов debt_amount = (стоимость/2) - (премиум/2)
    [3, 'https://picsum.photos/seed/order4/300/200', 159, 25, (159/2) - (25/2), 'active', 'Разделенный заказ (пример расчета)', 1, 'ВторойПродавец', '2024-01-12 11:20:00'],
    [3, 'https://picsum.photos/seed/order4/300/200', 159, 25, (159/2) - (25/2), 'active', 'Разделенный заказ (вторая половина)', 1, 'ВторойПродавец', '2024-01-12 11:20:00'],
    [4, 'https://picsum.photos/seed/order5/300/200', 2500, 150, 2500 - (2500 * 0.3) - 150, 'active', 'Небольшой заказ', 0, null, '2024-01-14 16:30:00']
  ];

  const orderStmt = db.prepare(`INSERT INTO orders 
                               (supplier_id, image_url, cost, premium, debt_amount, status, notes, is_split, split_with, created_at) 
                               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  
  initialOrders.forEach(order => {
    orderStmt.run(order);
  });
  
  orderStmt.finalize();

  // Правильно обновляем задолженность поставщиков на основе заказов
  db.run(`UPDATE suppliers 
          SET debt = (
            SELECT COALESCE(SUM(debt_amount), 0) 
            FROM orders 
            WHERE supplier_id = suppliers.id AND status = 'active'
          ),
          orders_count = (
            SELECT COUNT(*) 
            FROM orders 
            WHERE supplier_id = suppliers.id AND status = 'active'
          )`);

  console.log('База данных инициализирована с таблицей заказов!');
  console.log('Пример расчета для разделенного заказа:');
  console.log('Стоимость: 159, Премиум: 25');
  console.log('Расчет: (159/2) - (25/2) = 79.5 - 12.5 = 67');
});

db.close();