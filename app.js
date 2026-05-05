import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// Configurações do Supabase
const SUPABASE_URL = 'https://roentrqqalhihsunpjam.supabase.com';
// IMPORTANTE: Chave pública (anon key) do Supabase
const SUPABASE_ANON_KEY = 'sb_publishable_tqiWKg24HAIEJH6yhOyTCQ_Sq3tAj8p';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Elementos do DOM
const addItemForm = document.getElementById('add-item-form');
const itemNameInput = document.getElementById('item-name');
const itemCategoryInput = document.getElementById('item-category');
const listsContainer = document.getElementById('lists-container');
const connectionStatus = document.getElementById('connection-status');
const statusDot = connectionStatus.querySelector('.dot');
const statusText = connectionStatus.querySelector('span');

// Estado
let items = [];

// Inicialização
async function init() {
    await loadInitialData();
    setupRealtime();
}

// Carregar Dados Iniciais
async function loadInitialData() {
    try {
        const { data, error } = await supabase
            .from('items')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        items = data || [];
        statusDot.className = 'dot green';
        statusText.textContent = 'Conectado';
        renderList();
    } catch (error) {
        console.error("Erro ao carregar lista do Supabase:", error.message);
        statusDot.className = 'dot red';
        statusText.textContent = 'Erro de Conexão';
    }
}

// Configurar Tempo Real (Realtime)
function setupRealtime() {
    supabase
        .channel('public:items')
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'items' },
            (payload) => {
                if (payload.eventType === 'INSERT') {
                    // Evita adicionar duplicado caso a assinatura retorne depois do load inicial
                    if (!items.find(i => i.id === payload.new.id)) {
                        items.unshift(payload.new);
                    }
                } else if (payload.eventType === 'UPDATE') {
                    items = items.map(item => item.id === payload.new.id ? payload.new : item);
                } else if (payload.eventType === 'DELETE') {
                    items = items.filter(item => item.id !== payload.old.id);
                }
                renderList();
            }
        )
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                console.log("Supabase Realtime conectado!");
            }
        });
}

// Adicionar Item
addItemForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = itemNameInput.value.trim();
    const category = itemCategoryInput.value;
    
    if (!name) return;

    try {
        const { error } = await supabase
            .from('items')
            .insert([{
                name: name,
                category: category,
                completed: false
                // created_at é gerado automaticamente pelo Postgres
            }]);
            
        if (error) throw error;

        itemNameInput.value = '';
        itemNameInput.focus();
    } catch (error) {
        console.error("Erro ao adicionar item:", error.message);
        alert("Não foi possível adicionar o item. Verifique a conexão.");
    }
});

// Alternar Status (Comprado/Não Comprado)
window.toggleItem = async (id, currentStatus) => {
    try {
        const { error } = await supabase
            .from('items')
            .update({ completed: !currentStatus })
            .eq('id', id);

        if (error) throw error;
    } catch (error) {
        console.error("Erro ao atualizar item:", error.message);
    }
};

// Deletar Item
window.deleteItem = async (id) => {
    if (!confirm("Tem certeza que deseja excluir este item?")) return;
    
    try {
        const { error } = await supabase
            .from('items')
            .delete()
            .eq('id', id);

        if (error) throw error;
    } catch (error) {
        console.error("Erro ao deletar item:", error.message);
    }
};

// Renderizar UI
function renderList() {
    if (items.length === 0) {
        listsContainer.innerHTML = `
            <div class="empty-state">
                <i class="ri-shopping-basket-line"></i>
                <p>A lista está vazia. Adicione alguns itens acima!</p>
            </div>
        `;
        return;
    }

    // Agrupar por categoria
    const grouped = items.reduce((acc, item) => {
        if (!acc[item.category]) acc[item.category] = [];
        acc[item.category].push(item);
        return acc;
    }, {});

    // Ordenar categorias
    const sortedCategories = Object.keys(grouped).sort();

    listsContainer.innerHTML = sortedCategories.map(category => {
        const categoryItems = grouped[category];
        const allCompleted = categoryItems.every(i => i.completed);
        
        return `
            <div class="category-section" style="opacity: ${allCompleted ? 0.6 : 1}">
                <div class="category-header ${allCompleted ? 'dark' : ''}">
                    <span>${category}</span>
                    <span>${categoryItems.filter(i => i.completed).length}/${categoryItems.length}</span>
                </div>
                <div class="category-items">
                    ${categoryItems.map(item => `
                        <div class="list-item ${item.completed ? 'completed' : ''}">
                            <div class="item-checkbox" onclick="toggleItem('${item.id}', ${item.completed})">
                                <i class="ri-check-line"></i>
                            </div>
                            <span class="item-name">${escapeHTML(item.name)}</span>
                            <button class="btn-delete" onclick="deleteItem('${item.id}')" aria-label="Deletar">
                                <i class="ri-delete-bin-line"></i>
                            </button>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }).join('');
}

// Utilidade contra XSS
function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// Executar
init();
