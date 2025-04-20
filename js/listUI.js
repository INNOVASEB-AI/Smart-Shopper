import { getShoppingLists } from './storage.js';

export async function renderListView(navigateToListItems) {
  try {
    const lists = await getShoppingLists();
    const container = document.getElementById('lists-container');
    container.innerHTML = '';

    if (lists.length === 0) {
      container.innerHTML = '<p class="text-center opacity-70">No lists created yet. Tap the + button to add one!</p>';
      return;
    }

    lists.forEach(list => {
      const listDiv = document.createElement('div');
      listDiv.className = 'list-item rounded-lg shadow-sm border cursor-pointer hover:scale-105 transition transform animate__animated animate__fadeInUp p-4 flex justify-between items-center';
      listDiv.style.background = 'var(--card-bg)';
      listDiv.style.color = 'var(--card-text)';
      listDiv.style.borderColor = 'var(--border-color)';
      listDiv.setAttribute('data-list-id', list.id);
      listDiv.setAttribute('data-list-name', list.name);

      listDiv.innerHTML = `
        <div>
          <p class="font-medium">${list.name}</p>
          <p class="text-sm opacity-80">${list.items.length} items</p>
        </div>
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 opacity-50">
          <path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
        </svg>
      `;
      listDiv.addEventListener('click', () => {
        navigateToListItems(list.id);
      });
      container.appendChild(listDiv);
    });
  } catch (error) {
    console.error("Error rendering lists:", error);
    const container = document.getElementById('lists-container');
    container.innerHTML = '<p class="text-center text-red-500">Failed to load your lists. Please try again.</p>';
  }
}

export async function renderListItemsView(listId, removeItemFromList, deleteList, navigateBackToLists) {
  try {
    const lists = await getShoppingLists();
    const list = lists.find(l => l.id === listId);
    const container = document.getElementById('list-items-container');
    const titleElement = document.getElementById('list-items-title');
    const deleteButton = document.getElementById('delete-list-button');

    container.innerHTML = '';

    if (!list) {
      titleElement.textContent = 'List Not Found';
      container.innerHTML = '<p class="text-center opacity-70">Could not load list items.</p>';
      deleteButton.style.display = 'none';
      return;
    }

    titleElement.textContent = list.name;
    deleteButton.style.display = 'block';

    // Remove previous listener to prevent duplicates
    const newDeleteButton = deleteButton.cloneNode(true);
    deleteButton.parentNode.replaceChild(newDeleteButton, deleteButton);
    newDeleteButton.addEventListener('click', () => {
      if (confirm(`Are you sure you want to delete the list "${list.name}"?`)) {
        deleteList(list.id);
      }
    });

    if (!list.items || list.items.length === 0) {
      container.innerHTML = '<p class="text-center opacity-70">This list is empty. Add items below or from the Search tab.</p>';
    } else {
      list.items.forEach(item => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'list-item-entry animate__animated animate__fadeInUp rounded-xl shadow-lg mb-3 transition-transform duration-300 hover:scale-105 hover:shadow-2xl';
        itemDiv.setAttribute('data-item-id', item.id);
        const priceDisplay = item.price ? `R ${item.price}` : '';
        const retailerDisplay = item.retailer && item.retailer !== 'Manual Add' ? `at ${item.retailer}` : '(Manually Added)';
        const subText = item.price || item.retailer === 'Manual Add' ? `<span class="text-xs opacity-80">${priceDisplay} ${retailerDisplay}</span>` : '';
        itemDiv.innerHTML = `
          <div class="flex-grow mr-2">
            <p>${item.name}</p>
            ${subText}
          </div>
          <button class="remove-item-button" title="Remove Item">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4"> <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /> </svg>
          </button>
        `;
        itemDiv.querySelector('.remove-item-button').addEventListener('click', (e) => {
          e.stopPropagation();
          removeItemFromList(listId, item.id);
        });
        itemDiv.classList.add('animate__pulse');
        setTimeout(() => itemDiv.classList.remove('animate__pulse'), 600);
        container.appendChild(itemDiv);
      });
    }
  } catch (error) {
    console.error("Error rendering list items:", error);
    const container = document.getElementById('list-items-container');
    container.innerHTML = '<p class="text-center text-red-500">Failed to load list items. Please try again.</p>';
  }
} 