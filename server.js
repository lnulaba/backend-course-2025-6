const { program } = require('commander');
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

// Налаштування командного рядка
program
  .requiredOption('-h, --host <host>', 'server host address')
  .requiredOption('-p, --port <port>', 'server port')
  .requiredOption('-c, --cache <cache>', 'cache directory path');

program.parse();

const options = program.opts();

// Створюємо директорію кешу якщо вона не існує
if (!fs.existsSync(options.cache)) {
  fs.mkdirSync(options.cache, { recursive: true });
}

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('.'));

// Налаштування multer для завантаження файлів
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, options.cache);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// Swagger configuration
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Inventory Service API',
      version: '1.0.0',
      description: 'API for inventory management system'
    },
    servers: [
      {
        url: `http://${options.host}:${options.port}`,
        description: 'Development server'
      }
    ]
  },
  apis: ['./server.js']
};

const specs = swaggerJsdoc(swaggerOptions);
app.use('/docs', swaggerUi.serve, swaggerUi.setup(specs));

// Зберігання даних в пам'яті
let inventory = [];
let nextId = 1;

/**
 * @swagger
 * components:
 *   schemas:
 *     InventoryItem:
 *       type: object
 *       required:
 *         - id
 *         - inventory_name
 *       properties:
 *         id:
 *           type: integer
 *           description: Unique identifier
 *         inventory_name:
 *           type: string
 *           description: Name of the inventory item
 *         description:
 *           type: string
 *           description: Description of the inventory item
 *         photo:
 *           type: string
 *           description: Photo filename
 *         photo_url:
 *           type: string
 *           description: URL to access the photo
 */

/**
 * @swagger
 * /register:
 *   post:
 *     summary: Register a new inventory item
 *     description: Register a new device through web form with photo upload
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - inventory_name
 *             properties:
 *               inventory_name:
 *                 type: string
 *                 description: Name of the inventory item (required)
 *               description:
 *                 type: string
 *                 description: Description of the inventory item
 *               photo:
 *                 type: string
 *                 format: binary
 *                 description: Photo image file
 *     responses:
 *       201:
 *         description: Item successfully created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InventoryItem'
 *       400:
 *         description: Bad request - missing required fields
 */
app.post('/register', upload.single('photo'), (req, res) => {
  const { inventory_name, description } = req.body;
  
  if (!inventory_name || inventory_name.trim() === '') {
    return res.status(400).json({ error: 'Inventory name is required' });
  }
  
  const item = {
    id: nextId++,
    inventory_name: inventory_name.trim(),
    description: description || '',
    photo: req.file ? req.file.filename : null,
    photo_url: req.file ? `/inventory/${nextId-1}/photo` : null
  };
  
  inventory.push(item);
  res.status(201).json(item);
});

/**
 * @swagger
 * /inventory:
 *   get:
 *     summary: Get all inventory items
 *     description: Returns a list of all inventory items
 *     responses:
 *       200:
 *         description: List of inventory items
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/InventoryItem'
 */
app.get('/inventory', (req, res) => {
  res.json(inventory);
});

/**
 * @swagger
 * /inventory/{id}:
 *   get:
 *     summary: Get specific inventory item
 *     description: Returns information about a specific inventory item
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Unique identifier of the inventory item
 *     responses:
 *       200:
 *         description: Inventory item information
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InventoryItem'
 *       404:
 *         description: Item not found
 */
app.get('/inventory/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const item = inventory.find(i => i.id === id);
  
  if (!item) {
    return res.status(404).json({ error: 'Item not found' });
  }
  
  res.json(item);
});

/**
 * @swagger
 * /inventory/{id}:
 *   put:
 *     summary: Update inventory item
 *     description: Update name or description of a specific inventory item
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Unique identifier of the inventory item
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               inventory_name:
 *                 type: string
 *                 description: New name for the inventory item
 *               description:
 *                 type: string
 *                 description: New description for the inventory item
 *     responses:
 *       200:
 *         description: Item successfully updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InventoryItem'
 *       404:
 *         description: Item not found
 */
app.put('/inventory/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const item = inventory.find(i => i.id === id);
  
  if (!item) {
    return res.status(404).json({ error: 'Item not found' });
  }
  
  const { inventory_name, description } = req.body;
  
  if (inventory_name !== undefined) {
    item.inventory_name = inventory_name;
  }
  if (description !== undefined) {
    item.description = description;
  }
  
  res.json(item);
});

/**
 * @swagger
 * /inventory/{id}/photo:
 *   get:
 *     summary: Get inventory item photo
 *     description: Returns the photo image of a specific inventory item
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Unique identifier of the inventory item
 *     responses:
 *       200:
 *         description: Photo image
 *         content:
 *           image/jpeg:
 *             schema:
 *               type: string
 *               format: binary
 *       404:
 *         description: Item or photo not found
 */
app.get('/inventory/:id/photo', (req, res) => {
  const id = parseInt(req.params.id);
  const item = inventory.find(i => i.id === id);
  
  if (!item || !item.photo) {
    return res.status(404).json({ error: 'Photo not found' });
  }
  
  const photoPath = path.join(options.cache, item.photo);
  
  if (!fs.existsSync(photoPath)) {
    return res.status(404).json({ error: 'Photo file not found' });
  }
  
  res.setHeader('Content-Type', 'image/jpeg');
  res.sendFile(path.resolve(photoPath));
});

/**
 * @swagger
 * /inventory/{id}/photo:
 *   put:
 *     summary: Update inventory item photo
 *     description: Update the photo of a specific inventory item
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Unique identifier of the inventory item
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               photo:
 *                 type: string
 *                 format: binary
 *                 description: New photo image file
 *     responses:
 *       200:
 *         description: Photo successfully updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InventoryItem'
 *       404:
 *         description: Item not found
 */
app.put('/inventory/:id/photo', upload.single('photo'), (req, res) => {
  const id = parseInt(req.params.id);
  const item = inventory.find(i => i.id === id);
  
  if (!item) {
    return res.status(404).json({ error: 'Item not found' });
  }
  
  if (!req.file) {
    return res.status(400).json({ error: 'Photo file is required' });
  }
  
  // Видаляємо старе фото якщо воно існує
  if (item.photo) {
    const oldPhotoPath = path.join(options.cache, item.photo);
    if (fs.existsSync(oldPhotoPath)) {
      fs.unlinkSync(oldPhotoPath);
    }
  }
  
  item.photo = req.file.filename;
  item.photo_url = `/inventory/${id}/photo`;
  
  res.json(item);
});

/**
 * @swagger
 * /inventory/{id}:
 *   delete:
 *     summary: Delete inventory item
 *     description: Remove an inventory item from the list
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Unique identifier of the inventory item
 *     responses:
 *       200:
 *         description: Item successfully deleted
 *       404:
 *         description: Item not found
 */
app.delete('/inventory/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const index = inventory.findIndex(i => i.id === id);
  
  if (index === -1) {
    return res.status(404).json({ error: 'Item not found' });
  }
  
  const item = inventory[index];
  
  // Видаляємо фото якщо воно існує
  if (item.photo) {
    const photoPath = path.join(options.cache, item.photo);
    if (fs.existsSync(photoPath)) {
      fs.unlinkSync(photoPath);
    }
  }
  
  inventory.splice(index, 1);
  res.json({ message: 'Item deleted successfully' });
});

/**
 * @swagger
 * /search:
 *   post:
 *     summary: Search for inventory item
 *     description: Search for device by serial number/ID using form data
 *     requestBody:
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *             required:
 *               - id
 *             properties:
 *               id:
 *                 type: string
 *                 description: Serial number/ID to search for
 *               has_photo:
 *                 type: string
 *                 description: Checkbox to include photo link in description
 *     responses:
 *       200:
 *         description: Found inventory item
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InventoryItem'
 *       404:
 *         description: Item not found
 */
app.post('/search', (req, res) => {
  const { id, has_photo } = req.body;
  const itemId = parseInt(id);
  const item = inventory.find(i => i.id === itemId);
  
  if (!item) {
    return res.status(404).json({ error: 'Item not found' });
  }
  
  let result = { ...item };
  
  // Якщо прапорець has_photo встановлено, додаємо посилання на фото до опису
  if (has_photo === 'on' && item.photo) {
    result.description = `${result.description}\nPhoto: ${result.photo_url}`;
  }
  
  res.json(result);
});

// Обробка неіснуючих методів
app.all('*', (req, res) => {
  res.status(405).json({ error: 'Method not allowed' });
});

// Запуск сервера
app.listen(options.port, options.host, () => {
  console.log(`Server running at http://${options.host}:${options.port}`);
  console.log(`API Documentation available at http://${options.host}:${options.port}/docs`);
});
