const { scrapeCheckers } = require('../scrapeCheckers');
const nock = require('nock');
const fs = require('fs');
const path = require('path');

// Create the fixture directory if it doesn't exist
const fixtureDir = path.join(__dirname, '__fixtures__');
if (!fs.existsSync(fixtureDir)) {
  fs.mkdirSync(fixtureDir, { recursive: true });
}

// Sample HTML response (simplified for test purposes)
const sampleHTML = `
<!DOCTYPE html>
<html>
<body>
  <div class="product-frame">
    <div class="product-card">
      <h3>Checkers Milk 1L</h3>
      <div class="price">R 15.99</div>
    </div>
  </div>
  <div class="product-frame">
    <div class="product-card">
      <h3>Checkers Bread 700g</h3>
      <div class="price">R 12.99</div>
    </div>
  </div>
</body>
</html>
`;

// Save sample HTML to fixture file
fs.writeFileSync(path.join(fixtureDir, 'checkers-search-milk.html'), sampleHTML);

describe('scrapeCheckers', () => {
  beforeEach(() => {
    // Clear any previous mocks
    nock.cleanAll();
  });

  afterAll(() => {
    // Ensure we clean up nock
    nock.restore();
  });

  test('successfully parses products from Checkers search results', async () => {
    // Mock the HTTP request
    nock('https://www.checkers.co.za')
      .get('/search')
      .query({ q: 'milk' })
      .reply(200, sampleHTML);
    
    // Call the function
    const result = await scrapeCheckers('milk');
    
    // Assert expectations
    expect(result.error).toBeFalsy();
    expect(result.results).toHaveLength(2);
    expect(result.results[0]).toHaveProperty('name', 'Checkers Milk 1L');
    expect(result.results[0]).toHaveProperty('price', '15.99');
    expect(result.results[0]).toHaveProperty('retailer', 'Checkers');
  });
  
  test('handles network errors gracefully', async () => {
    // Mock a failed request
    nock('https://www.checkers.co.za')
      .get('/search')
      .query({ q: 'milk' })
      .replyWithError('Connection refused');
    
    const result = await scrapeCheckers('milk');
    
    expect(result.error).toBeTruthy();
    expect(result.message).toContain('error');
    expect(result.results).toEqual([]);
  });

  test('handles empty results gracefully', async () => {
    // Mock an empty response
    nock('https://www.checkers.co.za')
      .get('/search')
      .query({ q: 'nonexistentproduct' })
      .reply(200, '<html><body><div class="no-results">No products found</div></body></html>');
    
    const result = await scrapeCheckers('nonexistentproduct');
    
    expect(result.error).toBeFalsy();
    expect(result.results).toEqual([]);
  });

  test('handles malformed HTML gracefully', async () => {
    // Mock malformed HTML
    nock('https://www.checkers.co.za')
      .get('/search')
      .query({ q: 'milk' })
      .reply(200, '<html><body>Malformed HTML</body>');
    
    const result = await scrapeCheckers('milk');
    
    // Even with malformed HTML, we should still get a proper result object
    expect(result.results).toEqual([]);
  });
}); 