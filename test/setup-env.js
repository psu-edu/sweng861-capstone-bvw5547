// Environment values for the backend test runs. Loaded by jest before each test file.
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.LINKEDIN_CLIENT_ID = '';
process.env.LINKEDIN_CLIENT_SECRET = '';
