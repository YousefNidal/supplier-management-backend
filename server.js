const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Подключение к базе данных
const db = new sqlite3.Database('./database.db', (err) => {
  if (err) {
    console.error('Ошибка подключения к базе данных:', err);
  } else {
    console.log('Подключение к SQLite базе данных установлено');
  }
});

// Middleware для логирования
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
  next();
});

// API Routes

// Получение продавца
app.get('/api/seller', (req, res) => {
  db.get('SELECT * FROM seller WHERE id = 1', (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    // Преобразуем snake_case в camelCase
    const seller = {
      id: row.id,
      name: row.name,
      balance: row.balance,
      gameNickname: row.game_nickname
    };
    res.json(seller);
  });
});

// Обновление баланса продавца
app.put('/api/seller/balance', (req, res) => {
  const { balance } = req.body;
  
  db.run('UPDATE seller SET balance = ? WHERE id = 1', [balance], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ success: true, balance });
  });
});

// Получение статистики
app.get('/api/stats', (req, res) => {
  db.get(`SELECT 
    (SELECT COALESCE(SUM(debt), 0) FROM suppliers) as totalDebt,
    (SELECT COUNT(*) FROM suppliers) as supplierCount,
    (SELECT COUNT(*) FROM orders WHERE status = 'active') as totalOrders`,
    (err, row) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({
        totalDebt: row.totalDebt,
        supplierCount: row.supplierCount,
        totalOrders: row.totalOrders
      });
    }
  );
});

// Получение всех поставщиков
app.get('/api/suppliers', (req, res) => {
  db.all('SELECT * FROM suppliers ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    // Преобразуем snake_case в camelCase
    const suppliers = rows.map(row => ({
      id: row.id,
      name: row.name,
      gameNickname: row.game_nickname,
      debt: row.debt,
      ordersCount: row.orders_count,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
    res.json(suppliers);
  });
});

// Получение поставщика по ID
app.get('/api/suppliers/:id', (req, res) => {
  const { id } = req.params;
  
  db.get('SELECT * FROM suppliers WHERE id = ?', [id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!row) {
      res.status(404).json({ error: 'Поставщик не найден' });
      return;
    }
    const supplier = {
      id: row.id,
      name: row.name,
      gameNickname: row.game_nickname,
      debt: row.debt,
      ordersCount: row.orders_count,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
    res.json(supplier);
  });
});

// Добавление поставщика
app.post('/api/suppliers', (req, res) => {
  const { name, gameNickname, debt = 0, ordersCount = 0 } = req.body;
  
  db.run(
    'INSERT INTO suppliers (name, game_nickname, debt, orders_count) VALUES (?, ?, ?, ?)',
    [name, gameNickname, debt, ordersCount],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      res.json({
        id: this.lastID,
        name,
        gameNickname,
        debt,
        ordersCount,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }
  );
});

// Обновление поставщика
app.put('/api/suppliers/:id', (req, res) => {
  const { id } = req.params;
  const { name, gameNickname, debt, ordersCount } = req.body;
  
  db.run(
    'UPDATE suppliers SET name = ?, game_nickname = ?, debt = ?, orders_count = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [name, gameNickname, debt, ordersCount, id],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      if (this.changes === 0) {
        res.status(404).json({ error: 'Поставщик не найден' });
        return;
      }
      
      res.json({ success: true });
    }
  );
});

// Удаление поставщика
app.delete('/api/suppliers/:id', (req, res) => {
  const { id } = req.params;
  
  db.run('DELETE FROM suppliers WHERE id = ?', [id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    if (this.changes === 0) {
      res.status(404).json({ error: 'Поставщик не найден' });
      return;
    }
    
    // Также удаляем связанные заказы
    db.run('DELETE FROM orders WHERE supplier_id = ?', [id]);
    
    res.json({ success: true });
  });
});

// Получение заказов поставщика
app.get('/api/suppliers/:id/orders', (req, res) => {
  const { id } = req.params;
  
  db.all(
    'SELECT * FROM orders WHERE supplier_id = ? ORDER BY created_at DESC',
    [id],
    (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      // Преобразуем snake_case в camelCase
      const orders = rows.map(order => ({
        id: order.id,
        supplierId: order.supplier_id,
        imageUrl: order.image_url,
        cost: order.cost,
        premium: order.premium,
        debtAmount: order.debt_amount,
        status: order.status,
        notes: order.notes,
        createdAt: order.created_at,
        updatedAt: order.updated_at,
        isSplit: order.is_split === 1,
        splitWith: order.split_with
      }));
      
      res.json(orders);
    }
  );
});

// Получение всех заказов
app.get('/api/orders', (req, res) => {
  db.all(
    'SELECT * FROM orders ORDER BY created_at DESC',
    (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      const orders = rows.map(order => ({
        id: order.id,
        supplierId: order.supplier_id,
        imageUrl: order.image_url,
        cost: order.cost,
        premium: order.premium,
        debtAmount: order.debt_amount,
        status: order.status,
        notes: order.notes,
        createdAt: order.created_at,
        updatedAt: order.updated_at,
        isSplit: order.is_split === 1,
        splitWith: order.split_with
      }));
      
      res.json(orders);
    }
  );
});

// Получение заказа по ID
app.get('/api/orders/:id', (req, res) => {
  const { id } = req.params;
  
  db.get('SELECT * FROM orders WHERE id = ?', [id], (err, order) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    if (!order) {
      res.status(404).json({ error: 'Заказ не найден' });
      return;
    }
    
    const formattedOrder = {
      id: order.id,
      supplierId: order.supplier_id,
      imageUrl: order.image_url,
      cost: order.cost,
      premium: order.premium,
      debtAmount: order.debt_amount,
      status: order.status,
      notes: order.notes,
      createdAt: order.created_at,
      updatedAt: order.updated_at,
      isSplit: order.is_split === 1,
      splitWith: order.split_with
    };
    
    res.json(formattedOrder);
  });
});

// Создание заказа (ИСПРАВЛЕН РАСЧЕТ)
app.post('/api/orders', (req, res) => {
  const { supplierId, imageUrl, cost, premium, notes, status = 'active', isSplit = false, splitWith = null } = req.body;
  
  // Расчет задолженности (ИСПРАВЛЕНО)
  let debtAmount;
  if (isSplit) {
    // ДЛЯ РАЗДЕЛЕННЫХ ЗАКАЗОВ: (стоимость/2) - (премиум/2)
    // При создании разделенного заказа, frontend должен передать уже разделенные значения
    // Проверяем, что значения уже поделены пополам
    if (cost > 100000) { // Если стоимость слишком большая, возможно передана полная сумма
      console.warn('Внимание: Возможно передана полная стоимость для разделенного заказа');
    }
    debtAmount = cost - premium; // cost и premium уже должны быть разделены пополам
  } else {
    // Для обычных заказов: стоимость - 30% - премиум
    debtAmount = cost - (cost * 0.3) - premium;
  }
  
  console.log(`Создание заказа: isSplit=${isSplit}, cost=${cost}, premium=${premium}, debtAmount=${debtAmount}`);
  
  db.run(
    `INSERT INTO orders (supplier_id, image_url, cost, premium, debt_amount, status, notes, is_split, split_with) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [supplierId, imageUrl, cost, premium, debtAmount, status, notes, isSplit ? 1 : 0, splitWith],
    function(err) {
      if (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: err.message });
        return;
      }
      
      // Обновляем задолженность и количество заказов поставщика
      db.run(
        `UPDATE suppliers 
         SET debt = (
           SELECT COALESCE(SUM(debt_amount), 0) 
           FROM orders 
           WHERE supplier_id = ? AND status = 'active'
         ),
         orders_count = (
           SELECT COUNT(*) 
           FROM orders 
           WHERE supplier_id = ? AND status = 'active'
         ),
         updated_at = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        [supplierId, supplierId, supplierId],
        (err) => {
          if (err) {
            console.error('Error updating supplier:', err);
          }
        }
      );
      
      // Получаем созданный заказ для ответа
      db.get('SELECT * FROM orders WHERE id = ?', [this.lastID], (err, newOrder) => {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        
        const responseOrder = {
          id: newOrder.id,
          supplierId: newOrder.supplier_id,
          imageUrl: newOrder.image_url,
          cost: newOrder.cost,
          premium: newOrder.premium,
          debtAmount: newOrder.debt_amount,
          status: newOrder.status,
          notes: newOrder.notes,
          createdAt: newOrder.created_at,
          updatedAt: newOrder.updated_at,
          isSplit: newOrder.is_split === 1,
          splitWith: newOrder.split_with
        };
        
        res.json(responseOrder);
      });
    }
  );
});

// Разделение заказа пополам (ИСПРАВЛЕН РАСЧЕТ)
app.post('/api/orders/:id/split', (req, res) => {
  const { id } = req.params;
  const { splitWith } = req.body;
  
  // Получаем исходный заказ
  db.get('SELECT * FROM orders WHERE id = ?', [id], (err, originalOrder) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    if (!originalOrder) {
      res.status(404).json({ error: 'Заказ не найден' });
      return;
    }
    
    // Расчет половины стоимости и премиума
    const halfCost = originalOrder.cost / 2;
    const halfPremium = originalOrder.premium / 2;
    // ИСПРАВЛЕННЫЙ РАСЧЕТ: (стоимость/2) - (премиум/2)
    const halfDebt = halfCost - halfPremium;
    
    console.log(`Разделение заказа ${id}:`);
    console.log(`Полная стоимость: ${originalOrder.cost}, Премиум: ${originalOrder.premium}`);
    console.log(`Половина стоимости: ${halfCost}, Половина премиума: ${halfPremium}`);
    console.log(`Задолженность за половину: ${halfDebt} (${halfCost} - ${halfPremium})`);
    
    // Обновляем исходный заказ как разделенный
    db.run(
      `UPDATE orders 
       SET cost = ?, premium = ?, debt_amount = ?, is_split = 1, split_with = ?, updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [halfCost, halfPremium, halfDebt, splitWith, id],
      function(err) {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        
        // Создаем второй заказ (вторая половина)
        db.run(
          `INSERT INTO orders (supplier_id, image_url, cost, premium, debt_amount, status, notes, is_split, split_with) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [originalOrder.supplier_id, originalOrder.image_url, halfCost, halfPremium, halfDebt, 
           originalOrder.status, originalOrder.notes || '', 1, splitWith],
          function(err) {
            if (err) {
              res.status(500).json({ error: err.message });
              return;
            }
            
            // Обновляем задолженность и количество заказов поставщика
            db.run(
              `UPDATE suppliers 
               SET debt = (
                 SELECT COALESCE(SUM(debt_amount), 0) 
                 FROM orders 
                 WHERE supplier_id = ? AND status = 'active'
               ),
               orders_count = (
                 SELECT COUNT(*) 
                 FROM orders 
                 WHERE supplier_id = ? AND status = 'active'
               ),
               updated_at = CURRENT_TIMESTAMP 
               WHERE id = ?`,
              [originalOrder.supplier_id, originalOrder.supplier_id, originalOrder.supplier_id],
              (err) => {
                if (err) {
                  console.error('Error updating supplier:', err);
                }
                
                res.json({
                  success: true,
                  originalOrderId: id,
                  newOrderId: this.lastID,
                  halfCost: halfCost,
                  halfPremium: halfPremium,
                  halfDebt: halfDebt,
                  message: 'Заказ успешно разделен пополам'
                });
              }
            );
          }
        );
      }
    );
  });
});

// Обновление заказа (ИСПРАВЛЕН РАСЧЕТ)
app.put('/api/orders/:id', (req, res) => {
  const { id } = req.params;
  const { supplierId, imageUrl, cost, premium, notes, status, isSplit = false, splitWith = null } = req.body;
  
  // Расчет новой задолженности (ИСПРАВЛЕНО)
  let debtAmount;
  if (isSplit) {
    // ДЛЯ РАЗДЕЛЕННЫХ ЗАКАЗОВ: (стоимость/2) - (премиум/2)
    // cost и premium уже должны быть разделены пополам
    debtAmount = cost - premium;
  } else {
    // Для обычных заказов: стоимость - 30% - премиум
    debtAmount = cost - (cost * 0.3) - premium;
  }
  
  console.log(`Обновление заказа ${id}: isSplit=${isSplit}, cost=${cost}, premium=${premium}, debtAmount=${debtAmount}`);
  
  db.run(
    `UPDATE orders 
     SET supplier_id = ?, image_url = ?, cost = ?, premium = ?, debt_amount = ?, 
         status = ?, notes = ?, updated_at = CURRENT_TIMESTAMP, is_split = ?, split_with = ?
     WHERE id = ?`,
    [supplierId, imageUrl, cost, premium, debtAmount, status, notes, isSplit ? 1 : 0, splitWith, id],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      if (this.changes === 0) {
        res.status(404).json({ error: 'Заказ не найден' });
        return;
      }
      
      // Обновляем задолженность и количество заказов поставщика
      db.run(
        `UPDATE suppliers 
         SET debt = (
           SELECT COALESCE(SUM(debt_amount), 0) 
           FROM orders 
           WHERE supplier_id = ? AND status = 'active'
         ),
         orders_count = (
           SELECT COUNT(*) 
           FROM orders 
           WHERE supplier_id = ? AND status = 'active'
         ),
         updated_at = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        [supplierId, supplierId, supplierId],
        (err) => {
          if (err) {
            console.error('Error updating supplier:', err);
          }
          res.json({ success: true });
        }
      );
    }
  );
});

// Удаление заказа
app.delete('/api/orders/:id', (req, res) => {
  const { id } = req.params;
  
  // Сначала получаем информацию о заказе для обновления поставщика
  db.get('SELECT supplier_id FROM orders WHERE id = ?', [id], (err, order) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    if (!order) {
      res.status(404).json({ error: 'Заказ не найден' });
      return;
    }
    
    const supplierId = order.supplier_id;
    
    // Удаляем заказ
    db.run('DELETE FROM orders WHERE id = ?', [id], function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      if (this.changes === 0) {
        res.status(404).json({ error: 'Заказ не найден' });
        return;
      }
      
      // Обновляем задолженность и количество заказов поставщика
      db.run(
        `UPDATE suppliers 
         SET debt = (
           SELECT COALESCE(SUM(debt_amount), 0) 
           FROM orders 
           WHERE supplier_id = ? AND status = 'active'
         ),
         orders_count = (
           SELECT COUNT(*) 
           FROM orders 
           WHERE supplier_id = ? AND status = 'active'
         ),
         updated_at = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        [supplierId, supplierId, supplierId],
        (err) => {
          if (err) {
            console.error('Error updating supplier:', err);
          }
          res.json({ success: true });
        }
      );
    });
  });
});

// Аутентификация (заглушка)
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  
  // Простая проверка (в реальном приложении используйте базу данных)
  if (username === 'seller' && password === 'password123') {
    res.json({
      success: true,
      token: 'fake-jwt-token',
      user: {
        id: 1,
        username: 'seller',
        role: 'seller',
        name: 'Иван Иванов'
      }
    });
  } else {
    res.status(401).json({ success: false, error: 'Неверные учетные данные' });
  }
});

// Проверка аутентификации
app.get('/api/verify-auth', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (token === 'fake-jwt-token') {
    res.json({ authenticated: true });
  } else {
    res.status(401).json({ authenticated: false });
  }
});

// Запуск сервера
app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
  console.log('ИСПРАВЛЕННЫЙ расчет для разделенного заказа:');
  console.log('Пример: Стоимость: 159, Премиум: 25');
  console.log('Расчет: (159/2) - (25/2) = 79.5 - 12.5 = 67');
});