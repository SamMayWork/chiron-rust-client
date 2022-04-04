const app = require('./src/app')
const Logger = require('./src/logger')
const logging = new Logger('server-start')

const port = process.env.PORT || 8080

app.listen(port, () => {
  logging.info(`Server Established and listening on port ${port}`)
})
