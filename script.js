// ИНИЦИАЛИЗАЦИЯ TELEGRAM MINI APP
async function initTelegramApp() {
  TelegramWebApp.expand();
  currentUser = TelegramWebApp.initDataUnsafe.user;
  console.log('Пользователь:', currentUser);
  await loadProducts();
  await loadCart();
  setupEventListeners();
  showShopPage();
}

// ЗАГРУЗКА ТОВАРОВ ИЗ БАЗЫ ДАННЫХ
async function loadProducts() {
  try {
    showLoading(true);
    console.log('Загружаю товары из базы данных...');
    const response = await fetch(`${https://script.google.com/macros/s/AKfycbyLVob52SMoiw2gAj_cBXNPA-hNoWt3YDOgA7dBPkQLAsYGldcDsPW1njD7rCInK7tVlQ/exec}?sheet=Products`);
    if (!response.ok) throw new Error(`HTTP ошибка: ${response.status}`);
    const data = await response.json();
    if (data.success) {
      products = data.data || [];
      products.forEach((product, index) => product.id = product.id || index + 1);
      console.log(`Успешно загружено ${products.length} товаров`);
      if (products.length === 0) {
        showError('Каталог товаров пуст. Добавьте товары в Google Sheets.');
        return;
      }
      filteredProducts = [...products];
      renderProducts();
    } else {
      throw new Error(data.error || 'Ошибка при загрузке данных');
    }
  } catch (error) {
    console.error('Ошибка загрузки товаров:', error);
    showError('Не удалось загрузить каталог. Проверьте подключение к интернету.');
  } finally {
    showLoading(false);
  }
}

// ЗАГРУЗКА КОРЗИНЫ ПОЛЬЗОВАТЕЛЯ
async function loadCart() {
  if (!currentUser?.id) {
    console.log('Пользователь не идентифицирован, создаем временную корзину');
