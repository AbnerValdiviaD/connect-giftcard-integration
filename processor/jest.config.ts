/** @type {import('ts-jest').JestConfigWithTsJest} */

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['./test'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
    '^.+\\.m?js$': 'babel-jest',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(msw|@bundled-es-modules|@mswjs|until-async|strict-event-emitter)/)',
  ],
};
