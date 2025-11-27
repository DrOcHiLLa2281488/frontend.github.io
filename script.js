// frontend/script.js
let products = [];
let cart = [];
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

// Загружаем данные
Promise.all([loadProducts(), loadCart()]).then(() => {
    renderProducts();
    renderCart();
});

// Загрузка товаров из Supabase
async function loadProducts() {
    try {
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .order('price');
        
        if (error) throw error;
        products = data;
    } catch (error) {
        console.error('Error loading products:', error);
        showError('Ошибка загрузки товаров');
    }
}

// Загрузка корзины пользователя
async function loadCart() {
    if (!currentUser) return;
    
    try {
        const { data, error } = await supabase
            .from('carts')
            .select(`
                quantity,
                products (*)
            `)
            .eq('user_id', currentUser.id);
        
        if (error) throw error;
        
        cart = data.map(item => ({
            ...item.products,
            quantity: item.quantity
        }));
    } catch (error) {
        console.error('Error loading cart:', error);
    }
}

// Добавление товара в корзину
async function addToCart(productId) {
    if (!currentUser) {
        Telegram.WebApp.showPopup({
            title: 'Ошибка',
            message: 'Не удалось идентифицировать пользователя'
        });
        return;
    }

    try {
        const { error } = await supabase
            .from('carts')
            .upsert({
                user_id: currentUser.id,
                product_id: productId,
                quantity: 1
            }, {
                onConflict: 'user_id,product_id'
            });

        if (error) throw error;

        // Обновляем локальную корзину
        const product = products.find(p => p.id === productId);
        const existingItem = cart.find(item => item.id === productId);
        
        if (existingItem) {
            existingItem.quantity += 1;
        } else {
            cart.push({ ...product, quantity: 1 });
        }

        Telegram.WebApp.showPopup({
            title: 'Успех',
            message: 'Товар добавлен в корзину!'
        });
        
        renderCart();
    } catch (error) {
        console.error('Error adding to cart:', error);
        Telegram.WebApp.showPopup({
            title: 'Ошибка',
            message: 'Не удалось добавить товар в корзину'
        });
    }
}

// Отображение товаров
function renderProducts(productsToRender = products) {
    const container = document.getElementById('products-container');
    const loading = document.getElementById('loading');
    
    loading.classList.add('hidden');
    
    container.innerHTML = productsToRender.map(product => `
        <div class="product-card">
            <img src="${product.image_url}" alt="${product.name}" class="product-image" 
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
            <p>Количество: ${item.quantity}</p>
            <div class="product-price">${formatPrice(item.price * item.quantity)} руб.</div>
            <button class="copy-btn" onclick="copyProductData(${item.id})">
                📋 Скопировать данные
            </button>
        </div>
    `).join('');
    
    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    totalElement.textContent = `Итого: ${formatPrice(total)} руб.`;
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

// Фильтрация по цене
function toggleSort() {
    sortAscending = !sortAscending;
    const sortText = document.getElementById('sort-text');
    
    products.sort((a, b) => sortAscending ? a.price - b.price : b.price - a.price);
    sortText.textContent = sortAscending ? 'Фильтр по цене ↑' : 'Фильтр по цене ↓';
    
    renderProducts();
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
    
    Telegram.WebApp.openTelegramLink(`https://t.me/parfumdepo?text=${encodeURIComponent(message)}`);
}

// Навигация
function showCart() {
    document.getElementById('main-page').style.display = 'none';
    document.getElementById('cart-page').style.display = 'block';
    renderCart();
}

function showMainPage() {
    document.getElementById('cart-page').style.display = 'none';
    document.getElementById('main-page').style.display = 'block';
}

// Поиск
document.getElementById('search').addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase().trim();
    
    if (!term) {
        renderProducts();
        return;
    }
    
    const filtered = products.filter(p => 
        p.name.toLowerCase().includes(term) ||
        p.concentration.toLowerCase().includes(term)
    );
    
    renderProducts(filtered);
});

// Обработка ошибок
function showError(message) {
    Telegram.WebApp.showPopup({
        title: 'Ошибка',
        message: message
    });
}

// Добавляем кнопку корзины в интерфейс
document.addEventListener('DOMContentLoaded', function() {
    const header = document.querySelector('.header');
    const cartButton = document.createElement('button');
    cartButton.className = 'filter-btn';
    cartButton.innerHTML = '🛒 Корзина';
    cartButton.onclick = showCart;
    cartButton.style.marginLeft = '10px';
    
    document.querySelector('.filters').appendChild(cartButton);
});
