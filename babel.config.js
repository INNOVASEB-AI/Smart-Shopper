module.exports = {
  presets: [
    [
      '@babel/preset-env',
      {
        targets: {
          node: 'current',
          browsers: '> 1%, not dead'
        },
      },
    ],
  ],
}; 