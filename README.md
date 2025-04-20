# Smart Shopper SA

A modern web application for comparing grocery prices across South African retailers to help you save money on your shopping.

![Smart Shopper SA Logo](path/to/logo.png)

## Table of Contents

- [Features](#features)
- [Installation](#installation)
  - [Prerequisites](#prerequisites)
  - [Backend Setup](#backend-setup)
  - [Frontend Setup](#frontend-setup)
- [Development](#development)
  - [Environment Variables](#environment-variables)
  - [Running Tests](#running-tests)
- [Scraping Considerations](#scraping-considerations)
- [Contributing](#contributing)
- [License](#license)

## Features

### Core Price Comparison & Search
- **Product Search**: Search for specific grocery products by name with real-time results
- **Real-time Price Display**: View current prices from major South African retailers (Shoprite, Checkers, Pick n Pay, Makro, Woolworths)
- **Retailer Filtering**: Filter search results to show prices from specific retailers
- **Cheapest Total Basket Calculation**: Calculate the lowest total cost of your entire shopping list at each retailer
- **Optimized Multi-Store Shopping Plan**: Get suggestions on how to split your shopping across multiple stores for maximum savings
- **Specials & Promotions Handling**: Identify and display products currently on special offers

### Smart Shopping Lists
- **List Creation & Management**: Create, name, and manage multiple shopping lists
- **Manual Item Addition**: Add items to lists by typing their names
- **Add from Search**: Add products found via search directly to a shopping list
- **View List Items**: See all items in a selected shopping list
- **Check Off Items**: Mark items as "checked" or "acquired" during shopping
- **Item Deletion**: Remove individual items from a list
- **List Deletion**: Delete entire shopping lists
- **AI Item Categorization** (Future): Automatically categorize items added to lists
- **AI Smart Suggestions** (Future): Receive suggestions for alternatives if items are out of stock
- **Voice Input** (Future): Add items to lists using voice commands

### Loyalty Cards
- **Digital Card Storage**: Securely store digital versions of loyalty cards
- **Add Card Methods**: Add cards via manual input or by scanning barcodes
- **Easy Access for Scanning**: Display stored loyalty card barcodes for easy scanning at checkout

### Location & Personalization
- **User Accounts & Authentication**: Secure user registration and login
- **Location-Based Services** (Future): Display nearby stores and filter based on proximity
- **User Profile Management** (Future): Allow users to manage profile settings
- **Push Notifications** (Future): Receive alerts for price drops on list items

### Conversational Assistant (Future)
- **Chat Interface**: Interact with the app using natural language
- **AI-Powered Understanding**: Use AI to understand user commands and questions
- **Chat-Based Actions**: Perform actions via the chat interface

### User Interface
- **Responsive Design**: Works on desktop and mobile devices
- **Dark/Light Mode**: Support for both light and dark themes
- **Intuitive Navigation**: Easy-to-use interface with clear navigation elements

## Installation

### Prerequisites
- Node.js 16+
- npm 8+

### Backend Setup
```bash
# Navigate to the backend directory
cd backend

# Install dependencies
npm install

# Start the development server
npm start
```

### Frontend Setup
```bash
# In the project root
npm install

# Start the frontend development server
npm start
```

## Development

### Environment Variables
Create a `.env` file in the backend directory:
```
PORT=3001
LOG_LEVEL=info
RATE_LIMIT_REQUESTS=30
RATE_LIMIT_INTERVAL=60000
```

### Running Tests
```bash
# Run all tests
npm test

# Run frontend tests only
npm run test:frontend

# Run backend tests only
npm run test:backend

# Run tests in watch mode
npm test -- --watch
```

## Scraping Considerations
The application uses web scraping to fetch prices from retailers. Please be mindful of:
- **Rate limits**: The app implements rate limiting to avoid overloading retailer websites
- **Terms of Service**: Ensure compliance with each retailer's terms of service
- **Data freshness**: Prices are fetched in real-time and not cached long-term
- **Maintenance**: Scrapers may need updates if retailer websites change their structure

## Contributing
Contributions are welcome! Please feel free to submit a Pull Request.

## License
This project is licensed under the MIT License - see the LICENSE file for details. 