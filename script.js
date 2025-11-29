// frontend/script.js (основные изменения)
// Убираем Supabase и используем только localStorage + Telegram Web App

let products = [];
let cart = JSON.parse(localStorage.getItem('cart')) || [];
let sortAscending = true;
let currentUser = null;

// Инициализация приложения
Telegram.WebApp.ready();
Telegram.WebApp.expand();

// Получаем данные пользователя из Telegram
const tgUser = Telegram.WebApp.initDataUnsafe.user;
currentUser = tgUser ? {
    id: tgUser.id,
    username: tgUser.username,
    firstName: tgUser.first_name,
    lastName: tgUser.last_name
} : null;

// Загружаем товары
loadProducts();

// Загрузка товаров (статичные данные или с API)
async function loadProducts() {
    // В реальном приложении можно загружать с API
    // Для демо используем статические данные
    products = [
        {
            id: 1,
            name: 'Baccarat Rouge 540',
            concentration: 'Extrait de Parfum',
            volume: '70ml',
            price: 28900,
            image: 'https://images.unsplash.com/photo-1547887537-6158d64c35b3?w=400'
        },
        {
            id: 2,
            name: 'Creed Aventus',
            concentration: 'Edu de Parfum',
            volume: '100ml',
            price: 21500,
            image: 'https://images.unsplash.com/photo-1585386959984-a4155224a1ad?w=400'
        },
        {
            id: 3,
            name: 'Le Labo Santal 33',
            concentration: 'Edu de Parfum',
            volume: '50ml',
            price: 15600,
            image: 'https://images.unsplash.com/photo-1590736969955-1d0c72c4222f?w=400'
        },
        {
            id: 4,
            name: 'Tom Ford Noir',
            concentration: 'Edu de Parfum',
            volume: '100ml',
            price: 12400,
            image: 'https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?w=400'
        }
    ];
    
    renderProducts();
}

// Добавление товара в корзину
async function addToCart(productId) {
    const product = products.find(p => p.id === productId);
    const existingItem = cart.find(item => item.id === productId);
    
    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({ ...product, quantity: 1 });
    }
    
    saveCart();
    
    // Отправляем данные в бот через Telegram Web App
    try {
        Telegram.WebApp.sendData(JSON.stringify({
            action: 'add_to_cart',
            product_id: productId
        }));
    } catch (error) {
        console.log('Data sent to bot');
    }
    
    Telegram.WebApp.showPopup({
        title: 'Успех',
        message: 'Товар добавлен в корзину!'
    });
    
    renderCart();
}

// Сохранение корзины в localStorage
function saveCart() {
    localStorage.setItem('cart', JSON.stringify(cart));
}

// Отображение товаров
function renderProducts(productsToRender = products) {
    const container = document.getElementById('products-container');
    const loading = document.getElementById('loading');
    
    loading.classList.add('hidden');
    
    container.innerHTML = productsToRender.map(product => `
        <div class="product-card">
            <img src="${product.image}" alt="${product.name}" class="product-image" 
                 onerror="this.src='https://images.unsplash.com/photo-1547887537-6158d64c35b3?w=400'">
            <h3>${product.name}</h3>
            <p>Концентрация: ${product.concentration}</p>
            <p>Объем: ${product.volume}</p>
            <div class="product-price">${formatPrice(product.price)} руб.</div>
            <button class="add-to-cart" onclick="addToCart(${product.id})">
                🛒 Добавить в корзину
            </button>
        </div>
    `).join('');
}

// Отображение корзины
function renderCart() {
    const container = document.getElementById('cart-items');
    const loading = document.getElementById('cart-loading');
    const totalElement = document.getElementById('cart-total');
    
    loading.classList.add('hidden');
    
    if (cart.length === 0) {
        container.innerHTML = '<div class="loading">Корзина пуста</div>';
        totalElement.textContent = '';
        return;
    }
    
    container.innerHTML = cart.map(item => `
        <div class="cart-item">
            <h4>${item.name}</h4>
            <p>${item.concentration} • ${item.volume}</p>
            <p>Количество: 
                <button onclick="updateQuantity(${item.id}, -1)">-</button>
                ${item.quantity}
                <button onclick="updateQuantity(${item.id}, 1)">+</button>
            </p>
            <div class="product-price">${formatPrice(item.price * item.quantity)} руб.</div>
            <button class="copy-btn" onclick="copyProductData(${item.id})">
                📋 Скопировать данные
            </button>
            <button class="remove-btn" onclick="removeFromCart(${item.id})" style="background: #dc3545; margin-left: 10px;">
                🗑️ Удалить
            </button>
        </div>
    `).join('');
    
    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    totalElement.textContent = `Итого: ${formatPrice(total)} руб.`;
}

// Обновление количества товара
function updateQuantity(productId, change) {
    const item = cart.find(item => item.id === productId);
    if (item) {
        item.quantity += change;
        if (item.quantity <= 0) {
            cart = cart.filter(item => item.id !== productId);
        }
        saveCart();
        renderCart();
    }
}

// Удаление товара из корзины
function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    saveCart();
    renderCart();
}

// Форматирование цены
function formatPrice(price) {
    return new Intl.NumberFormat('ru-RU').format(price);
}

// Копирование данных товара
async function copyProductData(productId) {
    const product = products.find(p => p.id === productId);
    const text = `${product.name} | ${product.concentration} | ${product.volume} | ${formatPrice(product.price)} руб.`;
    
    try {
        await navigator.clipboard.writeText(text);
        Telegram.WebApp.showPopup({
            title: 'Успех',
            message: 'Данные товара скопированы!'
        });
    } catch (error) {
        console.error('Copy failed:', error);
    }
}

// Оформление заказа
function checkout() {
    if (cart.length === 0) {
        Telegram.WebApp.showPopup({
            title: 'Корзина пуста',
            message: 'Добавьте товары в корзину'
        });
        return;
    }
    
    const orderText = cart.map(item => 
        `${item.name} (${item.concentration}, ${item.volume}) - ${item.quantity} шт. - ${formatPrice(item.price * item.quantity)} руб.`
    ).join('\n');
    
    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const userInfo = currentUser ? 
        `Пользователь: ${currentUser.firstName} ${currentUser.lastName} (@${currentUser.username})` : 
        'Пользователь: Не идентифицирован';
    
    const message = `НОВЫЙ ЗАКАЗ из ParfumDEPO\n\n${userInfo}\n\n${orderText}\n\n💰 ИТОГО: ${formatPrice(total)} руб.`;
    
    Telegram.WebApp.openTelegramLink(`https://t.me/${CONFIG.MANAGER_USERNAME}?text=${encodeURIComponent(message)}`);
}

// Остальные функции остаются такими же как в предыдущей версии
// (toggleSort, showCart, showMainPage, поиск и т.д.)
