const { scrapeWithPuppeteer, waitForSelectorWithRetry } = require('./puppeteerScraperHelper');
const { logger } = require('../logger');

/**
 * Scrapes Makro website for products matching the search query
 * 
 * @param {string} query - Search term
 * @returns {Promise<Array>} - Array of product results
 */
async function scrapeMakro(query) {
  const searchUrl = `https://www.makro.co.za/search/?text=${encodeURIComponent(query)}`;
  
  // Use the helper function to handle the common scraping logic
  const { results, error } = await scrapeWithPuppeteer('Makro', searchUrl, async (page, retailerLogger) => {
    const allResults = [];
    let currentPage = 1;
    let hasMorePages = true;
    
    // --- Pagination Loop ---
    while (hasMorePages) {
      retailerLogger.info(`Scraping page ${currentPage}...`);
      
      // --- Wait for product items on the current page ---
      const productItemSelector = 'div._4ddWXP';
      try {
        await waitForSelectorWithRetry(page, productItemSelector, retailerLogger, {
          message: `Waiting for Makro product items on page ${currentPage}`
        });
      } catch (waitError) {
        // If selector not found on the first page, something is wrong
        // Otherwise, might just be end of results
        if (currentPage === 1) {
          throw new Error(`Product selector not found on first page: ${waitError.message}`);
        } else {
          retailerLogger.info(`Assuming end of results after page ${currentPage - 1}.`);
          hasMorePages = false;
          break;
        }
      }
      
      // --- Scrape products on the current page ---
      const productsOnPage = await page.evaluate((selector) => {
        const items = [];
        document.querySelectorAll(selector).forEach((element) => {
          try {
            const allLinks = element.querySelectorAll('a');
            const imageLinkElement = allLinks[0];
            const nameElement = allLinks[1];

            const name = nameElement ? nameElement.innerText.trim() : null;
            const productLink = nameElement ? nameElement.getAttribute('href') : null;

            const priceElement = nameElement ? nameElement.nextElementSibling : null;
            const priceText = priceElement ? priceElement.innerText.trim() : null;
            let price = null;
            if (priceText && priceText.includes('R')) {
              price = priceText.replace(/[^\d.]/g, '');
              if (!isNaN(parseFloat(price))) {
                price = parseFloat(price).toFixed(2);
              } else {
                price = null;
              }
            } else {
              price = null;
            }

            const imageElement = imageLinkElement ? imageLinkElement.querySelector('img') : null;
            let image = imageElement ? imageElement.getAttribute('src') : null;
            if (image && image.startsWith('/')) {
              image = `https://www.makro.co.za${image}`;
            } else if (image && !image.startsWith('http')) {
              image = `https://www.makro.co.za/${image}`;
            }

            let id = null;
            if (productLink) {
              const match = productLink.match(/\/p\/([^/]+)/);
              id = match ? match[1] : null;
            }

            const retailer = 'Makro';

            if (name && price && id) {
              items.push({ retailer, name, price, id, image: image || null });
            }
          } catch (e) {
            // Using console.error here because this runs in the browser context
            console.error('Error processing a Makro item inside page.evaluate:', e.message);
          }
        });
        return items;
      }, productItemSelector);
      
      retailerLogger.info(`Found ${productsOnPage.length} products on page ${currentPage}.`);
      allResults.push(...productsOnPage);
      
      // --- Check for and click the "Next" button ---
      let nextButtonClicked = false;
      try {
        // Use page.evaluateHandle to find the 'Next' link handle
        const nextLinkHandle = await page.evaluateHandle(() => {
          const links = Array.from(document.querySelectorAll('a'));
          return links.find((link) => link.innerText.trim().toLowerCase() === 'next');
        });
        
        // Check if the element was found and is valid
        if (nextLinkHandle && nextLinkHandle.asElement()) {
          const element = nextLinkHandle.asElement();
          retailerLogger.info('Found potential "Next" button by text content. Clicking...');
          await element.click();
          
          // --- Wait for next page to load ---
          retailerLogger.info('Waiting for next page products to load...');
          
          // Wait for products to appear again after navigation
          await waitForSelectorWithRetry(page, productItemSelector, retailerLogger, {
            message: 'Waiting for next page products to load',
            timeout: 45000
          });
          
          // Add a small delay to allow JS to potentially finish rendering/settling
          await new Promise((resolve) => setTimeout(resolve, 2000));
          retailerLogger.info('Next page products seem to have loaded.');
          
          currentPage++;
          nextButtonClicked = true; // Mark that we successfully clicked
        } else {
          retailerLogger.info('"Next" button link not found by text content. Ending pagination.');
          hasMorePages = false; // No next button, end the loop
        }
        
        // Dispose of the handle to free up resources
        await nextLinkHandle.dispose();
      } catch (error) {
        // Handle errors during find/click (e.g., element detached, navigation timeout)
        retailerLogger.warn(`Error finding or clicking "Next" button by text (likely end of results): ${error.message}`);
        hasMorePages = false; // End the loop if there was an error
      }
      
      // If we didn't successfully click the next button, end the loop
      if (!nextButtonClicked) {
        hasMorePages = false;
        break;
      }
    } // End of while loop
    
    retailerLogger.info(`Found ${allResults.length} total results for "${query}".`);
    return allResults;
  });
  
  // Return just the results array to maintain the same interface as before
  return error ? [] : results;
}

module.exports = scrapeMakro;
