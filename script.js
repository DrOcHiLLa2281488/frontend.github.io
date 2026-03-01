// ============================================
// КОНФИГУРАЦИЯ
// ============================================
const CONFIG = {
    API_URL: 'https://script.google.com/macros/s/AKfycbxNGD1rnBlkIZUBFgzOW8f-ADydYd3ulLKndmHWiNhxbikzrQsScDNo0yaFAOy5zWfthA/exec',
    MANAGER_USERNAME: '@parfumdepo'
};

// ============================================
// ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
// ============================================
let TelegramWebApp;
let products = [];
let filteredProducts = [];
let cart = [];
let currentUser = null;
let sortDirection = 'asc';
let currentModalProduct = null;
let currentQuantity = 1;

// ============================================
// 1. ИНИЦИАЛИЗАЦИЯ TELEGRAM MINI APP
// ============================================
function initTelegramApp() {
    TelegramWebApp = window.Telegram.WebApp;
    TelegramWebApp.expand();
    currentUser = TelegramWebApp.initDataUnsafe.user;
    
    console.log('Пользователь:', currentUser);
    console.log('API URL:', CONFIG.API_URL);
    
    loadProducts();
    loadCart();
    setupEventListeners();
    showShopPage();
}

// ============================================
// 2. РАБОТА С API (с пагинацией)
// ============================================

// Размер страницы для загрузки товаров (можно настроить)
const PAGE_SIZE = 50;

async function loadProducts() {
    try {
        console.log('Загрузка товаров...');

        // 1. Получаем общее количество товаров
        const totalRes = await fetch(`${CONFIG.API_URL}?action=getTotalProducts`);
        if (!totalRes.ok) throw new Error(`HTTP error! status: ${totalRes.status}`);
        const totalData = await totalRes.json();

        if (!totalData.success) {
            throw new Error(totalData.error || 'Не удалось получить количество товаров');
        }

        const totalProducts = totalData.total;
        console.log(`Всего товаров: ${totalProducts}`);

        // 2. Загружаем все страницы последовательно
        let allProducts = [];
        let page = 1;
        let loaded = 0;

        while (loaded < totalProducts) {
            console.log(`Загрузка страницы ${page}...`);
            const pageRes = await fetch(
                `${CONFIG.API_URL}?action=getProductsPage&page=${page}&pageSize=${PAGE_SIZE}`
            );
            if (!pageRes.ok) throw new Error(`HTTP error! status: ${pageRes.status}`);
            const pageData = await pageRes.json();

            if (!pageData.success) {
                throw new Error(pageData.error || `Ошибка загрузки страницы ${page}`);
            }

            const pageProducts = pageData.data || [];
            allProducts = allProducts.concat(pageProducts);
            loaded += pageProducts.length;
            page++;

            // Можно добавить небольшой индикатор загрузки в консоль
            console.log(`Загружено ${loaded} из ${totalProducts}`);
        }

        console.log('Все товары загружены:', allProducts);
        products = allProducts;
        filteredProducts = [...products];
        renderProducts();

    } catch (error) {
        console.error('Ошибка загрузки товаров:', error);
        // Показываем тестовые данные при ошибке
        products = [
            {
                id: 1,
                name: "Тестовый парфюм",
                concentration: "Eau de Parfum",
                volume: "100 ml",
                price: 10000,
                image_url: "https://via.placeholder.com/300x200"
            }
        ];
        filteredProducts = [...products];
        renderProducts();
        showError('Не удалось загрузить каталог. Показаны тестовые данные.');
    }
}

// Функции корзины остаются без изменений
async function loadCart() {
    if (!currentUser?.id) return;
    
    try {
        const response = await fetch(`${CONFIG.API_URL}?sheet=Carts&user_id=${currentUser.id}`);
        const data = await response.json();
        
        if (data.success) {
            cart = data.data;
            updateCartUI();
        }
    } catch (error) {
        console.error('Ошибка загрузки корзины:', error);
        cart = [];
    }
}

async function saveCart() {
    if (!currentUser?.id) return;
    
    try {
        await fetch(CONFIG.API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'UPDATE_CART',
                user_id: currentUser.id,
                cart: cart
            })
        });
    } catch (error) {
        console.error('Ошибка сохранения корзины:', error);
    }
}
// ============================================
// 3. РЕНДЕРИНГ
// ============================================
function renderProducts() {
    const container = document.getElementById('catalog');
    
    if (filteredProducts.length === 0) {
        container.innerHTML = `
            <div class="empty-cart">
                😕 Товары не найдены<br>
                <small>Попробуйте другой запрос</small>
            </div>
        `;
        return;
    }
    
    container.innerHTML = filteredProducts.map(product => `
        <div class="product-card" data-id="${product.id}">
            <img src="${product.image_url || 'https://via.placeholder.com/300x200?text=No+Image'}" 
                 alt="${product.name}" 
                 class="product-image">
            <div class="product-info">
                <div class="product-name">${product.name}</div>
                <div class="product-details">
                    ${product.concentration} • ${product.volume}
                </div>
                <div class="product-price">
                    ${formatPrice(product.price)} ₽
                </div>
            </div>
        </div>
    `).join('');
    
    document.querySelectorAll('.product-card').forEach(card => {
        card.addEventListener('click', () => {
            const productId = parseInt(card.dataset.id);
            const product = products.find(p => p.id === productId);
            if (product) openProductModal(product);
        });
    });
}

function openProductModal(product) {
    currentModalProduct = product;
    currentQuantity = 1;
    
    document.getElementById('modalImage').src = product.image_url || 'https://via.placeholder.com/300x200?text=No+Image';
    document.getElementById('modalName').textContent = product.name;
    document.getElementById('modalConcentration').textContent = product.concentration;
    document.getElementById('modalVolume').textContent = product.volume;
    document.getElementById('modalPrice').textContent = formatPrice(product.price) + ' ₽';
    document.getElementById('currentQty').textContent = currentQuantity;
    
    document.getElementById('productModal').style.display = 'flex';
}

function closeProductModal() {
    document.getElementById('productModal').style.display = 'none';
    currentModalProduct = null;
}

function updateCartUI() {
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    document.getElementById('cartCount').textContent = totalItems;
    
    const container = document.getElementById('cartItems');
    
    if (cart.length === 0) {
        container.innerHTML = `
            <div class="empty-cart">
                🛒 Корзина пуста<br>
                <small>Добавьте товары из каталога</small>
            </div>
        `;
        return;
    }
    
    container.innerHTML = cart.map(item => {
        const product = products.find(p => p.id === item.id);
        if (!product) return '';
        
        const total = product.price * item.quantity;
        
        return `
            <div class="cart-item" data-id="${product.id}">
                <div class="cart-item-info">
                    <h4>${product.name}</h4>
                    <div class="cart-item-details">
                        ${product.concentration} • ${product.volume}
                    </div>
                    <div class="product-price">
                        ${formatPrice(product.price)} ₽ × ${item.quantity} = 
                        <strong>${formatPrice(total)} ₽</strong>
                    </div>
                </div>
                <div class="cart-item-actions">
                    <button class="copy-btn" onclick="copyProductData(${product.id})">
                        📋 Данные
                    </button>
                    <button class="remove-btn" onclick="removeFromCart(${product.id})">
                        ✕ Удалить
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// ============================================
// 4. ФУНКЦИОНАЛ КОРЗИНЫ
// ============================================
function addToCart() {
    if (!currentModalProduct) return;
    
    const existingItem = cart.find(item => item.id === currentModalProduct.id);
    
    if (existingItem) {
        existingItem.quantity += currentQuantity;
    } else {
        cart.push({
            id: currentModalProduct.id,
            quantity: currentQuantity
        });
    }
    
    saveCart();
    updateCartUI();
    closeProductModal();
    showNotification(`Добавлено в корзину: ${currentModalProduct.name}`);
}

function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    saveCart();
    updateCartUI();
}

function copyProductData(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    
    const text = `
${product.name}
Концентрация: ${product.concentration}
Объем: ${product.volume}
Цена: ${formatPrice(product.price)} ₽
    `.trim();
    
    navigator.clipboard.writeText(text)
        .then(() => showNotification('Данные скопированы!'))
        .catch(() => showNotification('Ошибка копирования'));
}

function copyAllOrder() {
    if (cart.length === 0) {
        showNotification('Корзина пуста!');
        return;
    }
    
    let text = `ЗАКАЗ #${Date.now()}\n\n`;
    let total = 0;
    
    cart.forEach(item => {
        const product = products.find(p => p.id === item.id);
        if (!product) return;
        
        const itemTotal = product.price * item.quantity;
        total += itemTotal;
        
        text += `
${product.name}
${product.concentration} • ${product.volume}
${item.quantity} × ${formatPrice(product.price)} ₽ = ${formatPrice(itemTotal)} ₽
-------------------------
        `.trim() + '\n';
    });
    
    text += `\nИТОГО: ${formatPrice(total)} ₽`;
    text += `\n\nПользователь: ${currentUser?.first_name || 'Неизвестно'}`;
    
    navigator.clipboard.writeText(text)
        .then(() => showNotification('Весь заказ скопирован!'))
        .catch(() => showNotification('Ошибка копирования'));
}

function checkout() {
    if (cart.length === 0) {
        showNotification('Добавьте товары в корзину!');
        return;
    }
    
    saveCart();
    const url = `https://t.me/${CONFIG.MANAGER_USERNAME.replace('@', '')}?start=${currentUser?.id || '0'}`;
    TelegramWebApp.openTelegramLink(url);
}

// ============================================
// 5. ПОИСК И СОРТИРОВКА
// ============================================
function searchProducts(query) {
    const searchTerm = query.toLowerCase().trim();
    
    if (!searchTerm) {
        filteredProducts = [...products];
    } else {
        filteredProducts = products.filter(product =>
            product.name.toLowerCase().includes(searchTerm) ||
            product.concentration.toLowerCase().includes(searchTerm)
        );
    }
    
    sortProducts();
}

function sortProducts() {
    filteredProducts.sort((a, b) => {
        const priceA = parseFloat(a.price) || 0;
        const priceB = parseFloat(b.price) || 0;
        
        return sortDirection === 'asc' ? priceA - priceB : priceB - priceA;
    });
    
    renderProducts();
    
    const btn = document.getElementById('sortButton');
    btn.textContent = `Фильтр: По цене ${sortDirection === 'asc' ? '↑' : '↓'}`;
}

function toggleSort() {
    sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    sortProducts();
}

// ============================================
// 6. НАВИГАЦИЯ
// ============================================
function showShopPage() {
    document.getElementById('catalog').style.display = 'grid';
    document.getElementById('cartPage').style.display = 'none';
    document.getElementById('shopTab').classList.add('active');
    document.getElementById('cartTab').classList.remove('active');
}

function showCartPage() {
    document.getElementById('catalog').style.display = 'none';
    document.getElementById('cartPage').style.display = 'block';
    document.getElementById('shopTab').classList.remove('active');
    document.getElementById('cartTab').classList.add('active');
}

// ============================================
// 7. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================
function formatPrice(price) {
    return parseInt(price).toLocaleString('ru-RU');
}

function showError(message) {
    TelegramWebApp.showAlert(message);
}

function showNotification(message) {
    TelegramWebApp.showAlert(message);
}

// ============================================
// 8. НАСТРОЙКА СОБЫТИЙ
// ============================================
function setupEventListeners() {
    // Поиск
    document.getElementById('searchInput').addEventListener('input', (e) => {
        searchProducts(e.target.value);
    });
    
    // Сортировка
    document.getElementById('sortButton').addEventListener('click', toggleSort);
    
    // Модальное окно
    document.getElementById('increaseQty').addEventListener('click', () => {
        currentQuantity++;
        document.getElementById('currentQty').textContent = currentQuantity;
    });
    
    document.getElementById('decreaseQty').addEventListener('click', () => {
        if (currentQuantity > 1) {
            currentQuantity--;
            document.getElementById('currentQty').textContent = currentQuantity;
        }
    });
    
    document.getElementById('addToCartBtn').addEventListener('click', addToCart);
    document.getElementById('closeModal').addEventListener('click', closeProductModal);
    
    document.getElementById('productModal').addEventListener('click', (e) => {
        if (e.target.id === 'productModal') closeProductModal();
    });
    
    // Навигация
    document.getElementById('shopTab').addEventListener('click', showShopPage);
    document.getElementById('cartTab').addEventListener('click', showCartPage);
    document.getElementById('backToShop').addEventListener('click', showShopPage);
    
    // Корзина
    document.getElementById('copyAllBtn').addEventListener('click', copyAllOrder);
    document.getElementById('checkoutBtn').addEventListener('click', checkout);
}

// ============================================
// 9. ЗАПУСК ПРИЛОЖЕНИЯ
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    if (window.Telegram?.WebApp) {
        initTelegramApp();
    } else {
        console.log('Режим разработки');
        currentUser = { id: 99999, first_name: 'Тест' };
        loadProducts();
        setupEventListeners();
        showShopPage();
    }
});

// ============================================
// ДОПОЛНИТЕЛЬНАЯ ФУНКЦИЯ В script.js
// ============================================

// Добавьте в функцию initTelegramApp():
async function checkAdminStatus() {
    if (!currentUser?.id) return false;
    
    try {
        const response = await fetch(`${CONFIG.API_URL}?action=CHECK_ADMIN&user_id=${currentUser.id}`);
        const data = await response.json();
        return data.isAdmin || false;
    } catch (error) {
        console.error('Ошибка проверки админа:', error);
        return false;
    }
}

// Можно добавить кнопку админа в интерфейс
async function setupAdminFeatures() {
    const isAdmin = await checkAdminStatus();
    
    if (isAdmin) {
        // Добавляем скрытую кнопку админа
        const adminBtn = document.createElement('button');
        adminBtn.className = 'admin-btn';
        adminBtn.innerHTML = '⚙️ Админ';
        adminBtn.style.position = 'fixed';
        adminBtn.style.top = '10px';
        adminBtn.style.right = '10px';
        adminBtn.style.zIndex = '10000';
        adminBtn.style.padding = '8px 12px';
        adminBtn.style.background = '#ff6b6b';
        adminBtn.style.color = 'white';
        adminBtn.style.border = 'none';
        adminBtn.style.borderRadius = '20px';
        adminBtn.style.cursor = 'pointer';
        
        adminBtn.addEventListener('click', () => {
            TelegramWebApp.openTelegramLink(`https://t.me/${bot_username}?start=admin`);
        });
        
        document.body.appendChild(adminBtn);
    }
}

// И вызовите в initTelegramApp():
async function initTelegramApp() {
    TelegramWebApp = window.Telegram.WebApp;
    TelegramWebApp.expand();
    currentUser = TelegramWebApp.initDataUnsafe.user;
    
    console.log('Пользователь:', currentUser);
    
    // Проверяем админ-права
    await setupAdminFeatures();
    
    loadProducts();
    loadCart();
    setupEventListeners();
    showShopPage();
}

// Убедитесь, что функции доступны глобально
window.copyProductData = copyProductData;
window.removeFromCart = removeFromCart;
