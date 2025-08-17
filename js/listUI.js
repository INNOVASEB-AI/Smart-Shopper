import { getShoppingLists, toggleItemCompletion } from './storage.js';
import { strawberryCharacter, emptyListIllustration } from './illustrations.js';

export async function renderListView(navigateToListItems) {
  try {
    console.log('Rendering list view...');
    
    const container = document.getElementById('lists-container');
    if (!container) {
      console.error('Lists container not found');
      return;
    }
    
    // Show loading state
    container.innerHTML = `
      <div class="text-center py-6 animate__animated animate__fadeIn">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p class="mt-2 text-sm opacity-70">Loading your lists...</p>
      </div>
    `;
    
    const lists = await getShoppingLists();
    console.log('Retrieved lists:', lists.length, 'lists');
    
    container.innerHTML = '';

    if (lists.length === 0) {
      container.innerHTML = `
        <div class="text-center py-6 animate__animated animate__fadeIn">
          ${emptyListIllustration}
          <p class="text-lg font-medium mb-2">No lists yet</p>
          <p class="opacity-70 mb-4">Tap the + button to create your first shopping list</p>
        </div>
      `;
      return;
    }

    lists.forEach(list => {
      // Calculate completion status
      const totalItems = list.items.length;
      const completedItems = list.items.filter(item => item.completed).length;
      const progressText = `${completedItems}/${totalItems}`;
      
      const listDiv = document.createElement('div');
      listDiv.className = 'list-item rounded-lg shadow-sm border cursor-pointer hover:scale-105 transition transform animate__animated animate__fadeInUp p-4 flex justify-between items-center';
      listDiv.style.background = 'var(--card-bg)';
      listDiv.style.color = 'var(--card-text)';
      listDiv.style.borderColor = 'var(--border-color)';
      listDiv.setAttribute('data-list-id', list.id);
      listDiv.setAttribute('data-list-name', list.name);

      // Calculate progress percentage for the progress bar
      const progressPercentage = totalItems > 0 ? (completedItems / totalItems) * 100 : 0;

      listDiv.innerHTML = `
        <div class="flex-grow">
          <p class="font-medium">${list.name}</p>
          <div class="flex items-center mt-1">
            <p class="text-sm opacity-80 mr-2">${progressText} items</p>
            <div class="w-24 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div class="h-full bg-green-500" style="width: ${progressPercentage}%"></div>
            </div>
          </div>
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

    // Clear the container
    container.innerHTML = '';

    if (!list) {
      console.error('List not found:', listId);
      container.innerHTML = '<p class="text-center text-red-500">Failed to load list items. Please try again.</p>';
      return;
    }

    // Update list title if element exists
    if (titleElement) {
      titleElement.textContent = list.name;
    }

    // Handle delete button if it exists
    if (deleteButton) {
      // Remove previous listener to prevent duplicates
      const newDeleteButton = deleteButton.cloneNode(true);
      deleteButton.parentNode.replaceChild(newDeleteButton, deleteButton);
      newDeleteButton.addEventListener('click', () => {
        if (confirm(`Are you sure you want to delete the list "${list.name}"?`)) {
          deleteList(list.id);
          navigateBackToLists();
        }
      });
    }

    // Calculate completion status for progress display
    const totalItems = list.items.length;
    const completedItems = list.items.filter(item => item.completed).length;
    
    // Add progress bar at the top if there are items and we're not in add mode
    const listItemsView = document.getElementById('list-items-view');
    const isInAddMode = listItemsView && listItemsView.classList.contains('adding');
    
    if (totalItems > 0 && !isInAddMode) {
      const progressDiv = document.createElement('div');
      progressDiv.className = 'animate__animated animate__fadeIn';
      const progressPercentage = (completedItems / totalItems) * 100;
      
      progressDiv.innerHTML = `
        <div class="flex justify-between items-center mb-1">
          <span class="text-sm font-medium">${completedItems}/${totalItems} completed</span>
          <span class="text-sm font-medium">${Math.round(progressPercentage)}%</span>
        </div>
        <div class="w-full h-2.5 bg-gray-200 dark:bg-gray-700 rounded-full">
          <div class="h-full bg-green-500 rounded-full" style="width: ${progressPercentage}%"></div>
        </div>
      `;
      
      container.appendChild(progressDiv);
    }

    // Render items or empty state
    if (!list.items || list.items.length === 0) {
      const emptyStateDiv = document.createElement('div');
      emptyStateDiv.className = 'text-center py-8 animate__animated animate__fadeIn';
      emptyStateDiv.innerHTML = `
        ${strawberryCharacter}
        <h3 class="text-xl font-medium mb-2">Let's plan your shopping!</h3>
        <p class="text-md opacity-70 mb-4">Tap the plus button to start adding products</p>
      `;
      container.appendChild(emptyStateDiv);
    } else {
      list.items.forEach(item => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'list-item-entry animate__animated animate__fadeInUp rounded-lg shadow-sm mb-2 transition-transform duration-300 hover:bg-gray-50 dark:hover:bg-slate-700';
        itemDiv.setAttribute('data-item-id', item.id);
        
        const priceDisplay = item.price ? `R${item.price}` : '';
        const retailerDisplay = item.retailer && item.retailer !== 'Manual Add' ? ` · ${item.retailer}` : ' · (Manual)';
        const subText = item.price || item.retailer === 'Manual Add' ? `<span class="text-xs opacity-80">${priceDisplay}${retailerDisplay}</span>` : '';
        
        // Add checkbox for completion state
        const isChecked = item.completed ? 'checked' : '';
        const checkedClass = item.completed ? 'line-through opacity-60' : '';
        
        itemDiv.innerHTML = `
          <div class="flex items-center py-2 px-3">
            <input type="checkbox" class="item-checkbox mr-2 w-4 h-4 cursor-pointer" ${isChecked}>
            <div class="flex-grow mr-2">
              <p class="${checkedClass} text-sm font-medium">${item.name}</p>
              ${subText}
            </div>
            <button class="remove-item-button text-red-500 flex-shrink-0" title="Remove Item">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5"> 
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /> 
              </svg>
            </button>
          </div>
        `;
        
        // Handle item checkbox
        itemDiv.querySelector('.item-checkbox').addEventListener('change', async (e) => {
          const checked = e.target.checked;
          const itemName = e.target.nextElementSibling.querySelector('p');
          const itemId = itemDiv.getAttribute('data-item-id');
          
          // Update the item's completed status
          await toggleItemCompletion(listId, itemId, checked);
          
          if (checked) {
            itemName.classList.add('line-through', 'opacity-60');
          } else {
            itemName.classList.remove('line-through', 'opacity-60');
          }
          
          // Refresh the progress display after an item is checked/unchecked
          renderListItemsView(listId, removeItemFromList, deleteList, navigateBackToLists);
        });
        
        // Handle remove item button
        itemDiv.querySelector('.remove-item-button').addEventListener('click', async (e) => {
          e.stopPropagation();
          await removeItemFromList(listId, item.id);
          // Refresh the view after removing an item
          renderListItemsView(listId, removeItemFromList, deleteList, navigateBackToLists);
        });
        
        container.appendChild(itemDiv);
      });
    }
    
    // Show the add more items FAB if we have items
    const addMoreFab = document.getElementById('add-more-items-fab');
    if (addMoreFab) {
      if (list.items && list.items.length > 0) {
        addMoreFab.classList.remove('hidden');
      } else {
        addMoreFab.classList.add('hidden');
      }
    }
    
  } catch (error) {
    console.error("Error rendering list items:", error);
    const container = document.getElementById('list-items-container');
    container.innerHTML = '<p class="text-center text-red-500">Failed to load list items. Please try again.</p>';
  }
} 