const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { program } = require('commander');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

program
  .requiredOption('-h, --host <host>', 'server host')
  .requiredOption('-p, --port <port>', 'server port')
  .requiredOption('-c, --cache <cache>', 'cache directory path')
  .parse();

const { host, port, cache } = program.opts();
fs.mkdirSync(cache, { recursive: true });

const app = express();
const inventory = [];
let nextId = 1;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('.'));

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, cache),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`),
  }),
  fileFilter: (req, file, cb) => cb(null, file.mimetype.startsWith('image/')),
});

const findItem = (id) => inventory.find(i => i.id === parseInt(id));
const findItemIndex = (id) => inventory.findIndex(i => i.id === parseInt(id));

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: { title: 'Inventory API', version: '1.0.0', description: 'Inventory management service' },
    servers: [{ url: `http://${host || 'localhost'}:${port || 3000}` }]
  },
  apis: ['./server.js']
};
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerJsdoc(swaggerOptions)));

/**
 * @swagger
 * /register:
 *   post:
 *     summary: Register new inventory item
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               inventory_name: { type: string }
 *               description: { type: string }
 *               photo: { type: string, format: binary }
 *     responses:
 *       201: { description: Item created }
 *       400: { description: Bad request }
 */

app.post('/register', upload.single('photo'), (req, res) => {
  if (!req.body.inventory_name || !req.body.inventory_name.trim()) {
    return res.status(400).json({ error: 'Inventory name is required' });
  }
  const item = {
    id: nextId,
    inventory_name: req.body.inventory_name.trim(),
    description: req.body.description || '',
    photo: req.file ? req.file.filename : null,
    photo_url: req.file ? `/inventory/${nextId}/photo` : null,
  };
  inventory.push(item);
  nextId++;
  res.status(201).json(item);
});

/**
 * @swagger
 * /inventory:
 *   get:
 *     summary: Get all inventory items
 *     responses:
 *       200: { description: Success }
 */
app.get('/inventory', (req, res) => res.json(inventory));

/**
 * @swagger
 * /inventory/{id}:
 *   get:
 *     summary: Get item by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Success }
 *       404: { description: Not found }
 */
app.get('/inventory/:id', (req, res) => {
  const item = findItem(req.params.id);
  item ? res.json(item) : res.status(404).json({error:'Item not found'});
});

/**
 * @swagger
 * /inventory/{id}:
 *   put:
 *     summary: Update item
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               inventory_name: { type: string }
 *               description: { type: string }
 *               photo: { type: string, format: binary }
 *     responses:
 *       200: { description: Updated }
 *       404: { description: Not found }
 */
app.put('/inventory/:id', upload.single('photo'), (req, res) => {
  const index = findItemIndex(req.params.id);
  if (index === -1) return res.status(404).json({error:'Item not found'});
  const item = inventory[index];
  if (req.body.inventory_name) item.inventory_name = req.body.inventory_name.trim();
  if (req.body.description) item.description = req.body.description;
  if (req.file) {
    const oldPath = path.join(cache, item.photo || '');
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    item.photo = req.file.filename;
    item.photo_url = `/inventory/${item.id}/photo`;
  }
  res.json(item);
});

/**
 * @swagger
 * /inventory/{id}:
 *   delete:
 *     summary: Delete item
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       204: { description: Deleted }
 *       404: { description: Not found }
 */
app.delete('/inventory/:id', (req, res) => {
  const index = findItemIndex(req.params.id);
  if (index === -1) return res.status(404).json({error:'Item not found'});
  const item = inventory[index];
  if (item.photo) {
    const photoPath = path.join(cache, item.photo);
    if (fs.existsSync(photoPath)) fs.unlinkSync(photoPath);
  }
  inventory.splice(index, 1);
  res.status(204).send();
});

/**
 * @swagger
 * /inventory/{id}/photo:
 *   get:
 *     summary: Get item photo
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Photo file }
 *       404: { description: Not found }
 */
app.get('/inventory/:id/photo', (req, res) => {
  const item = findItem(req.params.id);
  if (!item || !item.photo) return res.status(404).json({error:'Photo not found'});
  res.sendFile(path.join(__dirname, cache, item.photo));
});

/**
 * @swagger
 * /search:
 *   post:
 *     summary: Search for items
 *     requestBody:
 *       required: true
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *             properties:
 *               id: { type: integer }
 *     responses:
 *       200: { description: Success }
 *       404: { description: Not found }
 */
app.get('/inventory', (req, res) => res.json(inventory));

app.get('/inventory/:id', (req, res) => {
  item ? res.json(item) : res.status(404).json({ error: 'Item not found' });
});

app.put('/inventory/:id', (req, res) => {
  const item = findItem(req.params.id);
  if (!item) return res.status(404).json({ error: 'Item not found' });
  const { inventory_name, description } = req.body;
  if (inventory_name !== undefined) item.inventory_name = inventory_name;
  if (description !== undefined) item.description = description;
  res.json(item);
});

app.get('/inventory/:id/photo', (req, res) => {
  const item = findItem(req.params.id);
  if (!item || !item.photo) return res.status(404).json({ error: 'Photo not found' });
  const photoPath = path.join(cache, item.photo);
  fs.existsSync(photoPath) ? res.sendFile(path.resolve(photoPath)) : res.status(404).json({ error: 'Photo file not found' });
});

app.put('/inventory/:id/photo', upload.single('photo'), (req, res) => {
  const item = findItem(req.params.id);
  if (!item) return res.status(404).json({ error: 'Item not found' });
  if (!req.file) return res.status(400).json({ error: 'Photo file is required' });
  if (item.photo) {
    const oldPhotoPath = path.join(cache, item.photo);
    if (fs.existsSync(oldPhotoPath)) fs.unlinkSync(oldPhotoPath);
  }
  item.photo = req.file.filename;
  item.photo_url = `/inventory/${req.params.id}/photo`;
  res.json(item);
});

app.delete('/inventory/:id', (req, res) => {
  const index = findItemIndex(req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Item not found' });
  const item = inventory[index];
  if (item.photo) {
    const photoPath = path.join(cache, item.photo);
    if (fs.existsSync(photoPath)) fs.unlinkSync(photoPath);
  }
  inventory.splice(index, 1);
  res.json({ message: 'Item deleted successfully' });
});

app.post('/search', (req, res) => {
  const item = findItem(req.body.id);
  if (!item) return res.status(404).json({ error: 'Item not found' });
  const result = { ...item };
  if (req.body.has_photo === 'on' && item.photo) {
    result.description = `${result.description || ''}\nPhoto: ${result.photo_url}`;
  }
  res.json(result);
});

app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerJsdoc(swaggerOptions)));
app.all('*', (req, res, next) => {
  if (res.headersSent) return next();
  const filePath = path.join(__dirname, req.path);
  if (req.path.endsWith('.html') && fs.existsSync(filePath)) {
    return res.sendFile(filePath);
  }
  res.status(405).json({ error: 'Method not allowed' });
});
app.listen(port, host, () => console.log(`Server running at http://${host}:${port}`));
