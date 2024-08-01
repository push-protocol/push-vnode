import { Express } from 'express'
import swaggerJsDoc, { Options, Schema } from 'swagger-jsdoc'
import swaggerUI from 'swagger-ui-express'
function initialiseSwagger(app: Express) {
  const options: Options = {
    definition: {
      openapi: '3.0.0',
      info: {
        title: 'PUSH Developer APIs',
        version: '1.0.0',
        description: 'PUSH Developer API Documentation'
      },
      servers: [
        {
          url: 'http://localhost:4000'
        }
      ]
    },
    apis: ['./src/api/routes/swagger/*.swagger.ts']
  }

  const specs: Schema = swaggerJsDoc(options)
  app.use('/api-docs', swaggerUI.serve, swaggerUI.setup(specs))
}

export default initialiseSwagger
