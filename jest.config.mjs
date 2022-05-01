/** @type {import('@jest/types').Config.InitialOptions} */
const config = {
	displayName: 'unit test',
	testMatch: ['<rootDir>/tests/**/*.test.ts'],
	setupFilesAfterEnv: ['<rootDir>/tests/jest.setup.ts'],
	collectCoverageFrom: ['<rootDir>/src/**/*.ts'],
	reporters: ['default', 'github-actions'],
	transform: {
		'^.+\\.tsx?$': 'esbuild-jest'
	},
	moduleNameMapper: {
		'^#utils/(.*)$': '<rootDir>/src/lib/util/$1',
		'^#types/(.*)$': '<rootDir>/src/lib/types/$1',
		'^#constants/(.*)$': '<rootDir>/src/lib/constants/$1',
		'^#lib/(.*)$': '<rootDir>/src/lib/$1'
	}
};

export default config;
