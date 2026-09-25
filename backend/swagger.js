// Builds the OpenAPI spec from the @swagger comments in the route files.
const swaggerJsdoc = require('swagger-jsdoc');
const path = require('path');

module.exports = swaggerJsdoc({
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'Campus Works API',
      version: '1.0.0',
      description: 'Research assistant and TA openings. Professors post, students apply after a GPA check.'
    },
    servers: [{ url: 'http://localhost:3000' }],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }
      }
    }
  },
  apis: [path.join(__dirname, '*.js'), path.join(__dirname, 'routes', '*.js')]
});
