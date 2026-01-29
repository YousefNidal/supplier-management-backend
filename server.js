const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Конфигурация аутентификации
const SELLER_CREDENTIALS = {
  username: 'kizuma',
  password: 'kizuma'
};

// Middleware для проверки аутентификации
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return res.status(401).json({ error: 'Требуется аутентификация' });
  }
  
  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Неверный формат токена' });
  }
  
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    const [username, password] = decoded.split(':');
    
    if (username === SELLER_CREDENTIALS.username && password === SELLER_CREDENTIALS.password) {
      req.user = { username, role: 'seller' };
      next();
    } else {
      res.status(401).json({ error: 'Неверные учетные данные' });
    }
  } catch (error) {
    res.status(401).json({ error: 'Ошибка аутентификации' });
  }
};

// Middleware для гостевого доступа (только GET запросы)
const guestAccess = (req, res, next) => {
  if (req.method === 'GET') {
    req.user = { username: 'guest', role: 'guest' };
    next();
  } else {
    res.status(401).json({ error: 'Требуется аутентификация для этого действия' });
  }
};

// Подключение к базе данных
const db = new sqlite3.Database('./database.db', (err) => {
  if (err) {
    console.error('Ошибка подключения к базе данных:', err.message);
  } else {
    console.log('Подключено к базе данных SQLite');
  }
});

// Middleware для логгирования запросов
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url} - User: ${req.user?.username || 'unauthorized'}`);
  next();
});

// ==================== ЭНДПОИНТЫ АУТЕНТИФИКАЦИИ ====================

// Логин
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  
  console.log('Login attempt:', { username, password });
  
  if (username === SELLER_CREDENTIALS.username && password === SELLER_CREDENTIALS.password) {
    // Создаем базовый токен
    const token = Buffer.from(`${username}:${password}`).toString('base64');
    
    res.json({
      success: true,
      token,
      user: {
        username,
        role: 'seller'
      },
      message: 'Успешный вход'
    });
  } else {
    res.status(401).json({
      success: false,
      error: 'Неверные учетные данные'
    });
  }
});

// Проверка токена
app.get('/api/verify-auth', authenticate, (req, res) => {
  res.json({
    authenticated: true,
    user: req.user
  });
});

// ==================== ПУБЛИЧНЫЕ ЭНДПОИНТЫ (гостевой доступ) ====================

// Получить информацию о продавце (публичный)
app.get('/api/seller', guestAccess, (req, res) => {
  db.get('SELECT * FROM seller WHERE id = 1', (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      const seller = {
        id: row.id,
        name: row.name,
        balance: row.balance,
        gameNickname: row.game_nickname
      };
      res.json(seller);
    }
  });
});

// Получить всех поставщиков (публичный)
app.get('/api/suppliers', guestAccess, (req, res) => {
  db.all('SELECT * FROM suppliers ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
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
    }
  });
});

// Получить одного поставщика по ID (публичный)
app.get('/api/suppliers/:id', guestAccess, (req, res) => {
  const id = parseInt(req.params.id);
  
  db.get('SELECT * FROM suppliers WHERE id = ?', [id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else if (!row) {
      res.status(404).json({ error: 'Поставщик не найден' });
    } else {
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
    }
  });
});

// Получить все заказы поставщика (публичный)
app.get('/api/suppliers/:id/orders', guestAccess, (req, res) => {
  const supplierId = parseInt(req.params.id);
  
  db.all(
    `SELECT * FROM orders WHERE supplier_id = ? ORDER BY created_at DESC`,
    [supplierId],
    (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
      } else {
        const orders = rows.map(row => ({
          id: row.id,
          supplierId: row.supplier_id,
          imageUrl: row.image_url,
          cost: row.cost,
          premium: row.premium,
          debtAmount: row.debt_amount,
          status: row.status,
          notes: row.notes,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        }));
        res.json(orders);
      }
    }
  );
});

// Получить статистику (публичный)
app.get('/api/stats', guestAccess, (req, res) => {
  const stats = {};
  
  db.get('SELECT SUM(debt) as total_debt FROM suppliers', (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    stats.totalDebt = row.total_debt || 0;
    
    db.get('SELECT SUM(orders_count) as total_orders FROM suppliers', (err, row) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      stats.totalOrders = row.total_orders || 0;
      
      db.get('SELECT COUNT(*) as supplier_count FROM suppliers', (err, row) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        stats.supplierCount = row.supplier_count || 0;
        
        res.json(stats);
      });
    });
  });
});

// ==================== ЗАЩИЩЕННЫЕ ЭНДПОИНТЫ (только для продавца) ====================

// Обновить баланс продавца (только продавец)
app.put('/api/seller/balance', authenticate, (req, res) => {
  const { balance } = req.body;
  
  if (balance === undefined || isNaN(balance)) {
    return res.status(400).json({ error: 'Некорректное значение баланса' });
  }

  db.run(
    'UPDATE seller SET balance = ? WHERE id = 1',
    [parseFloat(balance)],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
      } else {
        res.json({ 
          message: 'Баланс обновлен', 
          changes: this.changes 
        });
      }
    }
  );
});

// Добавить нового поставщика (только продавец)
app.post('/api/suppliers', authenticate, (req, res) => {
  const { name, gameNickname, debt = 0, ordersCount = 0 } = req.body;
  
  if (!name || !gameNickname) {
    return res.status(400).json({ error: 'Имя и игровой ник обязательны' });
  }

  db.run(
    `INSERT INTO suppliers (name, game_nickname, debt, orders_count, updated_at) 
     VALUES (?, ?, ?, ?, datetime('now'))`,
    [name, gameNickname, parseFloat(debt) || 0, parseInt(ordersCount) || 0],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
      } else {
        db.get('SELECT * FROM suppliers WHERE id = ?', [this.lastID], (err, row) => {
          if (err) {
            res.status(500).json({ error: err.message });
          } else {
            const supplier = {
              id: row.id,
              name: row.name,
              gameNickname: row.game_nickname,
              debt: row.debt,
              ordersCount: row.orders_count,
              createdAt: row.created_at,
              updatedAt: row.updated_at
            };
            res.status(201).json(supplier);
          }
        });
      }
    }
  );
});

// Обновить информацию о поставщике (только продавец)
app.put('/api/suppliers/:id', authenticate, (req, res) => {
  const id = parseInt(req.params.id);
  const { name, gameNickname, debt, ordersCount } = req.body;
  
  db.get('SELECT * FROM suppliers WHERE id = ?', [id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ error: 'Поставщик не найден' });
    }

    const updatedName = name || row.name;
    const updatedGameNickname = gameNickname || row.game_nickname;
    const updatedDebt = debt !== undefined ? parseFloat(debt) : row.debt;
    const updatedOrdersCount = ordersCount !== undefined ? parseInt(ordersCount) : row.orders_count;

    db.run(
      `UPDATE suppliers 
       SET name = ?, game_nickname = ?, debt = ?, orders_count = ?, updated_at = datetime('now') 
       WHERE id = ?`,
      [updatedName, updatedGameNickname, updatedDebt, updatedOrdersCount, id],
      function(err) {
        if (err) {
          res.status(500).json({ error: err.message });
        } else {
          res.json({ 
            message: 'Поставщик обновлен', 
            changes: this.changes 
          });
        }
      }
    );
  });
});

// Удалить поставщика (только продавец)
app.delete('/api/suppliers/:id', authenticate, (req, res) => {
  const id = parseInt(req.params.id);
  
  db.run('DELETE FROM suppliers WHERE id = ?', [id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
    } else if (this.changes === 0) {
      res.status(404).json({ error: 'Поставщик не найден' });
    } else {
      res.json({ 
        message: 'Поставщик удален', 
        changes: this.changes 
      });
    }
  });
});

// Создать новый заказ (только продавец)
app.post('/api/orders', authenticate, (req, res) => {
  const { supplierId, imageUrl, cost, premium, notes } = req.body;
  
  console.log('Creating order with data:', { supplierId, imageUrl, cost, premium, notes });
  
  if (!supplierId || !imageUrl || cost === undefined) {
    return res.status(400).json({ error: 'Необходимы supplierId, imageUrl и cost' });
  }

  try {
    // Расчет: стоимость - (стоимость × 30%) - премиум
    const calculatedDebt = parseFloat(cost) - (parseFloat(cost) * 0.3) - (parseFloat(premium) || 0);
    
    console.log('Calculated debt (cost - 30% - premium):', calculatedDebt);

    db.run(
      `INSERT INTO orders (supplier_id, image_url, cost, premium, debt_amount, notes, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
      [
        supplierId, 
        imageUrl, 
        parseFloat(cost) || 0, 
        parseFloat(premium) || 0, 
        calculatedDebt, 
        notes || ''
      ],
      function(err) {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: err.message });
        }
        
        const orderId = this.lastID;
        console.log('Order created with ID:', orderId);
        
        db.get(
          `SELECT COALESCE(SUM(debt_amount), 0) as total_debt, 
                  COUNT(*) as orders_count 
           FROM orders 
           WHERE supplier_id = ? AND status = 'active'`,
          [supplierId],
          (err, result) => {
            if (err) {
              console.error('Error calculating supplier debt:', err);
            } else {
              console.log('Updating supplier debt:', result);
              
              db.run(
                `UPDATE suppliers 
                 SET debt = ?, orders_count = ?, updated_at = datetime('now') 
                 WHERE id = ?`,
                [result.total_debt, result.orders_count, supplierId],
                (err) => {
                  if (err) {
                    console.error('Error updating supplier:', err);
                  }
                }
              );
            }
            
            db.get('SELECT * FROM orders WHERE id = ?', [orderId], (err, row) => {
              if (err) {
                console.error('Error fetching created order:', err);
                return res.status(500).json({ error: err.message });
              }
              
              const order = {
                id: row.id,
                supplierId: row.supplier_id,
                imageUrl: row.image_url,
                cost: row.cost,
                premium: row.premium,
                debtAmount: row.debt_amount,
                status: row.status,
                notes: row.notes,
                createdAt: row.created_at,
                updatedAt: row.updated_at
              };
              
              console.log('Returning order:', order);
              res.status(201).json(order);
            });
          }
        );
      }
    );
  } catch (error) {
    console.error('Error in order creation:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Обновить заказ (только продавец)
app.put('/api/orders/:id', authenticate, (req, res) => {
  const orderId = parseInt(req.params.id);
  const { imageUrl, cost, premium, status, notes } = req.body;
  
  console.log('Updating order:', { orderId, imageUrl, cost, premium, status, notes });
  
  db.get('SELECT * FROM orders WHERE id = ?', [orderId], (err, row) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ error: 'Заказ не найден' });
    }

    const newCost = cost !== undefined ? parseFloat(cost) : row.cost;
    const newPremium = premium !== undefined ? parseFloat(premium) : row.premium;
    
    let newDebtAmount = row.debt_amount;
    if (cost !== undefined || premium !== undefined) {
      newDebtAmount = newCost - (newCost * 0.3) - newPremium;
      console.log('Recalculated debt (cost - 30% - premium):', newDebtAmount);
    }

    db.run(
      `UPDATE orders 
       SET image_url = ?, cost = ?, premium = ?, debt_amount = ?, 
           status = ?, notes = ?, updated_at = datetime('now') 
       WHERE id = ?`,
      [
        imageUrl || row.image_url,
        newCost,
        newPremium,
        newDebtAmount,
        status || row.status,
        notes || row.notes,
        orderId
      ],
      function(err) {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: err.message });
        }
        
        console.log('Order updated, changes:', this.changes);
        
        db.get(
          `SELECT COALESCE(SUM(debt_amount), 0) as total_debt, 
                  COUNT(*) as orders_count 
           FROM orders 
           WHERE supplier_id = ? AND status = 'active'`,
          [row.supplier_id],
          (err, result) => {
            if (err) {
              console.error('Error calculating supplier debt:', err);
            } else {
              console.log('Updating supplier with new debt:', result);
              
              db.run(
                `UPDATE suppliers 
                 SET debt = ?, orders_count = ?, updated_at = datetime('now') 
                 WHERE id = ?`,
                [result.total_debt, result.orders_count, row.supplier_id],
                (err) => {
                  if (err) {
                    console.error('Error updating supplier:', err);
                  }
                }
              );
            }
            
            res.json({ 
              message: 'Заказ обновлен', 
              changes: this.changes 
            });
          }
        );
      }
    );
  });
});

// Удалить заказ (только продавец)
app.delete('/api/orders/:id', authenticate, (req, res) => {
  const orderId = parseInt(req.params.id);
  
  db.get('SELECT * FROM orders WHERE id = ?', [orderId], (err, order) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: err.message });
    }
    if (!order) {
      return res.status(404).json({ error: 'Заказ не найден' });
    }

    db.run('DELETE FROM orders WHERE id = ?', [orderId], function(err) {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: err.message });
      }
      
      console.log('Order deleted, changes:', this.changes);
      
      db.get(
        `SELECT COALESCE(SUM(debt_amount), 0) as total_debt, 
                COUNT(*) as orders_count 
         FROM orders 
         WHERE supplier_id = ? AND status = 'active'`,
        [order.supplier_id],
        (err, result) => {
          if (err) {
            console.error('Error calculating supplier debt:', err);
          } else {
            console.log('Updating supplier after deletion:', result);
            
            db.run(
              `UPDATE suppliers 
               SET debt = ?, orders_count = ?, updated_at = datetime('now') 
               WHERE id = ?`,
              [result.total_debt, result.orders_count, order.supplier_id],
              (err) => {
                if (err) {
                  console.error('Error updating supplier:', err);
                }
              }
            );
          }
          
          res.json({ 
            message: 'Заказ удален', 
            changes: this.changes 
          });
        }
      );
    });
  });
});

// ==================== ОБРАБОТКА ОШИБОК ====================

app.use('/api/*', (req, res) => {
  console.error(`API endpoint not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ 
    error: 'API endpoint not found',
    message: `Endpoint ${req.method} ${req.originalUrl} не найден`
  });
});

app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: 'Внутренняя ошибка сервера'
  });
});

// ==================== ЗАПУСК СЕРВЕРА ====================

app.listen(PORT, () => {
  console.log(`========================================`);
  console.log(`Сервер запущен на порту ${PORT}`);
  console.log(`Логин продавца: kizuma / kizuma`);
  console.log(`API доступно по адресу: http://localhost:${PORT}`);
  console.log(`Доступные эндпоиниты:`);
  console.log(`  POST /api/login - вход в систему`);
  console.log(`  GET  /api/verify-auth - проверка аутентификации`);
  console.log(`  GET  /api/seller - информация о продавце (публичный)`);
  console.log(`  GET  /api/suppliers - все поставщики (публичный)`);
  console.log(`  GET  /api/suppliers/:id - поставщик по ID (публичный)`);
  console.log(`  GET  /api/suppliers/:id/orders - заказы поставщика (публичный)`);
  console.log(`  GET  /api/stats - статистика (публичный)`);
  console.log(`  PUT  /api/seller/balance - обновление баланса (только продавец)`);
  console.log(`  POST /api/suppliers - добавить поставщика (только продавец)`);
  console.log(`  PUT  /api/suppliers/:id - обновить поставщика (только продавец)`);
  console.log(`  DELETE /api/suppliers/:id - удалить поставщика (только продавец)`);
  console.log(`  POST /api/orders - создать заказ (только продавец)`);
  console.log(`  PUT  /api/orders/:id - обновить заказ (только продавец)`);
  console.log(`  DELETE /api/orders/:id - удалить заказ (только продавец)`);
  console.log(`========================================`);
});

process.on('SIGINT', () => {
  db.close((err) => {
    if (err) {
      console.error('Ошибка при закрытии базы данных:', err.message);
    } else {
      console.log('Подключение к базе данных закрыто');
    }
    process.exit(0);
  });
});