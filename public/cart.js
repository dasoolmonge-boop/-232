// Модуль корзины
const cart = {
    items: [],

    // Добавить товар
    addItem(bouquet) {
        const existingItem = this.items.find(item => item.id === bouquet.id);

        if (existingItem) {
            existingItem.quantity += 1;
        } else {
            this.items.push({
                ...bouquet,
                quantity: 1
            });
        }

        this.updateBadge();
        this.render();
        this.saveToStorage();

        showToast(`${bouquet.name} добавлен в корзину`, 'success');
    },

    // Удалить товар
    removeItem(bouquetId) {
        const index = this.items.findIndex(item => item.id === bouquetId);
        if (index !== -1) {
            const bouquet = this.items[index];
            this.items.splice(index, 1);
            showToast(`${bouquet.name} удален из корзины`, 'warning');
        }

        this.updateBadge();
        this.render();
        this.saveToStorage();
    },

    // Получить общую сумму
    getTotalPrice() {
        return this.items.reduce((sum, item) => sum + ((item.price - (item.discount || 0)) * item.quantity), 0);
    },

    // Обновить счетчик на иконке
    updateBadge() {
        const badge = document.getElementById('cartBadge');
        const count = this.items.reduce((sum, item) => sum + item.quantity, 0);
        badge.textContent = count;
        badge.style.display = count > 0 ? 'flex' : 'none';
    },

    // Отрисовать корзину
    render() {
        const cartItems = document.getElementById('cartItems');
        const totalPrice = this.getTotalPrice();

        if (this.items.length === 0) {
            cartItems.innerHTML = `
                <div class="empty-cart">
                    <i class="fas fa-shopping-cart" style="font-size: 48px; opacity: 0.3;"></i>
                    <p style="margin-top: 16px; color: var(--tg-hint);">Корзина пуста</p>
                    <p style="margin-top: 8px; font-size: 14px; color: var(--tg-hint);">Добавьте букеты из каталога</p>
                </div>
            `;
            tg.MainButton.hide();
        } else {
            cartItems.innerHTML = this.items.map(item => `
                <div class="cart-item" data-id="${item.id}">
                    <img src="${item.photo}" alt="${item.name}" class="cart-item-image"
                         onerror="this.src='https://via.placeholder.com/60?text=Букет'">
                    <div class="cart-item-info">
                        <div class="cart-item-name">${item.name}</div>
                        <div class="cart-item-price">${item.price - (item.discount || 0)} ₽ × ${item.quantity}</div>
                    </div>
                    <button class="remove-item" onclick="cart.removeItem(${item.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `).join('');
        }

        document.getElementById('cartTotalPrice').textContent = `${totalPrice} ₽`;

        // Обновляем MainButton Telegram
        if (this.items.length > 0 &&
            document.getElementById('cartPanel').classList.contains('open') &&
            !document.getElementById('checkoutModal').classList.contains('open')) {
            tg.MainButton.setText(`ОФОРМИТЬ ЗАКАЗ (${totalPrice} ₽)`);
            tg.MainButton.show();
            tg.MainButton.offClick();
            tg.MainButton.onClick(() => openCheckoutModal());
        } else if (!document.getElementById('checkoutModal').classList.contains('open')) {
            tg.MainButton.hide();
        }
    },

    // Очистить корзину
    clear() {
        this.items = [];
        this.updateBadge();
        this.render();
        this.saveToStorage();
        tg.MainButton.hide();
    },

    // Сохранить в localStorage
    saveToStorage() {
        localStorage.setItem('cart', JSON.stringify(this.items));
    },

    // Загрузить из localStorage
    loadFromStorage() {
        const saved = localStorage.getItem('cart');
        if (saved) {
            try {
                this.items = JSON.parse(saved);
                this.updateBadge();
                this.render();
            } catch (e) {
                console.error('Ошибка загрузки корзины:', e);
                this.items = [];
            }
        }
    }
};

// Инициализация корзины
cart.loadFromStorage();

// Функция открытия модального окна оформления заказа
function openCheckoutModal() {
    const modal = document.getElementById('checkoutModal');
    const summary = document.getElementById('orderSummary');

    tg.MainButton.hide();

    let summaryHtml = '<div class="summary-items">';
    cart.items.forEach(item => {
        summaryHtml += `
            <div class="summary-item">
                <span>${item.name} × ${item.quantity}</span>
                <span>${(item.price - (item.discount || 0)) * item.quantity} ₽</span>
            </div>
        `;
    });
    summaryHtml += '</div>';
    summaryHtml += `
        <div class="summary-total">
            <span>Итого:</span>
            <span>${cart.getTotalPrice()} ₽</span>
        </div>
    `;

    summary.innerHTML = summaryHtml;

    if (user.first_name) {
        document.getElementById('name').value = user.first_name || '';
    }

    modal.classList.add('open');

    if (tg.HapticFeedback) {
        tg.HapticFeedback.impactOccurred('medium');
    }
}

// Обработка отправки формы заказа
document.getElementById('orderForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('name').value.trim();
    const phone = document.getElementById('phone').value.trim();
    const address = document.getElementById('address').value.trim();
    const deliveryDate = document.getElementById('deliveryDate').value.trim();
    const deliveryTime = document.getElementById('deliveryTime').value.trim();
    const wish = document.getElementById('wish').value.trim();

    if (!name || !phone || !address || !deliveryDate || !deliveryTime) {
        showToast('Пожалуйста, заполните все поля', 'error');
        return;
    }

    const submitBtn = e.target.querySelector('.submit-order');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Отправка...';

    const orderData = {
        name,
        phone,
        address,
        deliveryDate,
        deliveryTime,
        wish: wish || 'Без пожеланий',
        cart: cart.items,
        totalPrice: cart.getTotalPrice(),
        userId: user.id || 0,
        username: user.username || ''
    };

    try {
        const response = await fetch('/api/orders', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(orderData)
        });

        const result = await response.json();

        if (result.success) {
            showToast('✅ Заказ успешно оформлен!', 'success');
            showToast('💐 Букеты скрыты из каталога', 'info');

            cart.clear();
            document.getElementById('checkoutModal').classList.remove('open');
            e.target.reset();

            if (tg.HapticFeedback) {
                tg.HapticFeedback.notificationOccurred('success');
            }

            // Перезагружаем список букетов, чтобы скрытые исчезли
            loadBouquets();

            tg.MainButton.setText('ЗАКРЫТЬ');
            tg.MainButton.offClick();
            tg.MainButton.onClick(() => tg.close());
            tg.MainButton.show();
        } else {
            throw new Error('Ошибка при отправке');
        }
    } catch (error) {
        console.error('Ошибка:', error);
        showToast('❌ Ошибка при оформлении заказа', 'error');

        if (tg.HapticFeedback) {
            tg.HapticFeedback.notificationOccurred('error');
        }
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Подтвердить заказ';
    }
});

// Закрытие модального окна
document.getElementById('closeModal').addEventListener('click', () => {
    document.getElementById('checkoutModal').classList.remove('open');
    if (cart.items.length > 0 && document.getElementById('cartPanel').classList.contains('open')) {
        tg.MainButton.setText(`ОФОРМИТЬ ЗАКАЗ (${cart.getTotal()} ₽)`);
        tg.MainButton.offClick();
        tg.MainButton.onClick(() => openCheckoutModal());
        tg.MainButton.show();
    } else {
        tg.MainButton.hide();
    }
});

document.getElementById('checkoutModal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('checkoutModal')) {
        e.target.classList.remove('open');
        if (cart.items.length > 0 && document.getElementById('cartPanel').classList.contains('open')) {
            tg.MainButton.setText(`ОФОРМИТЬ ЗАКАЗ (${cart.getTotal()} ₽)`);
            tg.MainButton.offClick();
            tg.MainButton.onClick(() => openCheckoutModal());
            tg.MainButton.show();
        } else {
            tg.MainButton.hide();
        }
    }
});

// Обработка открытия корзины
document.getElementById('cartIcon').addEventListener('click', () => {
    document.getElementById('cartPanel').classList.add('open');
    cart.render();
});

// Закрытие корзины
document.getElementById('closeCart').addEventListener('click', () => {
    document.getElementById('cartPanel').classList.remove('open');
    tg.MainButton.hide();
});

// Форматирование телефона
document.getElementById('phone').addEventListener('input', (e) => {
    let input = e.target.value.replace(/\D/g, '');
    if (!input) {
        e.target.value = '';
        return;
    }
    
    let isPlus = e.target.value.startsWith('+');
    let formatted = isPlus ? '+' : '';
    
    if (['7', '8', '9'].indexOf(input[0]) > -1) {
        if (input[0] === '9') input = '7' + input;
        let firstDigit = (input[0] === '8') ? '8' : '+7';
        formatted = firstDigit + ' ';
        
        if (input.length > 1) {
            formatted += '(' + input.substring(1, 4);
        }
        if (input.length >= 5) {
            formatted += ') ' + input.substring(4, 7);
        }
        if (input.length >= 8) {
            formatted += '-' + input.substring(7, 9);
        }
        if (input.length >= 10) {
            formatted += '-' + input.substring(9, 11);
        }
    } else {
        formatted = '+' + input.substring(0, 16);
    }
    
    e.target.value = formatted;
});
// �������� HTML ������ ���� ������� � Telegram (����� �� ���� 2 ������)
if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.platform !== 'unknown') {
    document.getElementById('checkoutBtn').style.display = 'none';
    const cartTotal = document.querySelector('.cart-total');
    if (cartTotal) cartTotal.style.marginBottom = '0';
}
