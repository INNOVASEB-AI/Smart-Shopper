// SVG illustrations for the app
// These illustrations will be used to make empty states more engaging

export const strawberryCharacter = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="120" height="120" class="mx-auto my-4">
  <!-- Strawberry leaf -->
  <path d="M100 30C90 20 70 25 65 35C80 35 85 45 85 50C85 40 95 35 105 42C105 35 115 30 130 35C125 20 110 20 100 30Z" fill="#4ade80" />
  <!-- Strawberry body -->
  <path d="M100 50C130 50 150 80 150 120C150 160 130 180 100 180C70 180 50 160 50 120C50 80 70 50 100 50Z" fill="#ef4444" />
  <!-- Strawberry seeds -->
  <circle cx="70" cy="90" r="3" fill="#fff" />
  <circle cx="90" cy="70" r="3" fill="#fff" />
  <circle cx="110" cy="70" r="3" fill="#fff" />
  <circle cx="130" cy="90" r="3" fill="#fff" />
  <circle cx="75" cy="120" r="3" fill="#fff" />
  <circle cx="125" cy="120" r="3" fill="#fff" />
  <circle cx="100" cy="100" r="3" fill="#fff" />
  <circle cx="85" cy="150" r="3" fill="#fff" />
  <circle cx="115" cy="150" r="3" fill="#fff" />
  <!-- Strawberry face -->
  <circle cx="85" cy="110" r="5" fill="#7f1d1d" />
  <circle cx="115" cy="110" r="5" fill="#7f1d1d" />
  <path d="M90 130Q100 140 110 130" stroke="#7f1d1d" stroke-width="3" fill="none" />
  <!-- Shadow -->
  <ellipse cx="100" cy="185" rx="40" ry="5" fill="rgba(0,0,0,0.2)" />
</svg>
`;

export const emptyListIllustration = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="100" height="100" class="mx-auto my-3">
  <rect x="40" y="50" width="120" height="140" rx="5" fill="#f3f4f6" stroke="#d1d5db" stroke-width="2"/>
  <line x1="60" y1="80" x2="140" y2="80" stroke="#d1d5db" stroke-width="2" stroke-dasharray="2"/>
  <line x1="60" y1="110" x2="140" y2="110" stroke="#d1d5db" stroke-width="2" stroke-dasharray="2"/>
  <line x1="60" y1="140" x2="140" y2="140" stroke="#d1d5db" stroke-width="2" stroke-dasharray="2"/>
  <line x1="60" y1="170" x2="140" y2="170" stroke="#d1d5db" stroke-width="2" stroke-dasharray="2"/>
  <circle cx="160" cy="40" r="20" fill="#ef4444"/>
  <path d="M160 30L160 50" stroke="white" stroke-width="4"/>
  <path d="M150 40L170 40" stroke="white" stroke-width="4"/>
</svg>
`;

export const popularItemsIcons = {
  bread: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><path d="M12 2C5.5 2 0 5.5 0 9c0 2.3 0 4.7 .2 7c.2 1.6 1.5 2.8 3.1 3L6 19.5c1 .4 2.2 .4 3.2 0L12 18l2.8 1.5c1 .4 2.2 .4 3.2 0l2.7-.5c1.6-.2 2.9-1.4 3.1-3 .2-2.3 .2-4.7 .2-7 0-3.5-5.5-7-12-7zm0 10c-2.2 0-4-1.8-4-4s1.8-4 4-4 4 1.8 4 4-1.8 4-4 4z" fill="#f59e0b"/></svg>`,
  milk: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><path d="M8 2H16L17 4H7L8 2ZM6 5V20C6 21.1 6.9 22 8 22H16C17.1 22 18 21.1 18 20V5H6ZM8 7H16V12H8V7Z" fill="#a5f3fc"/></svg>`,
  eggs: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><path d="M12 4C14.8 4 17 7.6 17 12S14.8 20 12 20 7 16.4 7 12 9.2 4 12 4Z" fill="#fef3c7"/></svg>`,
  meat: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><path d="M19 6h-1.5l-2-2h-7l-2 2H5c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-7 0L10.5 4h3L15 6h-3z" fill="#f87171"/></svg>`,
  fruits: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><path d="M7.5 16C9.5 16 10.7 16.3 12 18C13.3 16.3 14.5 16 16.5 16C18.4 16 20 14.4 20 12.5S18.4 9 16.5 9H14L13 8.3C14.2 7.2 15 5.7 15 4H9C9 5.7 9.8 7.2 11 8.3L10 9H7.5C5.6 9 4 10.6 4 12.5S5.6 16 7.5 16Z" fill="#86efac"/></svg>`,
};

export const shoppingBagIcon = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><path d="M19 6h-2c0-2.8-2.2-5-5-5S7 3.2 7 6H5c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-7-3c1.7 0 3 1.3 3 3H9c0-1.7 1.3-3 3-3zm0 10c-2.8 0-5-2.2-5-5h2c0 1.7 1.3 3 3 3s3-1.3 3-3h2c0 2.8-2.2 5-5 5z" fill="#60a5fa"/></svg>
`;

// Icons for popular grocery items
export const groceryIcons = {
  milk: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" class="mr-1"><path d="M8 2H16L17 4H7L8 2ZM6 5V20C6 21.1 6.9 22 8 22H16C17.1 22 18 21.1 18 20V5H6ZM8 7H16V12H8V7Z" fill="currentColor"/></svg>`,
  bread: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" class="mr-1"><path d="M12 2C5.5 2 0 5.5 0 9c0 2.3 0 4.7 .2 7c.2 1.6 1.5 2.8 3.1 3L6 19.5c1 .4 2.2 .4 3.2 0L12 18l2.8 1.5c1 .4 2.2 .4 3.2 0l2.7-.5c1.6-.2 2.9-1.4 3.1-3 .2-2.3 .2-4.7 .2-7 0-3.5-5.5-7-12-7zm0 10c-2.2 0-4-1.8-4-4s1.8-4 4-4 4 1.8 4 4-1.8 4-4 4z" fill="currentColor"/></svg>`,
  eggs: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" class="mr-1"><path d="M12 4C14.8 4 17 7.6 17 12S14.8 20 12 20 7 16.4 7 12 9.2 4 12 4Z" fill="currentColor"/></svg>`,
  butter: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" class="mr-1"><path d="M4 5v13h16V5H4zm5 11.5H6.5v-2H9v2zm0-3.5H6.5v-2H9v2zm0-3.5H6.5v-2H9v2zm7.5 7h-5v-9h5v9z" fill="currentColor"/></svg>`,
  meat: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" class="mr-1"><path d="M19 6h-1.5l-2-2h-7l-2 2H5c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2z" fill="currentColor"/></svg>`,
  cheese: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" class="mr-1"><path d="M21 11h-8V9.9C14.2 9.8 15.3 9 15.8 8H21V11M21 3h-8v3h8V3M9.5 11c-.6 0-1.1.2-1.5.6L3 17V11H1V21h10v-2H5.9l5-5c.4-.4.6-.9.6-1.5 0-.8-.7-1.5-1.5-1.5M5 6H1v2h4c.6 0 1 .4 1 1s-.4 1-1 1h-.3C3.7 10 3 10.7 3 11.7V14h2v-2h.3c1.5 0 2.7-1.2 2.7-2.7C8 7.4 6.6 6 5 6z" fill="currentColor"/></svg>`,
  fruits: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" class="mr-1"><path d="M7.5 16C9.5 16 10.7 16.3 12 18C13.3 16.3 14.5 16 16.5 16C18.4 16 20 14.4 20 12.5S18.4 9 16.5 9H14L13 8.3C14.2 7.2 15 5.7 15 4H9C9 5.7 9.8 7.2 11 8.3L10 9H7.5C5.6 9 4 10.6 4 12.5S5.6 16 7.5 16Z" fill="currentColor"/></svg>`,
  vegetables: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" class="mr-1"><path d="M7 2h10v2h-2v20H9V4H7V2zm4 8h2v10h-2V10z" fill="currentColor"/></svg>`,
  potatoes: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" class="mr-1"><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-2.2-5.2L10.5 3.5C9.3 2.3 7.5 1 5 1c-.5 0-1 0-1.5.1C2.9 1.2 2 4 2 7c0 2.5 1.3 4.3 2.5 5.5l6.2 6.3c1.3 1.3 3.2 2.2 5.3 2.2z" fill="currentColor"/></svg>`,
  rice: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" class="mr-1"><path d="M18 8c0-3.3-2.7-6-6-6-3.3 0-6 2.7-6 6 0 4 3 10 6 10 3 0 6-6 6-10z" fill="currentColor"/></svg>`,
}; 