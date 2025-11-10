# Використовуємо офіційний образ Node.js
FROM node:18-alpine

# Встановлюємо робочу директорію
WORKDIR /app

# Копіюємо package*.json файли
COPY package*.json ./

# Встановлюємо залежності
RUN npm ci --only=production

# Копіюємо решту файлів проекту
COPY . .

# Створюємо директорію для кешу
RUN mkdir -p /app/cache

# Відкриваємо порт
EXPOSE 3000

# Запускаємо додаток
CMD ["node", "server.js", "--host", "0.0.0.0", "--port", "3000", "--cache", "./cache"]
